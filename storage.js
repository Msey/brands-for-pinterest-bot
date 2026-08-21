"use strict";

const fs = require("fs");
const path = require("path");
const { isValidPostId } = require("./links");

function toPostId(value) {
  const n = typeof value === "number" ? value : Number(value);
  return isValidPostId(n) ? n : null;
}

class PostStorage {
  constructor(filePath) {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("Нужен путь к файлу хранилища");
    }
    this.path = filePath;
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

  _loadIds() {
    this.ids = new Set();
    for (const record of this.readRecords()) {
      const postId = toPostId(record.post_id);
      if (postId !== null) this.ids.add(postId);
    }
  }

  readRecords() {
    this._ensureFile();
    let text = "";
    try {
      text = fs.readFileSync(this.path, "utf8");
    } catch (err) {
      if (err && err.code === "ENOENT") return [];
      throw err;
    }
    const records = [];
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const data = JSON.parse(trimmed);
        if (data && typeof data === "object" && !Array.isArray(data)) {
          records.push(data);
        }
      } catch {
        // skip broken lines
      }
    }
    return records;
  }

  has(postId) {
    const id = toPostId(postId);
    return id !== null && this.ids.has(id);
  }

  add({ url, postId, fromUserId, fromUsername }) {
    const id = toPostId(postId);
    if (id === null || typeof url !== "string" || !url) return false;
    if (this.has(id)) return false;
    this._ensureFile();
    const record = {
      url,
      post_id: id,
      saved_at: new Date().toISOString(),
      from_user_id: fromUserId == null ? null : fromUserId,
      from_username: fromUsername || null,
    };
    fs.appendFileSync(this.path, JSON.stringify(record) + "\n", "utf8");
    this.ids.add(id);
    return true;
  }

  count() {
    return this.ids.size;
  }

  listRecent(limit = 10) {
    const n = Math.floor(Number(limit));
    if (!Number.isFinite(n) || n <= 0) return [];
    const records = this.readRecords();
    return records.slice(-n);
  }
}

module.exports = { PostStorage };
