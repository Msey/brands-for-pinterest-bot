"use strict";

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const httpAgent = new http.Agent({ keepAlive: false, maxSockets: 2 });
const httpsAgent = new https.Agent({ keepAlive: false, maxSockets: 2 });

function isJpeg(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length >= 3 &&
    buffer[0] === JPEG_MAGIC[0] &&
    buffer[1] === JPEG_MAGIC[1] &&
    buffer[2] === JPEG_MAGIC[2]
  );
}

function requestOptions(parsed) {
  return {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "*/*",
    },
    timeout: 20000,
    agent: parsed.protocol === "https:" ? httpsAgent : httpAgent,
  };
}

function parseFetchUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { error: new Error("Некорректный URL") };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { error: new Error("Разрешены только http/https") };
  }
  return { parsed, lib: parsed.protocol === "https:" ? https : http };
}

function fetchBuffer(url, maxBytes) {
  return fetchBufferFollow(url, maxBytes, 0);
}

function fetchBufferFollow(url, maxBytes, redirects) {
  if (redirects > 4) {
    return Promise.reject(new Error("Слишком много редиректов"));
  }
  const parsedUrl = parseFetchUrl(url);
  if (parsedUrl.error) return Promise.reject(parsedUrl.error);
  const { parsed, lib } = parsedUrl;
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const req = lib.get(parsed, requestOptions(parsed), (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        let next;
        try {
          next = new URL(res.headers.location, parsed).href;
        } catch {
          fail(new Error("Некорректный редирект"));
          return;
        }
        fetchBufferFollow(next, maxBytes, redirects + 1).then(
          (buf) => {
            if (settled) return;
            settled = true;
            resolve(buf);
          },
          fail
        );
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        fail(new Error("HTTP " + res.statusCode));
        return;
      }
      const buf = Buffer.allocUnsafe(maxBytes);
      let size = 0;
      res.on("data", (chunk) => {
        if (settled) return;
        if (size + chunk.length > maxBytes) {
          req.destroy();
          fail(new Error("Ответ слишком большой"));
          return;
        }
        chunk.copy(buf, size);
        size += chunk.length;
      });
      res.on("end", () => {
        if (settled) return;
        const out = Buffer.allocUnsafe(size);
        buf.copy(out, 0, 0, size);
        settled = true;
        resolve(out);
      });
      res.on("error", fail);
    });
    req.on("error", fail);
    req.on("timeout", () => {
      req.destroy();
      fail(new Error("Таймаут запроса"));
    });
  });
}

function appendJpegHead(head, chunk) {
  if (head.length >= 3) return head;
  const take = chunk.subarray(0, Math.min(3 - head.length, chunk.length));
  return Buffer.concat([head, take]);
}

function fetchToFile(url, destPath, maxBytes, options, redirects) {
  if (redirects == null) redirects = 0;
  if (redirects > 4) {
    return Promise.reject(new Error("Слишком много редиректов"));
  }
  if (typeof destPath !== "string" || !destPath.trim()) {
    return Promise.reject(new Error("Некорректный путь файла"));
  }
  const parsedUrl = parseFetchUrl(url);
  if (parsedUrl.error) return Promise.reject(parsedUrl.error);
  const { parsed, lib } = parsedUrl;
  const tmp = destPath + ".part";
  return new Promise((resolve, reject) => {
    let settled = false;
    let out = null;
    const cleanup = () => {
      if (out) {
        try {
          out.destroy();
        } catch {
          /* ignore */
        }
        out = null;
      }
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const req = lib.get(parsed, requestOptions(parsed), (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        let next;
        try {
          next = new URL(res.headers.location, parsed).href;
        } catch {
          fail(new Error("Некорректный редирект"));
          return;
        }
        fetchToFile(next, destPath, maxBytes, options, redirects + 1).then(
          (value) => {
            if (settled) return;
            settled = true;
            resolve(value);
          },
          fail
        );
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        fail(new Error("HTTP " + res.statusCode));
        return;
      }
      try {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        out = fs.createWriteStream(tmp);
      } catch (err) {
        res.resume();
        fail(err);
        return;
      }
      let size = 0;
      let head = Buffer.alloc(0);
      const requireJpeg = Boolean(options && options.jpeg);
      out.on("error", fail);
      res.on("data", (chunk) => {
        if (settled) return;
        size += chunk.length;
        if (size > maxBytes) {
          req.destroy();
          fail(new Error("Ответ слишком большой"));
          return;
        }
        if (requireJpeg) {
          head = appendJpegHead(head, chunk);
          if (head.length >= 3 && !isJpeg(head)) {
            req.destroy();
            fail(new Error("Фото не JPEG"));
            return;
          }
        }
        if (!out.write(chunk)) {
          res.pause();
          out.once("drain", () => res.resume());
        }
      });
      res.on("end", () => {
        if (settled) return;
        if (requireJpeg && (size < 3 || !isJpeg(head))) {
          fail(new Error("Фото не JPEG"));
          return;
        }
        out.end(() => {
          if (settled) return;
          try {
            fs.renameSync(tmp, destPath);
            settled = true;
            resolve({ bytes: size });
          } catch (err) {
            fail(err);
          }
        });
      });
      res.on("error", fail);
    });
    req.on("error", fail);
    req.on("timeout", () => {
      req.destroy();
      fail(new Error("Таймаут запроса"));
    });
  });
}

module.exports = {
  fetchBuffer,
  fetchToFile,
  isJpeg,
};
