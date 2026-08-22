"use strict";

const fs = require("fs");
const path = require("path");
const { canonicalUrl, isValidPostId } = require("./links");
const { exportPost, forgetPinsWithoutData, pruneOldPinDirs } = require("./export-pin");
const {
  PREVIEW_WINDOW,
  fetchLatestPostId,
  listRecentCandidateIds,
  pickUnusedId,
} = require("./channel-feed");

const MAX_ATTEMPTS = 8;
const DEFAULT_STATE = { latestId: null };

function defaultStatePath() {
  return path.join(__dirname, "data", "auto.json");
}

function sanitizeState(raw) {
  const latestId = raw && isValidPostId(raw.latestId) ? raw.latestId : null;
  return { latestId };
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
  if (!state || typeof state !== "object") return { latestId: null };
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

function pruneAfterImport(prune, createdId, storage) {
  const keepIds = createdId != null ? [createdId] : [];
  const removed = [];
  try {
    const pruned = prune({ keepIds });
    const folders = pruned && Array.isArray(pruned.removed) ? pruned.removed : [];
    if (folders.length) {
      console.log("auto: удалены старые папки", folders.join(", "));
      removed.push(...folders);
    }
  } catch (err) {
    console.error("auto_prune", err && err.message ? err.message : err);
  }
  try {
    const forgotten = forgetPinsWithoutData(storage, { keepIds });
    if (forgotten.length) {
      console.log("auto: убраны из базы без папки", forgotten.join(", "));
      for (const id of forgotten) {
        if (!removed.includes(id)) removed.push(id);
      }
    }
  } catch (err) {
    console.error("auto_sync", err && err.message ? err.message : err);
  }
  return removed;
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

  const prune =
    options && typeof options.pruneOldPinDirs === "function"
      ? options.pruneOldPinDirs
      : pruneOldPinDirs;
  let createdId = null;
  const result = { ok: false, reason: "attempts_failed" };

  try {
    const latest = await resolveLatestId(state, fetchHtml);
    if (!isValidPostId(latest)) {
      console.log("auto: нет latest id");
      result.reason = "no_latest";
      return result;
    }

    const candidates = listRecentCandidateIds(latest, PREVIEW_WINDOW);
    const tried = new Set();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const postId = pickUnusedId(candidates, storage, Math.random, tried);
      if (postId == null) {
        console.log("auto: нет свободных id в окне");
        result.reason = "exhausted";
        return result;
      }
      tried.add(postId);
      try {
        const exported = await exportFn(postId);
        const added = storage.add({
          url: canonicalUrl(postId),
          postId,
        });
        if (!added) continue;
        createdId = postId;
        result.ok = true;
        delete result.reason;
        result.postId = postId;
        result.pin = exported && exported.pin;
        return result;
      } catch (err) {
        console.error("auto_export", postId, err && err.message ? err.message : err);
      }
    }
    return result;
  } finally {
    result.pruned = pruneAfterImport(prune, createdId, storage);
  }
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
