"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  extractFromMessage,
  extractFromUrl,
  extractPosts,
  isValidPostId,
} = require("./links");
const { PostStorage, parseRecordLine } = require("./storage");
const {
  collectPostIds,
  forgetPinsWithoutData,
  formatPinJson,
  isJpeg,
  pinDir,
  PIN_DIR_MAX_PRUNE,
  pruneOldPinDirs,
} = require("./export-pin");
const { extractPhotoUrl, isShopUrl, parseCaptionHtml, parseEmbedHtml } = require("./parse-post");
const { buildReplyWithJson } = require("./tg-html");
const { BOARDS } = require("./boards");
const { inferDescription, MISSING_DESCRIPTION } = require("./descriptions");
const {
  isOurChannelPost,
  listRecentCandidateIds,
  maxPreviewPostId,
  parsePreviewPostIds,
  pickUnusedId,
  postIdFromChannelPost,
} = require("./channel-feed");
const { loadAutoState, rememberLatestId, runAutoImport, sanitizeState } = require("./auto-import");

assert.deepStrictEqual(extractPosts(""), []);
assert.deepStrictEqual(extractPosts(null), []);
assert.deepStrictEqual(extractPosts(123), []);
assert.deepStrictEqual(extractPosts("https://t.me/other/1"), []);
assert.deepStrictEqual(extractPosts("https://t.me/kupim_v_usa/0"), []);
assert.deepStrictEqual(extractPosts("https://t.me/kupim_v_usa/-5"), []);
assert.deepStrictEqual(extractPosts("https://evil.com/t.me/kupim_v_usa/1"), []);
assert.deepStrictEqual(extractPosts("javascript:alert(1)//t.me/kupim_v_usa/1"), []);
assert.ok(!isValidPostId(0));
assert.ok(!isValidPostId(Number.MAX_SAFE_INTEGER + 1));

assert.deepStrictEqual(extractPosts("https://t.me/kupim_v_usa/42"), [
  { postId: 42, url: "https://t.me/kupim_v_usa/42" },
]);
assert.deepStrictEqual(
  extractPosts("см. t.me/kupim_v_usa/42 и https://t.me/s/kupim_v_usa/99 и t.me/kupim_v_usa/42"),
  [
    { postId: 42, url: "https://t.me/kupim_v_usa/42" },
    { postId: 99, url: "https://t.me/kupim_v_usa/99" },
  ]
);
assert.deepStrictEqual(extractPosts("http://telegram.me/kupim_v_usa/7"), [
  { postId: 7, url: "https://t.me/kupim_v_usa/7" },
]);

assert.deepStrictEqual(extractFromUrl("javascript:alert(1)"), []);
assert.deepStrictEqual(extractFromUrl("file:///etc/passwd"), []);
assert.deepStrictEqual(extractFromUrl("https://user:pass@t.me/kupim_v_usa/9"), []);
assert.deepStrictEqual(extractFromUrl("https://t.me/kupim_v_usa/15"), [
  { postId: 15, url: "https://t.me/kupim_v_usa/15" },
]);

assert.deepStrictEqual(
  extractFromMessage({
    text: "бренд",
    entities: [{ type: "text_link", offset: 0, length: 5, url: "https://t.me/kupim_v_usa/15" }],
  }),
  [{ postId: 15, url: "https://t.me/kupim_v_usa/15" }]
);
assert.deepStrictEqual(
  extractFromMessage({
    text: "https://t.me/kupim_v_usa/15",
    entities: [{ type: "url", offset: 0, length: Number.MAX_SAFE_INTEGER }],
  }),
  [{ postId: 15, url: "https://t.me/kupim_v_usa/15" }]
);
assert.deepStrictEqual(
  extractFromMessage({
    text: "https://t.me/kupim_v_usa/15",
    entities: [{ type: "url", offset: Number.NaN, length: 5 }],
  }),
  [{ postId: 15, url: "https://t.me/kupim_v_usa/15" }]
);
assert.deepStrictEqual(
  extractFromMessage({
    text: "x",
    entities: [{ type: "text_link", offset: 0, length: 1, url: "javascript:alert(1)" }],
  }),
  []
);

assert.strictEqual(parseRecordLine('{"url":"javascript:alert(1)","post_id":1}'), null);
assert.strictEqual(
  parseRecordLine('{"url":"https://t.me/kupim_v_usa/1","post_id":1,"__proto__":{"admin":true}}').post_id,
  1
);
assert.strictEqual(Object.prototype.admin, undefined);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kupim-bot-"));
const file = path.join(dir, "posts.jsonl");
const storage = new PostStorage(file);

assert.strictEqual(storage.count(), 0);
assert.deepStrictEqual(storage.listRecent(0), []);
assert.deepStrictEqual(storage.listRecent(-1), []);
assert.strictEqual(storage.add({ url: "https://t.me/kupim_v_usa/1", postId: 1, fromUserId: 7 }), true);
assert.strictEqual(storage.add({ url: "javascript:alert(1)", postId: 8, fromUserId: 7 }), false);
assert.strictEqual(storage.add({ url: "https://t.me/kupim_v_usa/1", postId: 1 }), false);
assert.strictEqual(storage.add({ url: "", postId: 2 }), false);
assert.strictEqual(storage.add({ url: "https://t.me/kupim_v_usa/3", postId: 0 }), false);
assert.strictEqual(
  storage.add({
    url: "https://t.me/kupim_v_usa/4",
    postId: 4,
    fromUserId: 1,
    fromUsername: "<script>alert(1)</script>",
  }),
  true
);
assert.strictEqual(storage.listRecent(10).find((row) => row.post_id === 4).from_username, null);
assert.strictEqual(storage.count(), 2);
assert.strictEqual(storage.listRecent(10)[0].post_id, 1);

assert.strictEqual(
  storage.add({ url: "https://t.me/kupim_v_usa/5", postId: 5, fromUserId: 8 }),
  true
);
assert.deepStrictEqual(
  storage.listRecent(10, 8).map((row) => row.post_id),
  [5]
);
assert.ok(storage.listRecent(10, 7).every((row) => row.from_user_id === 7));
assert.deepStrictEqual(storage.listRecent(10, 999), []);
assert.strictEqual(storage.count(8), 1);
assert.strictEqual(storage.count(7), 1);
assert.strictEqual(storage.count(999), 0);
assert.strictEqual(
  JSON.parse(fs.readFileSync(path.join(dir, "last-save.json"), "utf8")).post_id,
  5
);

fs.appendFileSync(file, "not-json\n[]\n", "utf8");
assert.strictEqual(storage.listRecent(10).length, 3);

const rmDir = fs.mkdtempSync(path.join(os.tmpdir(), "kupim-rm-"));
const rmStore = new PostStorage(path.join(rmDir, "posts.jsonl"));
assert.strictEqual(rmStore.add({ url: "https://t.me/kupim_v_usa/21", postId: 21, fromUserId: 7 }), true);
assert.strictEqual(rmStore.add({ url: "https://t.me/kupim_v_usa/22", postId: 22, fromUserId: 7 }), true);
assert.strictEqual(rmStore.remove(21), true);
assert.strictEqual(rmStore.has(21), false);
assert.strictEqual(rmStore.has(22), true);
assert.strictEqual(rmStore.count(), 1);
assert.strictEqual(rmStore.remove(21), false);
assert.strictEqual(rmStore.remove(0), false);
assert.deepStrictEqual(rmStore.removeMany(["22", 99]).sort((a, b) => a - b), [22]);
assert.strictEqual(rmStore.count(), 0);

const pinRoot = path.join(rmDir, "pins");
const keepPin = path.join(pinRoot, "31");
fs.mkdirSync(keepPin, { recursive: true });
fs.writeFileSync(path.join(keepPin, "data.json"), "{}\n");
const syncStore = new PostStorage(path.join(rmDir, "sync.jsonl"));
assert.strictEqual(syncStore.add({ url: "https://t.me/kupim_v_usa/31", postId: 31 }), true);
assert.strictEqual(syncStore.add({ url: "https://t.me/kupim_v_usa/32", postId: 32 }), true);
assert.deepStrictEqual(forgetPinsWithoutData(syncStore, { root: pinRoot, keepIds: [] }).sort((a, b) => a - b), [32]);
assert.ok(syncStore.has(31));
assert.ok(!syncStore.has(32));
fs.rmSync(rmDir, { recursive: true, force: true });

fs.rmSync(dir, { recursive: true, force: true });

assert.strictEqual(isShopUrl("javascript:alert(1)"), false);
assert.strictEqual(isShopUrl("https://t.me/zakaz_managers"), false);
assert.strictEqual(isShopUrl("https://www.nike.com/t/air-max-ishod"), true);
assert.strictEqual(extractPhotoUrl('<img src="https://cdn4.telesco.pe/file/avatar.jpg">'), null);

const html47039 = `
<div class="tgme_widget_message_photo_wrap" style="background-image:url('https://cdn4.telesco.pe/file/demo47039.jpg')"></div>
<div class="tgme_widget_message_text js-message_text" dir="auto"><b>Nike</b> <i class="emoji"><b>🇺🇸</b></i><br><br><a href="https://www.nike.com/t/air-max-ishod-skate-shoes-hpCjEcyG/IR1887-001">Кроссовки высокие Air Max Ishod</a> унисекс<br><b><s>13800₽</s> ➡️ 11800₽ + доставка</b><br><br>ID: <code>723660</code><br>💌 Для заказа писать: <a href="https://t.me/zakaz_managers"><b>@zakaz_managers</b></a><br><a href="https://max.ru/join/x">Подпишись на нас в MAX</a></div>`;

const parsed47039 = parseEmbedHtml(html47039, 47039);
assert.strictEqual(parsed47039.photoUrl, "https://cdn4.telesco.pe/file/demo47039.jpg");
assert.strictEqual(parsed47039.pin.title, "Nike Air Max Ishod — унисекс кроссовки | оригинал из США");
assert.strictEqual(parsed47039.pin.link, "https://t.me/kupim_v_usa/47039");
assert.ok(parsed47039.pin.description.includes("кроссовки nike"));
assert.ok(parsed47039.pin.description.includes("Nike Air Max"));
assert.ok(!parsed47039.pin.description.includes("11800₽"));
assert.ok(!parsed47039.pin.description.includes("723660"));
assert.ok(!parsed47039.pin.description.includes("zakaz_managers"));
assert.deepStrictEqual(parsed47039.pin.tags, ["nike", "кроссовки", "обувь", "унисекс"]);
assert.strictEqual(parsed47039.pin.board, undefined);

const html46991 = `<b>Calvin Klein</b> 🇺🇸<br><br><a href="https://www.calvinklein.us/en/jacket.html">Куртка</a> (мужской раздел)<br><b><s>21500₽</s> ➡️ 7800₽ + доставка</b><br>M, XL, 2XL<br><br>ID: <code>723414</code>`;
const pin46991 = parseCaptionHtml(html46991, { postId: 46991 });
assert.strictEqual(pin46991.title, "Calvin Klein — мужские куртка | оригинал из США");
assert.strictEqual(pin46991.link, "https://t.me/kupim_v_usa/46991");
assert.strictEqual(pin46991.board, BOARDS.jackets);
assert.ok(pin46991.tags.includes("calvin klein"));
assert.ok(pin46991.tags.includes("куртка"));
assert.ok(pin46991.tags.includes("мужские"));
assert.ok(pin46991.description.includes("Calvin Klein куртки"));
assert.ok(!pin46991.description.includes("7800₽"));

const html46874 = `<b>Timberland</b> 🇺🇸<br><br><a href="https://www.timberland.com/en-us/p/left">Худи слева</a> (мужской раздел)<br><b><s>8400₽</s> ➡️ 3000₽ + доставка</b><br><a href="https://www.timberland.com/en-us/p/right">Худи справа</a> (мужской раздел)<br><b><s>8400₽</s> ➡️ 2600₽ + доставка</b><br><br>ID: <code>721351</code>`;
const pin46874 = parseCaptionHtml(html46874, { postId: 46874 });
assert.strictEqual(pin46874.title, "Timberland — мужские худи | оригинал из США");
assert.strictEqual(pin46874.link, "https://t.me/kupim_v_usa/46874");
assert.strictEqual(pin46874.description, MISSING_DESCRIPTION);
assert.strictEqual(pin46874.board, BOARDS.menClothes);

const htmlVs = `<b>Victoria's Secret</b> 🇺🇸<br><br><a href="https://www.victoriassecret.com/p/pj">Пижама атласная</a> (женский раздел)<br>ID: <code>1</code>`;
const pinVs = parseCaptionHtml(htmlVs, { postId: 11 });
assert.ok(pinVs.description.includes("пижама Виктория Сикрет"));
assert.ok(!pinVs.description.includes("жми"));

const htmlRayBan = `<b>Ray-Ban</b> 🇺🇸<br><br><a href="https://www.ray-ban.com/p/aviator">Очки солнцезащитные Aviator</a><br>ID: <code>2</code>`;
const pinRayBan = parseCaptionHtml(htmlRayBan, { postId: 12 });
assert.ok(pinRayBan.description.includes("Ray-Ban Aviator"));
assert.strictEqual(pinRayBan.board, BOARDS.glasses);

const htmlDress = `<b>Unknown Brand</b> 🇺🇸<br><br><a href="https://www.example.com/p/dress">Платье</a> (женский раздел)<br>ID: <code>3</code>`;
const pinDress = parseCaptionHtml(htmlDress, { postId: 13 });
assert.ok(pinDress.description.includes("капсульный гардероб"));

const htmlArmani = `<b>Armani</b> 🇺🇸<br><br><a href="https://www.giorgioarmanibeauty-usa.com/p/f">Тональная основа для лица</a><br>ID: <code>4</code>`;
const pinArmani = parseCaptionHtml(htmlArmani, { postId: 14 });
assert.ok(pinArmani.description.includes("тональная основа Armani"));
assert.strictEqual(pinArmani.board, BOARDS.cosmetics);

const htmlDknyShoes = `<b>DKNY</b> 🇺🇸<br><br><a href="https://www.dkny.com/p/sneakers">Кроссовки</a> (женский раздел)<br>ID: <code>5</code>`;
const pinDknyShoes = parseCaptionHtml(htmlDknyShoes, { postId: 15 });
assert.ok(pinDknyShoes.description.includes("кроссовки DKNY"));
assert.strictEqual(pinDknyShoes.board, BOARDS.womenShoes);

assert.ok(
  inferDescription({
    brand: "Adidas",
    product: { name: "Кроссовки Handball Spezial", type: "кроссовки", boardKind: "обувь", model: "Handball Spezial" },
    audience: { key: "unisex" },
  }).includes("Adidas Spezial")
);
assert.ok(
  inferDescription({
    brand: "Adidas",
    product: { name: "Кроссовки Gazelle", type: "кроссовки", boardKind: "обувь", model: "Gazelle" },
    audience: { key: "unisex" },
  }).includes("Adidas Gazelle")
);
assert.strictEqual(
  inferDescription({
    brand: "Adidas",
    product: { name: "Кроссовки Samba", type: "кроссовки", boardKind: "обувь", model: "Samba" },
    audience: { key: "unisex" },
  }),
  MISSING_DESCRIPTION
);
assert.ok(
  inferDescription({
    brand: "DKNY",
    product: { name: "Сумка", type: "сумка", boardKind: "сумки" },
    audience: { key: "women" },
  }).includes("сумка DKNY")
);
assert.ok(
  inferDescription({
    brand: "DKNY",
    product: { name: "Платье", type: "платье", boardKind: "одежда" },
    audience: { key: "women" },
  }).includes("DKNY платья")
);

assert.strictEqual(BOARDS.accessories, "Аксессуары");
assert.strictEqual(BOARDS.womenShoes, "Женская обувь");
assert.strictEqual(BOARDS.womenClothes, "Женская одежда");
assert.strictEqual(BOARDS.cosmetics, "Косметика для лица и тела");
assert.strictEqual(BOARDS.swimwear, "Купальник");
assert.strictEqual(BOARDS.jackets, "Куртки");
assert.strictEqual(BOARDS.menShoes, "Мужская обувь");
assert.strictEqual(BOARDS.menClothes, "Мужская одежда, бренды из США, купим и доставим");
assert.strictEqual(BOARDS.underwear, "Нижнее белье и домашняя одежда");
assert.strictEqual(BOARDS.reviews, "Отзывы");
assert.strictEqual(BOARDS.glasses, "Очки");
assert.strictEqual(BOARDS.bags, "Сумки женские и мужские");
assert.strictEqual(Object.keys(BOARDS).length, 12);

assert.deepStrictEqual(collectPostIds(["https://t.me/kupim_v_usa/47039", "47039", "abc"]), [47039]);
assert.ok(/pin-templates[/\\]47039$/.test(pinDir(47039)));
assert.throws(() => pinDir("../etc"));

const pruneRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kupim-prune-"));
const oldDir = path.join(pruneRoot, "11");
const freshDir = path.join(pruneRoot, "12");
const keepDir = path.join(pruneRoot, "13");
const otherDir = path.join(pruneRoot, "notes");
fs.mkdirSync(oldDir);
fs.mkdirSync(freshDir);
fs.mkdirSync(keepDir);
fs.mkdirSync(otherDir);
fs.writeFileSync(path.join(oldDir, "data.json"), "{}\n");
fs.writeFileSync(path.join(otherDir, "keep.txt"), "x");
const now = Date.now();
fs.utimesSync(oldDir, new Date(now - 6 * 60 * 60 * 1000), new Date(now - 6 * 60 * 60 * 1000));
fs.utimesSync(keepDir, new Date(now - 6 * 60 * 60 * 1000), new Date(now - 6 * 60 * 60 * 1000));
const pruned = pruneOldPinDirs({
  root: pruneRoot,
  now,
  maxAgeMs: 5 * 60 * 60 * 1000,
  keepIds: [13],
});
assert.deepStrictEqual(pruned.removed, [11]);
assert.ok(!fs.existsSync(oldDir));
assert.ok(fs.existsSync(freshDir));
assert.ok(fs.existsSync(keepDir));
assert.ok(fs.existsSync(otherDir));
assert.deepStrictEqual(
  pruneOldPinDirs({ root: pruneRoot, now, keepIds: { 13: true } }).removed,
  [13]
);
assert.throws(() => pruneOldPinDirs({ root: "" }));
assert.throws(() => pruneOldPinDirs({ root: 1 }));
const outside = path.join(pruneRoot, "outside-target");
const linkDir = path.join(pruneRoot, "14");
fs.mkdirSync(outside);
try {
  fs.symlinkSync(outside, linkDir, process.platform === "win32" ? "junction" : "dir");
} catch {
  /* no symlink permission */
}
if (fs.existsSync(linkDir)) {
  try {
    fs.utimesSync(linkDir, new Date(now - 6 * 60 * 60 * 1000), new Date(now - 6 * 60 * 60 * 1000));
  } catch {
    /* junction mtime may be immutable */
  }
  pruneOldPinDirs({
    root: pruneRoot,
    now,
    maxAgeMs: 5 * 60 * 60 * 1000,
  });
  assert.ok(fs.existsSync(outside));
}
const capRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kupim-prune-cap-"));
for (let i = 1; i <= PIN_DIR_MAX_PRUNE + 2; i++) {
  const dir = path.join(capRoot, String(i));
  fs.mkdirSync(dir);
  fs.utimesSync(dir, new Date(now - 6 * 60 * 60 * 1000), new Date(now - 6 * 60 * 60 * 1000));
}
assert.strictEqual(
  pruneOldPinDirs({ root: capRoot, now, maxAgeMs: 5 * 60 * 60 * 1000 }).removed.length,
  PIN_DIR_MAX_PRUNE
);
fs.rmSync(capRoot, { recursive: true, force: true });
fs.rmSync(pruneRoot, { recursive: true, force: true });
assert.ok(isJpeg(Buffer.from([0xff, 0xd8, 0xff, 0x00])));
assert.ok(!isJpeg(Buffer.from([0x89, 0x50, 0x4e, 0x47])));

const builtEmpty = buildReplyWithJson("Сохранил:\nhttps://t.me/kupim_v_usa/1", []);
assert.strictEqual(builtEmpty.text, "Сохранил:\nhttps://t.me/kupim_v_usa/1");
assert.deepStrictEqual(builtEmpty.entities, []);
const built = buildReplyWithJson("Сохранил:\nhttps://t.me/kupim_v_usa/1", [
  {
    title: "</code></pre><script>alert(1)</script>",
    description: "a&b",
    link: "https://t.me/kupim_v_usa/1",
  },
]);
assert.ok(built.text.startsWith("Сохранил:\nhttps://t.me/kupim_v_usa/1\n\n"));
assert.ok(built.text.includes('"title": "</code></pre><script>alert(1)</script>"'));
assert.ok(built.text.includes("a&b"));
assert.strictEqual(built.entities.length, 1);
assert.strictEqual(built.entities[0].type, "pre");
assert.strictEqual(built.entities[0].language, "json");
assert.strictEqual(built.entities[0].offset, "Сохранил:\nhttps://t.me/kupim_v_usa/1\n\n".length);
assert.strictEqual(built.entities[0].length, built.text.length - built.entities[0].offset);
assert.ok(formatPinJson({ title: "x" }).includes('"title": "x"'));

const previewHtml =
  '<div data-post="kupim_v_usa/10"></div><div data-post="other/99"></div><div data-post="kupim_v_usa/12"></div>';
assert.deepStrictEqual(parsePreviewPostIds(previewHtml), [10, 12]);
assert.strictEqual(maxPreviewPostId(previewHtml), 12);
assert.strictEqual(maxPreviewPostId(""), null);
assert.deepStrictEqual(listRecentCandidateIds(5, 3), [5, 4, 3]);
assert.deepStrictEqual(listRecentCandidateIds(2, 100), [2, 1]);
assert.deepStrictEqual(listRecentCandidateIds(0, 10), []);
const fakeStorage = { has(id) { return id === 4 || id === 5; } };
assert.strictEqual(pickUnusedId([5, 4, 3], fakeStorage, () => 0), 3);
assert.strictEqual(pickUnusedId([5, 4], fakeStorage, () => 0), null);
assert.ok(isOurChannelPost({ chat: { type: "channel", username: "kupim_v_usa" }, message_id: 7 }));
assert.ok(!isOurChannelPost({ chat: { type: "channel", username: "other" }, message_id: 7 }));
assert.ok(!isOurChannelPost({ chat: { type: "supergroup", username: "kupim_v_usa" }, message_id: 7 }));
assert.strictEqual(postIdFromChannelPost({ chat: { type: "channel", username: "kupim_v_usa" }, message_id: 7 }), 7);
assert.strictEqual(postIdFromChannelPost({ chat: { type: "channel", username: "evil" }, message_id: 7 }), null);
assert.deepStrictEqual(sanitizeState({ enabled: false, latestId: 9 }), { latestId: 9 });
assert.deepStrictEqual(sanitizeState({ latestId: "1" }), { latestId: null });
const remembered = rememberLatestId({ latestId: 10 }, 12);
assert.strictEqual(remembered.latestId, 12);

const autoDir = fs.mkdtempSync(path.join(os.tmpdir(), "kupim-auto-"));
const autoFile = path.join(autoDir, "auto.json");
assert.strictEqual(loadAutoState(autoFile).latestId, null);
const addedIds = [];
const autoStorage = {
  has(id) { return addedIds.includes(id); },
  add({ postId }) {
    if (addedIds.includes(postId)) return false;
    addedIds.push(postId);
    return true;
  },
};
runAutoImport({
  storage: autoStorage,
  state: { latestId: 20 },
  fetchHtml: async () => '<div data-post="kupim_v_usa/20"></div>',
  exportPost: async (id) => {
    if (id === 20) throw new Error("нет фото");
    return { pin: { title: String(id) } };
  },
  pruneOldPinDirs: () => ({ removed: [11] }),
}).then((result) => {
  assert.strictEqual(result.ok, true);
  assert.ok(result.postId !== 20);
  assert.ok(addedIds.includes(result.postId));
  assert.deepStrictEqual(result.pruned, [11]);
  fs.rmSync(autoDir, { recursive: true, force: true });
  console.log("ok");
}).catch((err) => {
  fs.rmSync(autoDir, { recursive: true, force: true });
  console.error(err);
  process.exit(1);
});
