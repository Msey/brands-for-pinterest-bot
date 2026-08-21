"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { extractFromMessage, extractPosts, isValidPostId } = require("./links");
const { PostStorage } = require("./storage");

assert.deepStrictEqual(extractPosts(""), []);
assert.deepStrictEqual(extractPosts(null), []);
assert.deepStrictEqual(extractPosts(123), []);
assert.deepStrictEqual(extractPosts("https://t.me/other/1"), []);
assert.deepStrictEqual(extractPosts("https://t.me/kupim_v_usa/0"), []);
assert.deepStrictEqual(extractPosts("https://t.me/kupim_v_usa/-5"), []);
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

assert.deepStrictEqual(
  extractFromMessage({
    text: "бренд",
    entities: [{ type: "text_link", offset: 0, length: 5, url: "https://t.me/kupim_v_usa/15" }],
  }),
  [{ postId: 15, url: "https://t.me/kupim_v_usa/15" }]
);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kupim-bot-"));
const file = path.join(dir, "posts.jsonl");
const storage = new PostStorage(file);

assert.strictEqual(storage.count(), 0);
assert.deepStrictEqual(storage.listRecent(0), []);
assert.deepStrictEqual(storage.listRecent(-1), []);
assert.strictEqual(storage.add({ url: "https://t.me/kupim_v_usa/1", postId: 1, fromUserId: 7 }), true);
assert.strictEqual(storage.add({ url: "https://t.me/kupim_v_usa/1", postId: 1 }), false);
assert.strictEqual(storage.add({ url: "", postId: 2 }), false);
assert.strictEqual(storage.add({ url: "https://t.me/kupim_v_usa/3", postId: 0 }), false);
assert.strictEqual(storage.count(), 1);
assert.strictEqual(storage.listRecent(10)[0].post_id, 1);

fs.appendFileSync(file, "not-json\n[]\n", "utf8");
assert.strictEqual(storage.listRecent(10).length, 1);

fs.rmSync(dir, { recursive: true, force: true });
console.log("ok");
