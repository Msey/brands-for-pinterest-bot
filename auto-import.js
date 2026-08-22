"use strict";

const fs = require("fs");
const path = require("path");
const { canonicalUrl, isValidPostId } = require("./links");
const { exportPost } = require("./export-pin");
const {
  PREVIEW_WINDOW,
  fetchLatestPostId,
  listRecentCandidateIds,
  pickUnusedId,
} = require("./channel-feed");

const MAX_ATTEMPTS = 8;
const DEFAULT_STATE = { enabled: true, latestId: null };

function defaultStatePath() {
  return path.join(__dirname, "data", "auto.json");
}

function sanitizeState(raw) {
  const enabled = !(raw && raw.enabled === false);
  const latestId = raw && isValidPostId(raw.latestId) ? raw.latestId : null;
  return { enabled, latestId };
}

function loadAutoState(filePath) {
  const target = filePath || defaultStatePath();
  try {
    const raw = fs.readFileSync(target, "utf8");
    if (raw.length > 4096) return { ...DEFAULT_STATE };
    return sanitizeState(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveAutoState(state, filePath) {
  const target = filePath || defaultStatePath();
  const clean = sanitizeState(state);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(clean, null, 2) + "\n", "utf8");
  return clean;
}

function rememberLatestId(state, postId) {
  if (!isValidPostId(postId)) return state;
  if (!isValidPostId(state.latestId) || postId > state.latestId) {
    state.latestId = postId;
  }
  return state;
}

async function resolveLatestId(state, fetchHtml) {
  let latest = isValidPostId(state.latestId) ? state.latestId : null;
  try {
    const fromPreview = await fetchLatestPostId(fetchHtml);
    if (isValidPostId(fromPreview)) {
      latest = latest == null ? fromPreview : Math.max(latest, fromPreview);
    }
  } catch (err) {
    console.error("auto_preview", err && err.message ? err.message : err);
  }
  if (isValidPostId(latest)) state.latestId = latest;
  return latest;
}

async function runAutoImport(options) {
  const storage = options && options.storage;
  const state = options && options.state;
  const exportFn = options && options.exportPost ? options.exportPost : exportPost;
  const fetchHtml = options && options.fetchHtml;
  if (!storage || typeof storage.has !== "function" || typeof storage.add !== "function") {
    return { ok: false, reason: "no_storage" };
  }
  if (!state || typeof state !== "object") {
    return { ok: false, reason: "no_state" };
  }

  const latest = await resolveLatestId(state, fetchHtml);
  if (!isValidPostId(latest)) {
    console.log("auto: нет latest id");
    return { ok: false, reason: "no_latest" };
  }

  const candidates = listRecentCandidateIds(latest, PREVIEW_WINDOW);
  const tried = new Set();
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const postId = pickUnusedId(candidates, storage, Math.random, tried);
    if (postId == null) {
      console.log("auto: нет свободных id в окне");
      return { ok: false, reason: "exhausted" };
    }
    tried.add(postId);
    try {
      const result = await exportFn(postId);
      const added = storage.add({
        url: canonicalUrl(postId),
        postId,
      });
      if (!added) continue;
      console.log("auto: сохранён", postId);
      return { ok: true, postId, pin: result && result.pin };
    } catch (err) {
      console.error("auto_export", postId, err && err.message ? err.message : err);
    }
  }
  return { ok: false, reason: "attempts_failed" };
}

module.exports = {
  DEFAULT_STATE,
  MAX_ATTEMPTS,
  loadAutoState,
  rememberLatestId,
  runAutoImport,
  sanitizeState,
  saveAutoState,
};
