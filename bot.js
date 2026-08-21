"use strict";

const path = require("path");
const TelegramBot = require("node-telegram-bot-api");
const { PostStorage } = require("./storage");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const CHANNEL = "kupim_v_usa";
const URL_RE = new RegExp(
  `(?:https?://)?(?:t\\.me|telegram\\.me|telegram\\.dog)/(?:s/)?${CHANNEL}/(\\d+)`,
  "gi"
);

const storage = new PostStorage(path.join(__dirname, "data", "posts.jsonl"));

function extractPosts(text) {
  if (!text) return [];
  const found = [];
  const seen = new Set();
  const re = new RegExp(URL_RE.source, URL_RE.flags);
  let match;
  while ((match = re.exec(text)) !== null) {
    const postId = Number(match[1]);
    if (seen.has(postId)) continue;
    seen.add(postId);
    found.push({ postId, url: `https://t.me/${CHANNEL}/${postId}` });
  }
  return found;
}

function main() {
  const token = (process.env.BOT_TOKEN || "").trim();
  if (!token) {
    console.error("Нет BOT_TOKEN. Скопируйте .env.example в .env и впишите токен.");
    process.exit(1);
  }

  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/^\/start\b/, async (msg) => {
    if (msg.chat.type !== "private") return;
    await bot.sendMessage(
      msg.chat.id,
      "Пришлите ссылку на пост из t.me/kupim_v_usa — сохраню её на этом компьютере.\n\n" +
        "Примеры:\n" +
        "https://t.me/kupim_v_usa/123\n" +
        "t.me/kupim_v_usa/123\n\n" +
        "/list — последние 10 ссылок\n" +
        "/count — сколько уже сохранено"
    );
  });

  bot.onText(/^\/list\b/, async (msg) => {
    if (msg.chat.type !== "private") return;
    const records = storage.listRecent(10);
    if (!records.length) {
      await bot.sendMessage(msg.chat.id, "Пока пусто. Пришлите ссылку на пост.");
      return;
    }
    const lines = records.map((item) => `${item.post_id}: ${item.url}`);
    await bot.sendMessage(msg.chat.id, "Последние ссылки:\n" + lines.join("\n"));
  });

  bot.onText(/^\/count\b/, async (msg) => {
    if (msg.chat.type !== "private") return;
    await bot.sendMessage(msg.chat.id, `Сохранено: ${storage.count()}`);
  });

  bot.on("message", async (msg) => {
    if (msg.chat.type !== "private") return;
    const text = msg.text || msg.caption || "";
    if (!text || text.startsWith("/")) return;

    const posts = extractPosts(text);
    if (!posts.length) {
      await bot.sendMessage(
        msg.chat.id,
        "Нужна ссылка на пост группы t.me/kupim_v_usa, например:\nhttps://t.me/kupim_v_usa/123"
      );
      return;
    }

    const added = [];
    const duplicates = [];
    for (const { postId, url } of posts) {
      const ok = storage.add({
        url,
        postId,
        fromUserId: msg.from.id,
        fromUsername: msg.from.username,
      });
      (ok ? added : duplicates).push(url);
    }

    const parts = [];
    if (added.length) parts.push("Сохранил:\n" + added.join("\n"));
    if (duplicates.length) parts.push("Уже было:\n" + duplicates.join("\n"));
    await bot.sendMessage(msg.chat.id, parts.join("\n\n"));
  });

  bot.on("polling_error", (err) => {
    console.error("polling_error:", err.message);
  });

  console.log("Бот запущен, жду сообщения в личке");
}

if (require.main === module) {
  main();
}

module.exports = { extractPosts };
