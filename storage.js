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
    this.forEachRecord((record) => {
      this.ids.add(record.post_id);
    });
  }

  _readFileText() {
    this._ensureFile();
    try {
      const buf = fs.readFileSync(this.path);
      return buf.slice(0, MAX_FILE_BYTES).toString("utf8");
    } catch (err) {
      if (err && err.code === "ENOENT") return "";
      throw err;
    }
  }

  forEachRecord(fn) {
    if (typeof fn !== "function") return;
    const text = this._readFileText();
    let start = 0;
    while (start < text.length) {
      let end = text.indexOf("\n", start);
      if (end === -1) end = text.length;
      let line = text.slice(start, end);
      start = end + 1;
      if (line.charCodeAt(line.length - 1) === 13) line = line.slice(0, -1);
      const trimmed = line.trim();
      if (!trimmed) continue;
      const record = parseRecordLine(trimmed);
      if (record) fn(record);
    }
  }

  readRecords() {
    const records = [];
    this.forEachRecord((row) => {
      records.push(row);
    });
    return records;
  }

  listIds() {
    return Array.from(this.ids);
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
    this._writeLastSave(id, record.saved_at);
    return true;
  }

  _replaceAll(records) {
    const rows = Array.isArray(records) ? records : [];
    const body = rows.map((row) => JSON.stringify(row) + "\n").join("");
    if (Buffer.byteLength(body, "utf8") > MAX_FILE_BYTES) {
      const err = new Error("storage full");
      err.code = "STORAGE_FULL";
      throw err;
    }
    this._ensureFile();
    fs.writeFileSync(this.path, body, "utf8");
    this.ids = new Set(rows.map((row) => row.post_id));
  }

  removeMany(postIds) {
    const drop = new Set();
    for (const value of Array.isArray(postIds) ? postIds : []) {
      const id = toPostId(value);
      if (id !== null && this.ids.has(id)) drop.add(id);
    }
    if (!drop.size) return [];
    this._replaceAll(this.readRecords().filter((row) => !drop.has(row.post_id)));
    return Array.from(drop);
  }

  remove(postId) {
    return this.removeMany([postId]).length > 0;
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
    let n = 0;
    this.forEachRecord((row) => {
      if (row.from_user_id === uid) n += 1;
    });
    return n;
  }

  listRecent(limit = 10, userId) {
    const n = Math.floor(Number(limit));
    if (!Number.isFinite(n) || n <= 0) return [];
    const max = Math.min(n, 50);
    const uid = sanitizeUserId(userId);
    const recent = [];
    this.forEachRecord((row) => {
      if (uid !== null && row.from_user_id !== uid) return;
      recent.push(row);
      if (recent.length > max) recent.shift();
    });
    return recent;
  }
}

module.exports = {
  MAX_FILE_BYTES,
  PostStorage,
  parseRecordLine,
};
