"use strict";

const fs = require("fs");
const path = require("path");
const { CHANNEL, extractFromUrl, parsePostIdToken } = require("./links");
const { isTelegramCdnUrl, parseEmbedHtml } = require("./parse-post");
const { fetchBuffer, fetchToFile, isJpeg } = require("./http-fetch");
const {
  PIN_DIR_MAX_AGE_MS,
  PIN_DIR_MAX_PRUNE,
  forgetPinsWithoutData,
  formatPinJson,
  hasPinData,
  pinDir,
  pruneOldPinDirs,
  removePinImage,
} = require("./pin-dirs");

const MAX_HTML_BYTES = 512 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function jsonlPath() {
  return path.join(__dirname, "data", "posts.jsonl");
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

async function exportPost(postId, deps) {
  const fetchHtml = deps && deps.fetchBuffer ? deps.fetchBuffer : fetchBuffer;
  const writeImage = deps && deps.fetchToFile ? deps.fetchToFile : fetchToFile;
  const parseHtml = deps && deps.parseEmbedHtml ? deps.parseEmbedHtml : parseEmbedHtml;
  const embedUrl = `https://t.me/${CHANNEL}/${postId}?embed=1`;
  let pin;
  let photoUrl;
  {
    const html = (await fetchHtml(embedUrl, MAX_HTML_BYTES)).toString("utf8");
    const parsed = parseHtml(html, postId);
    pin = parsed.pin;
    photoUrl = parsed.photoUrl;
  }
  if (!photoUrl || !isTelegramCdnUrl(photoUrl)) {
    throw new Error("В посте нет фото товара");
  }
  const dir = pinDir(postId);
  const imagePath = path.join(dir, "image.jpg");
  fs.mkdirSync(dir, { recursive: true });
  try {
    await writeImage(photoUrl, imagePath, MAX_IMAGE_BYTES, { jpeg: true });
    fs.writeFileSync(path.join(dir, "data.json"), formatPinJson(pin), "utf8");
  } catch (err) {
    removePinImage(imagePath);
    throw err;
  }
  return { dir, pin };
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
      const result = await exportPost(postId);
      console.log("OK", postId, result.dir);
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
  PIN_DIR_MAX_AGE_MS,
  PIN_DIR_MAX_PRUNE,
  collectPostIds,
  exportPost,
  fetchBuffer,
  fetchToFile,
  formatPinJson,
  forgetPinsWithoutData,
  hasPinData,
  isJpeg,
  pinDir,
  pruneOldPinDirs,
};
