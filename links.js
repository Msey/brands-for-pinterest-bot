"use strict";

const CHANNEL = "kupim_v_usa";
const ALLOWED_HOSTS = new Set(["t.me", "www.t.me", "telegram.me", "www.telegram.me", "telegram.dog"]);
const MAX_TEXT_LEN = 4096;
const MAX_URL_LEN = 2048;
const MAX_POSTS_PER_MESSAGE = 20;

const URL_RE = new RegExp(
  `(?:^|[\\s(\\[<'"])(?:https?://)?(?:t\\.me|telegram\\.me|telegram\\.dog)/(?:s/)?${CHANNEL}/(\\d+)(?!\\d)`,
  "gi"
);

function isValidPostId(id) {
  return Number.isInteger(id) && id > 0 && Number.isSafeInteger(id);
}

function canonicalUrl(postId) {
  return `https://t.me/${CHANNEL}/${postId}`;
}

function hasUnsafeChars(text) {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text);
}

function parsePostIdToken(token) {
  if (typeof token !== "string" || !/^\d{1,16}$/.test(token)) return null;
  const postId = Number(token);
  if (!isValidPostId(postId) || String(postId) !== token) return null;
  return postId;
}

function extractPosts(text) {
  if (typeof text !== "string" || !text) return [];
  const slice = text.length > MAX_TEXT_LEN ? text.slice(0, MAX_TEXT_LEN) : text;
  if (hasUnsafeChars(slice)) return [];
  const found = [];
  const seen = new Set();
  const re = new RegExp(URL_RE.source, URL_RE.flags);
  let match;
  while ((match = re.exec(slice)) !== null) {
    const postId = parsePostIdToken(match[1]);
    if (postId === null || seen.has(postId)) continue;
    seen.add(postId);
    found.push({ postId, url: canonicalUrl(postId) });
    if (found.length >= MAX_POSTS_PER_MESSAGE) break;
  }
  return found;
}

function channelUsername(value) {
  if (typeof value !== "string") return "";
  return value.replace(/^@+/, "").trim().toLowerCase();
}

function isOurChannelChat(chat) {
  if (!chat || typeof chat !== "object") return false;
  if (channelUsername(chat.username) !== CHANNEL) return false;
  if (chat.type && chat.type !== "channel") return false;
  return true;
}

function postFromChannelMessageId(messageId) {
  if (!isValidPostId(messageId)) return null;
  return { postId: messageId, url: canonicalUrl(messageId) };
}

function extractForwardedPosts(msg) {
  if (!msg || typeof msg !== "object") return [];
  const found = [];
  const seen = new Set();
  function add(post) {
    if (!post || seen.has(post.postId)) return;
    seen.add(post.postId);
    found.push(post);
  }

  const origin = msg.forward_origin;
  if (origin && origin.type === "channel") {
    add(isOurChannelChat(origin.chat) ? postFromChannelMessageId(origin.message_id) : null);
  }
  if (isOurChannelChat(msg.forward_from_chat)) {
    add(postFromChannelMessageId(msg.forward_from_message_id));
  }
  return found;
}

function extractFromUrl(raw) {
  if (typeof raw !== "string" || !raw || raw.length > MAX_URL_LEN) return [];
  if (hasUnsafeChars(raw)) return [];
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return extractPosts(raw);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return [];
  if (parsed.username || parsed.password) return [];
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) return [];
  const parts = parsed.pathname.split("/").filter(Boolean);
  let idToken;
  if (parts[0] === "s" && parts[1] === CHANNEL) idToken = parts[2];
  else if (parts[0] === CHANNEL) idToken = parts[1];
  else return [];
  const postId = parsePostIdToken(idToken);
  if (postId === null) return [];
  return [{ postId, url: canonicalUrl(postId) }];
}

function sliceEntity(text, entity) {
  if (!text || !entity || !Number.isInteger(entity.offset) || !Number.isInteger(entity.length)) {
    return "";
  }
  if (entity.offset < 0 || entity.length <= 0) return "";
  if (entity.offset > text.length) return "";
  const length = Math.min(entity.length, MAX_URL_LEN);
  return text.substring(entity.offset, entity.offset + length);
}

function extractFromMessage(msg) {
  if (!msg || typeof msg !== "object") return [];
  const found = [];
  const seen = new Set();

  function pushPosts(posts) {
    for (const post of posts) {
      if (!post || seen.has(post.postId)) continue;
      seen.add(post.postId);
      found.push(post);
      if (found.length >= MAX_POSTS_PER_MESSAGE) return true;
    }
    return false;
  }

  if (pushPosts(extractForwardedPosts(msg))) return found;

  const chunks = [];
  if (typeof msg.text === "string") chunks.push(msg.text);
  if (typeof msg.caption === "string") chunks.push(msg.caption);

  const body = typeof msg.text === "string" ? msg.text : typeof msg.caption === "string" ? msg.caption : "";
  const entities = [].concat(msg.entities || [], msg.caption_entities || []).slice(0, 50);
  for (const entity of entities) {
    if (!entity) continue;
    if (entity.type === "url") {
      chunks.push(sliceEntity(body, entity));
    } else if (entity.type === "text_link" && typeof entity.url === "string" && entity.url.length <= MAX_URL_LEN) {
      chunks.push(entity.url);
    }
  }

  for (const chunk of chunks) {
    const posts = typeof chunk === "string" && /^https?:\/\//i.test(chunk.trim())
      ? extractFromUrl(chunk.trim())
      : extractPosts(chunk);
    if (pushPosts(posts)) return found;
  }
  return found;
}

module.exports = {
  ALLOWED_HOSTS,
  CHANNEL,
  canonicalUrl,
  extractFromMessage,
  extractFromUrl,
  extractPosts,
  isOurChannelChat,
  isValidPostId,
  parsePostIdToken,
};
