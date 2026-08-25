"use strict";

const { CHANNEL, extractFromMessage } = require("./links");
const { TG_MAX_LEN, buildReplyWithJson } = require("./tg-html");

const LIST_LIMIT = 10;

function startHelpText(channel) {
  const name = channel || CHANNEL;
  return (
    "Пришлите ссылку на пост из t.me/" +
    name +
    " или перешлите пост из канала — сохраню ссылку и папку с data.json и фото для Pinterest.\n\n" +
    "Примеры:\n" +
    "https://t.me/" +
    name +
    "/123\n" +
    "t.me/" +
    name +
    "/123\n" +
    "или «Переслать» пост из @" +
    name +
    "\n\n" +
    "/list — последние 10 ссылок\n" +
    "/count — сколько уже сохранено"
  );
}

function needLinkText(channel) {
  const name = channel || CHANNEL;
  return (
    "Нужна ссылка на пост t.me/" +
    name +
    " или перешлите пост из этого канала, например:\nhttps://t.me/" +
    name +
    "/123"
  );
}

function createMessenger(bot) {
  async function reply(chatId, text) {
    if (!Number.isFinite(chatId) || !text) return;
    const payload = { disable_web_page_preview: true };
    for (let i = 0; i < text.length; i += TG_MAX_LEN) {
      await bot.sendMessage(chatId, text.slice(i, i + TG_MAX_LEN), payload);
    }
  }

  async function replyWithPinJson(chatId, summary, pins) {
    const payload = buildReplyWithJson(summary, pins);
    if (!payload.text) return;
    try {
      await bot.sendMessage(chatId, payload.text, {
        disable_web_page_preview: true,
        entities: payload.entities,
      });
    } catch (err) {
      console.error("reply_json", err && err.message ? err.message : err);
      await reply(chatId, payload.text);
    }
  }

  return { reply, replyWithPinJson };
}

function guardPrivate(access, limiter, messenger) {
  return (handler) => async (msg) => {
    if (!access.isPrivateChat(msg)) return;
    if (!access.isAllowedUser(msg)) {
      try {
        await messenger.reply(msg.chat.id, "Нет доступа.");
      } catch (err) {
        console.error(err);
      }
      return;
    }
    if (limiter.tooMany(msg.from && msg.from.id)) {
      try {
        await messenger.reply(msg.chat.id, "Слишком много запросов. Подождите минуту.");
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
        await messenger.reply(msg.chat.id, text);
      } catch (sendErr) {
        console.error(sendErr);
      }
    }
  };
}

function createHandlers(deps) {
  const storage = deps.storage;
  const exportPost = deps.exportPost;
  const loadPin = deps.loadPin;
  const messenger = deps.messenger;
  const channel = deps.channel || CHANNEL;
  const listLimit = deps.listLimit || LIST_LIMIT;
  const access = deps.access;

  return {
    async start(msg) {
      await messenger.reply(msg.chat.id, startHelpText(channel));
    },

    async list(msg) {
      const records = storage.listRecent(listLimit, msg.from && msg.from.id);
      if (!records.length) {
        await messenger.reply(msg.chat.id, "Пока пусто. Пришлите ссылку или перешлите пост.");
        return;
      }
      const lines = records.map((item) => `${item.post_id}: ${item.url}`);
      await messenger.reply(msg.chat.id, "Последние ссылки:\n" + lines.join("\n"));
    },

    async count(msg) {
      await messenger.reply(msg.chat.id, `Сохранено: ${storage.count(msg.from && msg.from.id)}`);
    },

    async saveLinks(msg) {
      const text = msg.text || msg.caption || "";
      if (access.isCommandText(text)) return;

      const posts = extractFromMessage(msg);
      if (!posts.length) {
        await messenger.reply(msg.chat.id, needLinkText(channel));
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
          const pin = (result && result.pin) || loadPin(postId);
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
      await messenger.replyWithPinJson(msg.chat.id, parts.join("\n\n"), exportedPins);
    },
  };
}

module.exports = {
  LIST_LIMIT,
  createHandlers,
  createMessenger,
  guardPrivate,
  needLinkText,
  startHelpText,
};
