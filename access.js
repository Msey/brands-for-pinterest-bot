"use strict";

function parseAllowList(raw) {
  if (!raw || !String(raw).trim()) return null;
  const ids = String(raw)
    .split(/[\s,]+/)
    .map((part) => Number(part))
    .filter((id) => Number.isInteger(id) && id > 0 && Number.isSafeInteger(id));
  return ids.length ? new Set(ids) : null;
}

function isValidBotToken(token) {
  return /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(token);
}

function isPrivateChat(msg) {
  return Boolean(msg && msg.chat && msg.chat.type === "private" && Number.isFinite(msg.chat.id));
}

function isCommandText(text) {
  return typeof text === "string" && text.startsWith("/");
}

function commandPattern(name) {
  const safe = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^/${safe}(?:@\\w+)?(?:\\s|$)`, "i");
}

function createAccess(allowIds) {
  const allowList = allowIds instanceof Set ? allowIds : parseAllowList(allowIds);
  return {
    isPrivateChat,
    isCommandText,
    isAllowedUser(msg) {
      if (!allowList) return true;
      const id = msg && msg.from && msg.from.id;
      return allowList.has(id);
    },
  };
}

module.exports = {
  commandPattern,
  createAccess,
  isCommandText,
  isPrivateChat,
  isValidBotToken,
  parseAllowList,
};
