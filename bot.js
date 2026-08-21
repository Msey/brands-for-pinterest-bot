"use strict";

const path = require("path");
const TelegramBot = require("node-telegram-bot-api");
const { CHANNEL, extractFromMessage } = require("./links");
const { PostStorage } = require("./storage");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const LIST_LIMIT = 10;
const TG_MAX_LEN = 4000;

const storage = new PostStorage(path.join(__dirname, "data", "posts.jsonl"));

function isPrivateChat(msg) {
  return Boolean(msg && msg.chat && msg.chat.type === "private");
}

function isCommandText(text) {
  return typeof text === "string" && text.startsWith("/");
}

async function reply(bot, chatId, text) {
  if (chatId == null || !text) return;
  for (let i = 0; i < text.length; i += TG_MAX_LEN) {
    await bot.sendMessage(chatId, text.slice(i, i + TG_MAX_LEN));
  }
}

function onPrivate(bot, handler) {
  return async (msg) => {
    if (!isPrivateChat(msg)) return;
    try {
      await handler(msg);
    } catch (err) {
      console.error(err);
      try {
        await reply(
          bot,
          msg.chat.id,
          "Не получилось обработать сообщение. Проверьте диск и попробуйте ещё раз."
        );
      } catch (sendErr) {
        console.error(sendErr);
      }
    }
  };
}

function commandPattern(name) {
  return new RegExp(`^/${name}(?:@\\w+)?(?:\\s|$)`, "i");
}

function main() {
  const token = (process.env.BOT_TOKEN || "").trim();
  if (!token) {
    console.error("Нет BOT_TOKEN. Скопируйте .env.example в .env и впишите токен.");
    process.exit(1);
  }

  const bot = new TelegramBot(token, { polling: true });

  bot.onText(
    commandPattern("start"),
    onPrivate(bot, async (msg) => {
      await reply(
        bot,
        msg.chat.id,
        "Пришлите ссылку на пост из t.me/" +
          CHANNEL +
          " — сохраню её на этом компьютере.\n\n" +
          "Примеры:\n" +
          "https://t.me/" +
          CHANNEL +
          "/123\n" +
          "t.me/" +
          CHANNEL +
          "/123\n\n" +
          "/list — последние 10 ссылок\n" +
          "/count — сколько уже сохранено"
      );
    })
  );

  bot.onText(
    commandPattern("list"),
    onPrivate(bot, async (msg) => {
      const records = storage.listRecent(LIST_LIMIT);
      if (!records.length) {
        await reply(bot, msg.chat.id, "Пока пусто. Пришлите ссылку на пост.");
        return;
      }
      const lines = records.map((item) => `${item.post_id}: ${item.url}`);
      await reply(bot, msg.chat.id, "Последние ссылки:\n" + lines.join("\n"));
    })
  );

  bot.onText(
    commandPattern("count"),
    onPrivate(bot, async (msg) => {
      await reply(bot, msg.chat.id, `Сохранено: ${storage.count()}`);
    })
  );

  bot.on(
    "message",
    onPrivate(bot, async (msg) => {
      const text = msg.text || msg.caption || "";
      if (isCommandText(text)) return;

      const posts = extractFromMessage(msg);
      if (!posts.length) {
        await reply(
          bot,
          msg.chat.id,
          "Нужна ссылка на пост группы t.me/" +
            CHANNEL +
            ", например:\nhttps://t.me/" +
            CHANNEL +
            "/123"
        );
        return;
      }

      const added = [];
      const duplicates = [];
      const from = msg.from || {};
      for (const { postId, url } of posts) {
        const ok = storage.add({
          url,
          postId,
          fromUserId: from.id,
          fromUsername: from.username,
        });
        (ok ? added : duplicates).push(url);
      }

      const parts = [];
      if (added.length) parts.push("Сохранил:\n" + added.join("\n"));
      if (duplicates.length) parts.push("Уже было:\n" + duplicates.join("\n"));
      await reply(bot, msg.chat.id, parts.join("\n\n"));
    })
  );

  bot.on("polling_error", (err) => {
    console.error("polling_error:", err && err.message ? err.message : err);
  });

  console.log("Бот запущен, жду сообщения в личке");
}

if (require.main === module) {
  main();
}

module.exports = { main };
