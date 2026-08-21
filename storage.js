"use strict";

const fs = require("fs");
const path = require("path");

class PostStorage {
  constructor(filePath) {
    this.path = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "", "utf8");
    }
    this.ids = new Set();
    for (const record of this.readRecords()) {
      if (Number.isInteger(record.post_id)) {
        this.ids.add(record.post_id);
      }
    }
  }

  readRecords() {
    const text = fs.readFileSync(this.path, "utf8");
    const records = [];
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const data = JSON.parse(trimmed);
        if (data && typeof data === "object") {
          records.push(data);
        }
      } catch {
        // skip broken lines
      }
    }
    return records;
  }

  has(postId) {
    return this.ids.has(postId);
  }

  add({ url, postId, fromUserId, fromUsername }) {
    if (this.has(postId)) {
      return false;
    }
    const record = {
      url,
      post_id: postId,
      saved_at: new Date().toISOString(),
      from_user_id: fromUserId,
      from_username: fromUsername || null,
    };
    fs.appendFileSync(this.path, JSON.stringify(record) + "\n", "utf8");
    this.ids.add(postId);
    return true;
  }

  count() {
    return this.ids.size;
  }

  listRecent(limit = 10) {
    const records = this.readRecords();
    return records.slice(-limit);
  }
}

module.exports = { PostStorage };
