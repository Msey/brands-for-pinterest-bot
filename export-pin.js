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

function formatPinJson(pin) {
  return JSON.stringify(pin, null, 2) + "\n";
}

const PIN_DIR_MAX_AGE_MS = 5 * 60 * 60 * 1000;
const PIN_DIR_MAX_PRUNE = 32;
const PIN_DIR_ID = /^\d{1,16}$/;

function pinTemplatesRoot() {
  return path.join(__dirname, "pin-templates");
}

function pinDir(postId) {
  const id = String(postId);
  if (!PIN_DIR_ID.test(id)) {
    throw new Error("Некорректный id поста");
  }
  return path.join(pinTemplatesRoot(), id);
}

function samePath(a, b) {
  if (process.platform === "win32") {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

function isInsideRoot(root, target) {
  const rootFull = path.resolve(root);
  const targetFull = path.resolve(target);
  if (samePath(targetFull, rootFull)) return true;
  const prefix = rootFull.endsWith(path.sep) ? rootFull : rootFull + path.sep;
  if (process.platform === "win32") {
    return targetFull.toLowerCase().startsWith(prefix.toLowerCase());
  }
  return targetFull.startsWith(prefix);
}

function resolvePruneRoot(options) {
  if (!options || options.root == null) return pinTemplatesRoot();
  if (typeof options.root !== "string" || !options.root.trim()) {
    throw new Error("Некорректный путь prune");
  }
  return path.resolve(options.root);
}

function isLinkLike(dir, st) {
  if (st.isSymbolicLink()) return true;
  try {
    fs.readlinkSync(dir);
    return true;
  } catch {
    return false;
  }
}

function pruneOldPinDirs(options) {
  const now = options && Number.isFinite(options.now) ? options.now : Date.now();
  const maxAgeMs =
    options && Number.isFinite(options.maxAgeMs) && options.maxAgeMs >= 0
      ? options.maxAgeMs
      : PIN_DIR_MAX_AGE_MS;
  const root = resolvePruneRoot(options);
  const keepIds = new Set(
    (options && Array.isArray(options.keepIds) ? options.keepIds : [])
      .map((id) => String(id))
      .filter((id) => PIN_DIR_ID.test(id))
  );
  const removed = [];
  let names;
  try {
    names = fs.readdirSync(root);
  } catch (err) {
    if (err && err.code === "ENOENT") return { removed };
    throw err;
  }
  for (const name of names) {
    if (removed.length >= PIN_DIR_MAX_PRUNE) break;
    if (!PIN_DIR_ID.test(name) || keepIds.has(name)) continue;
    const dir = path.join(root, name);
    if (!isInsideRoot(root, dir)) continue;
    let st;
    try {
      st = fs.lstatSync(dir);
    } catch {
      continue;
    }
    if (!st.isDirectory() || isLinkLike(dir, st)) continue;
    if (now - st.mtimeMs < maxAgeMs) continue;
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (err) {
      console.error("prune_pin", name, err && err.message ? err.message : err);
      continue;
    }
    const id = Number(name);
    removed.push(Number.isSafeInteger(id) ? id : name);
  }
  return { removed };
}

function pinDataPath(postId, root) {
  const id = String(postId);
  if (!PIN_DIR_ID.test(id)) return null;
  const base = root && typeof root === "string" && root.trim() ? path.resolve(root) : pinTemplatesRoot();
  return path.join(base, id, "data.json");
}

function hasPinData(postId, root) {
  const file = pinDataPath(postId, root);
  if (!file) return false;
  try {
    return fs.existsSync(file);
  } catch {
    return false;
  }
}

function forgetPinsWithoutData(storage, options) {
  if (!storage || typeof storage.readRecords !== "function") return [];
  const keepIds = new Set(
    (options && Array.isArray(options.keepIds) ? options.keepIds : [])
      .map((id) => String(id))
      .filter((id) => PIN_DIR_ID.test(id))
  );
  const root = options && options.root;
  const stale = storage
    .readRecords()
    .map((row) => row.post_id)
    .filter((id) => !keepIds.has(String(id)) && !hasPinData(id, root));
  if (!stale.length) return [];
  if (typeof storage.removeMany === "function") return storage.removeMany(stale);
  const removed = [];
  for (const id of stale) {
    if (typeof storage.remove === "function" && storage.remove(id)) removed.push(id);
  }
  return removed;
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
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length >= 3 &&
    buffer[0] === JPEG_MAGIC[0] &&
    buffer[1] === JPEG_MAGIC[1] &&
    buffer[2] === JPEG_MAGIC[2]
  );
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
  fs.writeFileSync(path.join(dir, "data.json"), formatPinJson(pin), "utf8");
  fs.writeFileSync(path.join(dir, "image.jpg"), image);
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
  formatPinJson,
  isJpeg,
  pinDir,
  pruneOldPinDirs,
  forgetPinsWithoutData,
  hasPinData,
};
