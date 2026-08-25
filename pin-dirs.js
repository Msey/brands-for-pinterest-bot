"use strict";

const fs = require("fs");
const path = require("path");

const PIN_DIR_MAX_AGE_MS = 5 * 60 * 60 * 1000;
const PIN_DIR_MAX_PRUNE = 32;
const PIN_DIR_ID = /^\d{1,16}$/;
const MAX_PIN_JSON_BYTES = 64 * 1024;

function formatPinJson(pin) {
  return JSON.stringify(pin, null, 2) + "\n";
}

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

function loadPinData(postId, root) {
  const file = pinDataPath(postId, root);
  if (!file) return null;
  try {
    const st = fs.statSync(file);
    if (!st.isFile() || st.size > MAX_PIN_JSON_BYTES) return null;
    const raw = fs.readFileSync(file, "utf8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    return data;
  } catch {
    return null;
  }
}

function listStorageIds(storage) {
  if (!storage) return [];
  if (typeof storage.listIds === "function") return storage.listIds();
  if (storage.ids instanceof Set) return Array.from(storage.ids);
  if (typeof storage.readRecords !== "function") return [];
  return storage.readRecords().map((row) => row.post_id);
}

function forgetPinsWithoutData(storage, options) {
  const keepIds = new Set(
    (options && Array.isArray(options.keepIds) ? options.keepIds : [])
      .map((id) => String(id))
      .filter((id) => PIN_DIR_ID.test(id))
  );
  const root = options && options.root;
  const stale = listStorageIds(storage).filter(
    (id) => !keepIds.has(String(id)) && !hasPinData(id, root)
  );
  if (!stale.length) return [];
  if (typeof storage.removeMany === "function") return storage.removeMany(stale);
  const removed = [];
  for (const id of stale) {
    if (typeof storage.remove === "function" && storage.remove(id)) removed.push(id);
  }
  return removed;
}

function removePinImage(imagePath) {
  try {
    fs.unlinkSync(imagePath);
  } catch {
    /* ignore */
  }
  try {
    fs.unlinkSync(imagePath + ".part");
  } catch {
    /* ignore */
  }
}

module.exports = {
  PIN_DIR_MAX_AGE_MS,
  PIN_DIR_MAX_PRUNE,
  forgetPinsWithoutData,
  formatPinJson,
  hasPinData,
  loadPinData,
  pinDir,
  pinTemplatesRoot,
  pruneOldPinDirs,
  removePinImage,
};
