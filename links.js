"use strict";

const CHANNEL = "kupim_v_usa";
const URL_RE = new RegExp(
  `(?:https?://)?(?:t\\.me|telegram\\.me|telegram\\.dog)/(?:s/)?${CHANNEL}/(\\d+)`,
  "gi"
);

function isValidPostId(id) {
  return Number.isInteger(id) && id > 0 && Number.isSafeInteger(id);
}

function extractPosts(text) {
  if (typeof text !== "string" || !text) return [];
  const found = [];
  const seen = new Set();
  const re = new RegExp(URL_RE.source, URL_RE.flags);
  let match;
  while ((match = re.exec(text)) !== null) {
    const postId = Number(match[1]);
    if (!isValidPostId(postId) || seen.has(postId)) continue;
    seen.add(postId);
    found.push({ postId, url: `https://t.me/${CHANNEL}/${postId}` });
  }
  return found;
}

function sliceEntity(text, entity) {
  if (!text || !entity || typeof entity.offset !== "number" || typeof entity.length !== "number") {
    return "";
  }
  if (entity.offset < 0 || entity.length <= 0) return "";
  return text.substring(entity.offset, entity.offset + entity.length);
}

function extractFromMessage(msg) {
  if (!msg || typeof msg !== "object") return [];
  const chunks = [];
  if (msg.text) chunks.push(msg.text);
  if (msg.caption) chunks.push(msg.caption);

  const body = msg.text || msg.caption || "";
  const entities = [].concat(msg.entities || [], msg.caption_entities || []);
  for (const entity of entities) {
    if (!entity) continue;
    if (entity.type === "url") {
      chunks.push(sliceEntity(body, entity));
    } else if (entity.type === "text_link" && entity.url) {
      chunks.push(entity.url);
    }
  }

  const seen = new Set();
  const found = [];
  for (const chunk of chunks) {
    for (const post of extractPosts(chunk)) {
      if (seen.has(post.postId)) continue;
      seen.add(post.postId);
      found.push(post);
    }
  }
  return found;
}

module.exports = {
  CHANNEL,
  extractFromMessage,
  extractPosts,
  isValidPostId,
};
