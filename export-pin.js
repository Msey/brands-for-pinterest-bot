"use strict";

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const { CHANNEL, extractFromUrl, parsePostIdToken } = require("./links");
const { isTelegramCdnUrl, parseEmbedHtml } = require("./parse-post");

const MAX_HTML_BYTES = 512 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

function pinDir(postId) {
  const id = String(postId);
  if (!/^\d{1,16}$/.test(id)) {
    throw new Error("Некорректный id поста");
  }
  return path.join(__dirname, id);
}

function jsonlPath() {
  return path.join(__dirname, "data", "posts.jsonl");
}

function fetchBuffer(url, maxBytes) {
  return fetchBufferFollow(url, maxBytes, 0);
}

function fetchBufferFollow(url, maxBytes, redirects) {
  if (redirects > 4) {
    return Promise.reject(new Error("Слишком много редиректов"));
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return Promise.reject(new Error("Некорректный URL"));
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return Promise.reject(new Error("Разрешены только http/https"));
  }
  const lib = parsed.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.get(
      parsed,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "*/*",
        },
        timeout: 20000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          let next;
          try {
            next = new URL(res.headers.location, parsed).href;
          } catch {
            reject(new Error("Некорректный редирект"));
            return;
          }
          fetchBufferFollow(next, maxBytes, redirects + 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error("HTTP " + res.statusCode));
          return;
        }
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy();
            reject(new Error("Ответ слишком большой"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Таймаут запроса"));
    });
  });
}

function isJpeg(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 3 && buffer.slice(0, 3).equals(JPEG_MAGIC);
}

function collectPostIds(argv) {
  const ids = [];
  const seen = new Set();
  let fromJsonl = false;
  for (const arg of argv) {
    if (arg === "--from-jsonl") {
      fromJsonl = true;
      continue;
    }
    if (arg.startsWith("-")) continue;
    const fromUrl = extractFromUrl(arg);
    if (fromUrl.length) {
      for (const item of fromUrl) {
        if (!seen.has(item.postId)) {
          seen.add(item.postId);
          ids.push(item.postId);
        }
      }
      continue;
    }
    const bare = parsePostIdToken(arg);
    if (bare !== null && !seen.has(bare)) {
      seen.add(bare);
      ids.push(bare);
    }
  }
  if (fromJsonl) {
    const file = jsonlPath();
    if (!fs.existsSync(file)) {
      throw new Error("Нет файла data/posts.jsonl");
    }
    const text = fs.readFileSync(file, "utf8").slice(0, 8 * 1024 * 1024);
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      let data;
      try {
        data = JSON.parse(line);
      } catch {
        continue;
      }
      const fromUrl = extractFromUrl(data && data.url);
      for (const item of fromUrl) {
        if (!seen.has(item.postId)) {
          seen.add(item.postId);
          ids.push(item.postId);
        }
      }
    }
  }
  return ids;
}

async function exportPost(postId) {
  const embedUrl = `https://t.me/${CHANNEL}/${postId}?embed=1`;
  const html = (await fetchBuffer(embedUrl, MAX_HTML_BYTES)).toString("utf8");
  const { pin, photoUrl } = parseEmbedHtml(html, postId);
  if (!photoUrl || !isTelegramCdnUrl(photoUrl)) {
    throw new Error("В посте нет фото товара");
  }
  const image = await fetchBuffer(photoUrl, MAX_IMAGE_BYTES);
  if (!isJpeg(image)) {
    throw new Error("Фото не JPEG");
  }
  if (image.length > MAX_IMAGE_BYTES) {
    throw new Error("JPG больше 8 МБ");
  }
  const dir = pinDir(postId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "data.json"), JSON.stringify(pin, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(dir, "image.jpg"), image);
  return dir;
}

async function main(argv) {
  const ids = collectPostIds(argv);
  if (!ids.length) {
    console.error("Использование: node export-pin.js <t.me/kupim_v_usa/id|id> [--from-jsonl]");
    process.exit(1);
  }
  let failed = 0;
  for (const postId of ids) {
    try {
      const dir = await exportPost(postId);
      console.log("OK", postId, dir);
    } catch (err) {
      failed += 1;
      console.error("FAIL", postId, err && err.message ? err.message : err);
    }
  }
  if (failed) process.exit(1);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
}

module.exports = {
  collectPostIds,
  exportPost,
  isJpeg,
  pinDir,
};
