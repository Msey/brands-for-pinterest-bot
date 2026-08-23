"use strict";

const path = require("path");
const TelegramBot = require("node-telegram-bot-api");
const { CHANNEL } = require("./links");
const { PostStorage } = require("./storage");
const { exportPost } = require("./export-pin");
const { forgetPinsWithoutData, loadPinData } = require("./pin-dirs");
const { postIdFromChannelPost } = require("./channel-feed");
const { loadAutoState, rememberLatestId, runAutoImport, saveAutoState } = require("./auto-import");
const { commandPattern, createAccess, isValidBotToken } = require("./access");
const { RateLimiter } = require("./rate-limit");
const { createHandlers, createMessenger, guardPrivate } = require("./bot-handlers");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const RATE_WINDOW_MS = 60 * 1000;
const AUTO_INTERVAL_MS = 60 * 60 * 1000;
const AUTO_FIRST_DELAY_MS = 60 * 1000;
const AUTO_STATE_FILE = path.join(__dirname, "data", "auto.json");

function createTelegramBot(token) {
  return new TelegramBot(token, {
    filepath: false,
    onlyFirstMatch: true,
    request: {
      forever: false,
      pool: { maxSockets: 2 },
    },
    polling: {
      interval: 400,
      params: {
        timeout: 20,
        limit: 10,
        allowed_updates: ["message", "channel_post"],
      },
    },
  });
}

function startAutoImport({ storage, state, persist }) {
  let running = false;
  async function tick() {
    if (running) return;
    running = true;
    try {
      await runAutoImport({ storage, state, exportPost });
      persist();
    } catch (err) {
      console.error("auto", err && err.message ? err.message : err);
    } finally {
      running = false;
    }
  }
  setTimeout(() => {
    tick();
    setInterval(tick, AUTO_INTERVAL_MS);
  }, AUTO_FIRST_DELAY_MS);
}

function main(options) {
  const opts = options || {};
  const token = (opts.token || process.env.BOT_TOKEN || "").trim();
  if (!isValidBotToken(token)) {
    console.error("Нет корректного BOT_TOKEN. Скопируйте .env.example в .env и впишите токен.");
    process.exit(1);
  }
  process.title = "Бот kupim_v_usa";

  const storage =
    opts.storage || new PostStorage(path.join(__dirname, "data", "posts.jsonl"));
  const access = opts.access || createAccess(process.env.BOT_ALLOW_USER_IDS);
  const limiter = opts.rateLimiter || new RateLimiter({ windowMs: RATE_WINDOW_MS, max: 30 });
  const autoState = opts.autoState || loadAutoState(AUTO_STATE_FILE);

  try {
    const gone = forgetPinsWithoutData(storage);
    if (gone.length) {
      console.log("sync: нет папок, убраны из базы", gone.join(", "));
    }
  } catch (err) {
    console.error("sync_pins", err && err.message ? err.message : err);
  }

  function persistAutoState() {
    try {
      saveAutoState(autoState, AUTO_STATE_FILE);
    } catch (err) {
      console.error("auto_state", err && err.message ? err.message : err);
    }
  }

  const bot = opts.bot || createTelegramBot(token);
  const messenger = createMessenger(bot);
  const onPrivate = guardPrivate(access, limiter, messenger);
  const handlers = createHandlers({
    storage,
    exportPost: opts.exportPost || exportPost,
    loadPin: opts.loadPin || loadPinData,
    messenger,
    channel: CHANNEL,
    access,
  });

  setInterval(() => limiter.sweep(), RATE_WINDOW_MS).unref();

  bot.onText(commandPattern("start"), onPrivate(handlers.start));
  bot.onText(commandPattern("list"), onPrivate(handlers.list));
  bot.onText(commandPattern("count"), onPrivate(handlers.count));
  bot.on("message", onPrivate(handlers.saveLinks));
  bot.on("channel_post", (msg) => {
    const postId = postIdFromChannelPost(msg);
    if (postId == null) return;
    rememberLatestId(autoState, postId);
    persistAutoState();
  });
  bot.on("polling_error", (err) => {
    console.error("polling_error:", err && err.message ? err.message : err);
  });

  if (!opts.skipAutoImport) {
    startAutoImport({ storage, state: autoState, persist: persistAutoState });
  }

  console.log("Бот запущен, жду сообщения в личке");
  return { bot, storage, handlers };
}

if (require.main === module) {
  main();
}

module.exports = { main };
