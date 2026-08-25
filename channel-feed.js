"use strict";

const { CHANNEL, isOurChannelChat, isValidPostId, parsePostIdToken } = require("./links");
const { fetchBuffer } = require("./http-fetch");

const PREVIEW_WINDOW = 100;
const MAX_PREVIEW_BYTES = 512 * 1024;
const PREVIEW_URL = "https://t.me/s/" + CHANNEL;
const DATA_POST_RE = new RegExp(`data-post="${CHANNEL}/(\\d{1,16})"`, "gi");

function parsePreviewPostIds(html) {
  if (typeof html !== "string" || !html) return [];
  const slice = html.length > MAX_PREVIEW_BYTES ? html.slice(0, MAX_PREVIEW_BYTES) : html;
  const ids = [];
  const seen = new Set();
  const re = new RegExp(DATA_POST_RE.source, DATA_POST_RE.flags);
  let match;
  while ((match = re.exec(slice)) !== null) {
    const postId = parsePostIdToken(match[1]);
    if (postId === null || seen.has(postId)) continue;
    seen.add(postId);
    ids.push(postId);
  }
  return ids;
}

function maxPreviewPostId(html) {
  const ids = parsePreviewPostIds(html);
  if (!ids.length) return null;
  return ids.reduce((max, id) => (id > max ? id : max), ids[0]);
}

function listRecentCandidateIds(latest, limit) {
  if (!isValidPostId(latest)) return [];
  let n = Math.floor(Number(limit));
  if (!Number.isFinite(n) || n <= 0) n = PREVIEW_WINDOW;
  if (n > PREVIEW_WINDOW) n = PREVIEW_WINDOW;
  const ids = [];
  for (let i = 0; i < n && latest - i > 0; i++) {
    ids.push(latest - i);
  }
  return ids;
}

function unusedCandidateIds(ids, storage, exclude) {
  const skip = exclude instanceof Set ? exclude : new Set();
  if (!Array.isArray(ids) || !storage || typeof storage.has !== "function") return [];
  return ids.filter((id) => isValidPostId(id) && !storage.has(id) && !skip.has(id));
}

function pickUnusedId(ids, storage, rng, exclude) {
  const unused = unusedCandidateIds(ids, storage, exclude);
  if (!unused.length) return null;
  const roll = typeof rng === "function" ? rng() : Math.random();
  const index = Math.floor(Math.max(0, Math.min(0.999999, Number(roll) || 0)) * unused.length);
  return unused[index];
}

function isOurChannelPost(msg) {
  if (!msg || !msg.chat || msg.chat.type !== "channel") return false;
  return isOurChannelChat(msg.chat);
}

function postIdFromChannelPost(msg) {
  if (!isOurChannelPost(msg)) return null;
  return isValidPostId(msg.message_id) ? msg.message_id : null;
}

async function fetchLatestPostId(fetchHtml) {
  const getter = typeof fetchHtml === "function" ? fetchHtml : defaultFetchPreview;
  const html = await getter(PREVIEW_URL);
  return maxPreviewPostId(html);
}

async function defaultFetchPreview(url) {
  if (url !== PREVIEW_URL) {
    throw new Error("Разрешена только публичная лента канала");
  }
  const buf = await fetchBuffer(url, MAX_PREVIEW_BYTES);
  return buf.toString("utf8");
}

module.exports = {
  PREVIEW_URL,
  PREVIEW_WINDOW,
  fetchLatestPostId,
  isOurChannelPost,
  listRecentCandidateIds,
  maxPreviewPostId,
  parsePreviewPostIds,
  pickUnusedId,
  postIdFromChannelPost,
  unusedCandidateIds,
};
