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
const { collectPostIds, formatPinJson, isJpeg, pinDir } = require("./export-pin");
const { extractPhotoUrl, isShopUrl, parseCaptionHtml, parseEmbedHtml } = require("./parse-post");
const { buildReplyWithJson } = require("./tg-html");

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

fs.appendFileSync(file, "not-json\n[]\n", "utf8");
assert.strictEqual(storage.listRecent(10).length, 3);

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
assert.ok(parsed47039.pin.description.includes("11800₽"));
assert.ok(parsed47039.pin.description.includes("723660"));
assert.ok(!parsed47039.pin.description.includes("zakaz_managers"));
assert.deepStrictEqual(parsed47039.pin.tags, ["nike", "кроссовки", "обувь", "унисекс"]);
assert.strictEqual(parsed47039.pin.board, undefined);

const html46991 = `<b>Calvin Klein</b> 🇺🇸<br><br><a href="https://www.calvinklein.us/en/jacket.html">Куртка</a> (мужской раздел)<br><b><s>21500₽</s> ➡️ 7800₽ + доставка</b><br>M, XL, 2XL<br><br>ID: <code>723414</code>`;
const pin46991 = parseCaptionHtml(html46991, { postId: 46991 });
assert.strictEqual(pin46991.title, "Calvin Klein — мужские куртка | оригинал из США");
assert.strictEqual(pin46991.link, "https://t.me/kupim_v_usa/46991");
assert.strictEqual(pin46991.board, "Мужская одежда");
assert.ok(pin46991.tags.includes("calvin klein"));
assert.ok(pin46991.tags.includes("куртка"));
assert.ok(pin46991.tags.includes("мужские"));
assert.ok(pin46991.description.includes("M, XL, 2XL"));

const html46874 = `<b>Timberland</b> 🇺🇸<br><br><a href="https://www.timberland.com/en-us/p/left">Худи слева</a> (мужской раздел)<br><b><s>8400₽</s> ➡️ 3000₽ + доставка</b><br><a href="https://www.timberland.com/en-us/p/right">Худи справа</a> (мужской раздел)<br><b><s>8400₽</s> ➡️ 2600₽ + доставка</b><br><br>ID: <code>721351</code>`;
const pin46874 = parseCaptionHtml(html46874, { postId: 46874 });
assert.strictEqual(pin46874.title, "Timberland — мужские худи | оригинал из США");
assert.strictEqual(pin46874.link, "https://t.me/kupim_v_usa/46874");
assert.ok(pin46874.description.includes("Худи справа"));
assert.strictEqual(pin46874.board, "Мужская одежда");

assert.deepStrictEqual(collectPostIds(["https://t.me/kupim_v_usa/47039", "47039", "abc"]), [47039]);
assert.ok(/pin-templates[/\\]47039$/.test(pinDir(47039)));
assert.throws(() => pinDir("../etc"));
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

console.log("ok");
