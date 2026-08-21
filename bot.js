"use strict";

const path = require("path");
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const { CHANNEL, extractFromMessage } = require("./links");
const { PostStorage } = require("./storage");
const { exportPost, pinDir } = require("./export-pin");
const { TG_MAX_LEN, buildReplyWithJson } = require("./tg-html");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const LIST_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 30;

function parseAllowList(raw) {
  if (!raw || !String(raw).trim()) return null;
  const ids = String(raw)
    .split(/[\s,]+/)
    .map((part) => Number(part))
    .filter((id) => Number.isInteger(id) && id > 0 && Number.isSafeInteger(id));
  return ids.length ? new Set(ids) : null;
}

const storage = new PostStorage(path.join(__dirname, "data", "posts.jsonl"));
const rateHits = new Map();
const allowList = parseAllowList(process.env.BOT_ALLOW_USER_IDS);

function isPrivateChat(msg) {
  return Boolean(msg && msg.chat && msg.chat.type === "private" && Number.isFinite(msg.chat.id));
}

function isCommandText(text) {
  return typeof text === "string" && text.startsWith("/");
}

function isAllowedUser(msg) {
  if (!allowList) return true;
  const id = msg && msg.from && msg.from.id;
  return allowList.has(id);
}

function tooManyRequests(userId) {
  if (!userId) return true;
  const now = Date.now();
  if (rateHits.size >= 64) {
    for (const [key, slot] of rateHits) {
      if (now > slot.reset) rateHits.delete(key);
    }
  }
  let slot = rateHits.get(userId);
  if (!slot || now > slot.reset) {
    slot = { count: 0, reset: now + RATE_WINDOW_MS };
    rateHits.set(userId, slot);
  }
  slot.count += 1;
  return slot.count > RATE_MAX;
}

function isValidBotToken(token) {
  return /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(token);
}

function commandPattern(name) {
  const safe = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^/${safe}(?:@\\w+)?(?:\\s|$)`, "i");
}

async function reply(bot, chatId, text) {
  if (!Number.isFinite(chatId) || !text) return;
  const payload = {
    disable_web_page_preview: true,
  };
  for (let i = 0; i < text.length; i += TG_MAX_LEN) {
    await bot.sendMessage(chatId, text.slice(i, i + TG_MAX_LEN), payload);
  }
}

function loadPinFromDisk(postId) {
  try {
    const raw = fs.readFileSync(path.join(pinDir(postId), "data.json"), "utf8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    return data;
  } catch {
    return null;
  }
}

async function replyWithPinJson(bot, chatId, summary, pins) {
  const payload = buildReplyWithJson(summary, pins);
  if (!payload.text) return;
  try {
    await bot.sendMessage(chatId, payload.text, {
      disable_web_page_preview: true,
      entities: payload.entities,
    });
  } catch (err) {
    console.error("reply_json", err && err.message ? err.message : err);
    await reply(bot, chatId, payload.text);
  }
}

function onPrivate(bot, handler) {
  return async (msg) => {
    if (!isPrivateChat(msg)) return;
    if (!isAllowedUser(msg)) {
      try {
        await reply(bot, msg.chat.id, "Нет доступа.");
      } catch (err) {
        console.error(err);
      }
      return;
    }
    if (tooManyRequests(msg.from && msg.from.id)) {
      try {
        await reply(bot, msg.chat.id, "Слишком много запросов. Подождите минуту.");
      } catch (err) {
        console.error(err);
      }
      return;
    }
    try {
      await handler(msg);
    } catch (err) {
      console.error(err && err.code === "STORAGE_FULL" ? "storage full" : err);
      try {
        const text =
          err && err.code === "STORAGE_FULL"
            ? "Файл базы слишком большой, новые ссылки пока не сохраняю."
            : "Не получилось обработать сообщение. Проверьте диск и попробуйте ещё раз.";
        await reply(bot, msg.chat.id, text);
      } catch (sendErr) {
        console.error(sendErr);
      }
    }
  };
}

function main() {
  const token = (process.env.BOT_TOKEN || "").trim();
  if (!isValidBotToken(token)) {
    console.error("Нет корректного BOT_TOKEN. Скопируйте .env.example в .env и впишите токен.");
    process.exit(1);
  }
  process.title = "Бот kupim_v_usa";

  const bot = new TelegramBot(token, { polling: true });

  bot.onText(
    commandPattern("start"),
    onPrivate(bot, async (msg) => {
      await reply(
        bot,
        msg.chat.id,
        "Пришлите ссылку на пост из t.me/" +
          CHANNEL +
          " — сохраню ссылку и папку с data.json и фото для Pinterest.\n\n" +
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
      const records = storage.listRecent(LIST_LIMIT, msg.from && msg.from.id);
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
      await reply(bot, msg.chat.id, `Сохранено: ${storage.count(msg.from && msg.from.id)}`);
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
      const exportFailed = [];
      const exportedPins = [];
      const from = msg.from || {};
      for (const { postId, url } of posts) {
        const ok = storage.add({
          url,
          postId,
          fromUserId: from.id,
          fromUsername: from.username,
        });
        (ok ? added : duplicates).push(url);
        try {
          const result = await exportPost(postId);
          const pin = (result && result.pin) || loadPinFromDisk(postId);
          if (pin) exportedPins.push(pin);
        } catch (err) {
          console.error("export_pin", postId, err && err.message ? err.message : err);
          exportFailed.push(String(postId));
        }
      }

      const parts = [];
      if (added.length) parts.push("Сохранил:\n" + added.join("\n"));
      if (duplicates.length) parts.push("Уже было:\n" + duplicates.join("\n"));
      if (exportFailed.length) parts.push("Не удалось выгрузить фото:\n" + exportFailed.join("\n"));
      const summary = parts.join("\n\n");
      await replyWithPinJson(bot, msg.chat.id, summary, exportedPins);
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
