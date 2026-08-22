"use strict";

const fs = require("fs");
const path = require("path");
const { canonicalUrl, isValidPostId } = require("./links");

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_LINE_LEN = 4096;
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function toPostId(value) {
  const n = typeof value === "number" ? value : Number(value);
  return isValidPostId(n) ? n : null;
}

function sanitizeUsername(name) {
  if (typeof name !== "string") return null;
  if (!/^[A-Za-z0-9_]{1,32}$/.test(name)) return null;
  return name;
}

function sanitizeUserId(id) {
  if (!Number.isInteger(id) || id <= 0 || !Number.isSafeInteger(id)) return null;
  return id;
}

function isCanonicalUrl(url, postId) {
  return typeof url === "string" && url === canonicalUrl(postId);
}

function jsonReviver(key, value) {
  if (DANGEROUS_KEYS.has(key)) return undefined;
  return value;
}

function parseRecordLine(line) {
  if (typeof line !== "string" || line.length > MAX_LINE_LEN) return null;
  if (line.includes("\0")) return null;
  let data;
  try {
    data = JSON.parse(line, jsonReviver);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const postId = toPostId(data.post_id);
  if (postId === null || !isCanonicalUrl(data.url, postId)) return null;
  return {
    url: canonicalUrl(postId),
    post_id: postId,
    saved_at: typeof data.saved_at === "string" ? data.saved_at.slice(0, 40) : null,
    from_user_id: sanitizeUserId(data.from_user_id),
    from_username: sanitizeUsername(data.from_username),
  };
}

class PostStorage {
  constructor(filePath) {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("Нужен путь к файлу хранилища");
    }
    this.path = path.resolve(filePath);
    this.ids = new Set();
    this._recordsCache = null;
    this._ensureFile();
    this._loadIds();
  }

  _ensureFile() {
    fs.mkdirSync(path.dirname(this.path), { recursive: true });
    if (!fs.existsSync(this.path)) {
      fs.writeFileSync(this.path, "", "utf8");
    }
  }

  _fileSize() {
    try {
      return fs.statSync(this.path).size;
    } catch (err) {
      if (err && err.code === "ENOENT") return 0;
      throw err;
    }
  }

  _loadIds() {
    this.ids = new Set();
    for (const record of this.readRecords()) {
      this.ids.add(record.post_id);
    }
  }

  readRecords() {
    if (this._recordsCache) return this._recordsCache;
    this._ensureFile();
    let text = "";
    try {
      const buf = fs.readFileSync(this.path);
      text = buf.slice(0, MAX_FILE_BYTES).toString("utf8");
    } catch (err) {
      if (err && err.code === "ENOENT") return [];
      throw err;
    }
    const records = [];
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const record = parseRecordLine(trimmed);
      if (record) records.push(record);
    }
    this._recordsCache = records;
    return records;
  }

  has(postId) {
    const id = toPostId(postId);
    return id !== null && this.ids.has(id);
  }

  add({ url, postId, fromUserId, fromUsername }) {
    const id = toPostId(postId);
    if (id === null || !isCanonicalUrl(url, id)) return false;
    if (this.has(id)) return false;
    this._ensureFile();
    const record = {
      url: canonicalUrl(id),
      post_id: id,
      saved_at: new Date().toISOString(),
      from_user_id: sanitizeUserId(fromUserId),
      from_username: sanitizeUsername(fromUsername),
    };
    const line = JSON.stringify(record) + "\n";
    if (this._fileSize() + Buffer.byteLength(line, "utf8") > MAX_FILE_BYTES) {
      const err = new Error("storage full");
      err.code = "STORAGE_FULL";
      throw err;
    }
    fs.appendFileSync(this.path, line, "utf8");
    this.ids.add(id);
    if (this._recordsCache) this._recordsCache.push(record);
    this._writeLastSave(id, record.saved_at);
    return true;
  }

  _writeLastSave(postId, savedAt) {
    const dest = path.join(path.dirname(this.path), "last-save.json");
    const body = JSON.stringify({
      post_id: postId,
      saved_at: typeof savedAt === "string" ? savedAt : new Date().toISOString(),
    }) + "\n";
    try {
      fs.writeFileSync(dest, body, "utf8");
    } catch {
      // Sidecar is only for the tray popup; the jsonl row is already saved.
    }
  }

  count(userId) {
    if (userId === undefined) return this.ids.size;
    const uid = sanitizeUserId(userId);
    if (uid === null) return 0;
    return this.readRecords().filter((row) => row.from_user_id === uid).length;
  }

  listRecent(limit = 10, userId) {
    const n = Math.floor(Number(limit));
    if (!Number.isFinite(n) || n <= 0) return [];
    let records = this.readRecords();
    const uid = sanitizeUserId(userId);
    if (uid !== null) {
      records = records.filter((row) => row.from_user_id === uid);
    }
    return records.slice(-Math.min(n, 50));
  }
}

module.exports = {
  MAX_FILE_BYTES,
  PostStorage,
  parseRecordLine,
};
