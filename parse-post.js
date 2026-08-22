"use strict";

const { CHANNEL, canonicalUrl, isValidPostId } = require("./links");
const { inferBoard } = require("./boards");
const { inferDescription } = require("./descriptions");

const MAX_TITLE = 100;
const MAX_DESC = 500;
const MAX_URL = 2048;
const MAX_HTML = 512 * 1024;
const TITLE_SUFFIX = " | оригинал из США";

const SKIP_HOSTS = [
  "t.me",
  "telegram.me",
  "telegram.dog",
  "telegram.org",
  "telegram-cdn.org",
  "telesco.pe",
  "max.ru",
];

const TYPE_RULES = [
  { match: /^очки\s+солнцезащитные(?:\s|$)/i, type: "очки", category: "очки", boardKind: "очки" },
  { match: /^кроссовки(?:\s|$)/i, type: "кроссовки", category: "обувь", boardKind: "обувь" },
  { match: /^кеды(?:\s|$)/i, type: "кеды", category: "обувь", boardKind: "обувь" },
  { match: /^угги(?:\s|$)/i, type: "угги", category: "обувь", boardKind: "обувь" },
  { match: /^сапоги(?:\s|$)/i, type: "сапоги", category: "обувь", boardKind: "обувь" },
  { match: /^ботинки(?:\s|$)/i, type: "ботинки", category: "обувь", boardKind: "обувь" },
  { match: /^куртка(?:\s|$)/i, type: "куртка", category: "одежда", boardKind: "куртки" },
  { match: /^купальник(?:\s|$)/i, type: "купальник", category: "одежда", boardKind: "купальник" },
  { match: /^пижама(?:\s|$)/i, type: "пижама", category: "белье", boardKind: "белье" },
  { match: /^халат(?:\s|$)/i, type: "халат", category: "белье", boardKind: "белье" },
  { match: /^худи(?:\s|$)/i, type: "худи", category: "одежда", boardKind: "одежда" },
  { match: /^брюки(?:\s|$)/i, type: "брюки", category: "одежда", boardKind: "одежда" },
  { match: /^платье(?:\s|$)/i, type: "платье", category: "одежда", boardKind: "одежда" },
  { match: /^рюкзак(?:\s|$)/i, type: "рюкзак", category: "сумка", boardKind: "сумки" },
  { match: /^сумка(?:\s|$)/i, type: "сумка", category: "сумка", boardKind: "сумки" },
  { match: /^очки(?:\s|$)/i, type: "очки", category: "очки", boardKind: "очки" },
  { match: /^часы(?:\s|$)/i, type: "часы", category: "часы", boardKind: "аксессуары" },
  { match: /^панама(?:\s|$)/i, type: "панама", category: "аксессуары", boardKind: "аксессуары" },
  { match: /^термос(?:\s|$)/i, type: "термос", category: "аксессуары", boardKind: "аксессуары" },
  { match: /^термокружка(?:\s|$)/i, type: "термос", category: "аксессуары", boardKind: "аксессуары" },
  { match: /^тональная\s+основа(?:\s|$)/i, type: "тональная основа", category: "косметика", boardKind: "косметика" },
  { match: /^тональный\s+крем(?:\s|$)/i, type: "тональный крем", category: "косметика", boardKind: "косметика" },
];

const MODEL_SKIP = /^(высокие|низкие|кожаные|слева|справа)(?:\s|$)/i;

function clip(text, max) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (value.length <= max) return value;
  return value.slice(0, max - 1).trim() + "…";
}

function withTitleSuffix(title) {
  const base = String(title || "")
    .replace(/\s*\|\s*оригинал из США\s*$/i, "")
    .trim();
  const head = clip(base, MAX_TITLE - TITLE_SUFFIX.length);
  return head + TITLE_SUFFIX;
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

function stripTags(html) {
  return decodeEntities(String(html || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function htmlToText(html) {
  return decodeEntities(
    String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hostnameOf(raw) {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function hostMatches(host, suffix) {
  return host === suffix || host.endsWith("." + suffix);
}

function isSkippedHost(host) {
  return SKIP_HOSTS.some((item) => hostMatches(host, item));
}

function isShopUrl(raw) {
  if (typeof raw !== "string" || !raw || raw.length > MAX_URL) return false;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  return !isSkippedHost(parsed.hostname.toLowerCase());
}

function isTelegramCdnUrl(raw) {
  if (typeof raw !== "string" || !raw) return false;
  let parsed;
  try {
    parsed = new URL(raw, "https://t.me/");
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return (
    hostMatches(host, "telesco.pe") ||
    hostMatches(host, "telegram-cdn.org") ||
    hostMatches(host, "cdn-telegram.org")
  );
}

function extractAnchors(html) {
  const found = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    const hrefMatch = /\bhref\s*=\s*"([^"]+)"/i.exec(match[1]);
    if (!hrefMatch) continue;
    const href = decodeEntities(hrefMatch[1].trim());
    const text = stripTags(match[2]);
    found.push({ href, text });
  }
  return found;
}

function extractPhotoUrl(html) {
  if (typeof html !== "string" || !html) return null;
  const slice = html.length > MAX_HTML ? html.slice(0, MAX_HTML) : html;
  const wrap = /tgme_widget_message_photo_wrap[\s\S]{0,800}?url\((['"])([^'"]+)\1\)/i.exec(slice);
  if (!wrap) return null;
  const url = decodeEntities(wrap[2]).replace(/^\/\//, "https://");
  return isTelegramCdnUrl(url) ? url : null;
}

function extractCaptionHtml(html) {
  const match = /<div class="tgme_widget_message_text[^"]*"[\s\S]*?>([\s\S]*?)<\/div>/i.exec(html);
  return match ? match[1] : html;
}

function parseAudience(text) {
  if (/унисекс\s+детское/i.test(text)) {
    return { key: "kids", label: "Детское, унисекс", titleWord: "детские", tag: "детские" };
  }
  if (/\(\s*мужской раздел\s*\)/i.test(text)) {
    return { key: "men", label: "Мужской раздел", titleWord: "мужские", tag: "мужские" };
  }
  if (/\(\s*женский раздел\s*\)/i.test(text)) {
    return { key: "women", label: "Женский раздел", titleWord: "женские", tag: "женские" };
  }
  if (/унисекс/i.test(text)) {
    return { key: "unisex", label: "Унисекс", titleWord: "унисекс", tag: "унисекс" };
  }
  return { key: "", label: "", titleWord: "", tag: "" };
}

function parseBrand(html, text) {
  const bold = /<b>([^<]{1,80})<\/b>/.exec(html);
  if (bold) {
    const brand = decodeEntities(bold[1]).replace(/\s+/g, " ").trim();
    if (brand && !/^\d+$/.test(brand) && brand.length < 60) return brand;
  }
  const line = text.split(/\n/)[0] || "";
  return line.replace(/🇺🇸/g, "").replace(/\s+/g, " ").trim();
}

function classifyProduct(name) {
  const raw = String(name || "").replace(/\s+/g, " ").trim();
  for (const rule of TYPE_RULES) {
    if (rule.match.test(raw)) {
      let model = raw.replace(rule.match, "").trim();
      while (MODEL_SKIP.test(model)) {
        model = model.replace(MODEL_SKIP, "").trim();
      }
      return { name: raw, type: rule.type, category: rule.category, boardKind: rule.boardKind, model };
    }
  }
  return { name: raw, type: "", category: "", boardKind: "", model: raw };
}

function brandTags(brand) {
  const lower = String(brand || "").toLowerCase();
  if (/air\s*jordan|\bjordan\b/.test(lower)) return ["nike"];
  if (/\bnike\b/.test(lower)) return ["nike"];
  if (/calvin\s*klein/.test(lower)) return ["calvin klein"];
  if (/michael\s*kors/.test(lower)) return ["michael kors"];
  if (/lacoste/.test(lower)) return ["lacoste"];
  if (/timberland/.test(lower)) return ["timberland"];
  if (/polo/.test(lower)) return ["polo"];
  if (/saint\s*laurent|\bysl\b/.test(lower)) return ["saint laurent"];
  if (/ray-?ban/.test(lower)) return ["ray ban"];
  const cleaned = lower.replace(/[^a-zа-яё0-9\s.-]/gi, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length >= 2 && cleaned.length <= 32) return [cleaned];
  return [];
}

function buildTags({ brand, product, audience }) {
  const tags = [];
  const seen = new Set();
  function add(tag) {
    const value = String(tag || "").trim().toLowerCase();
    if (!value || value.length > 32 || seen.has(value)) return;
    seen.add(value);
    tags.push(value);
  }
  for (const tag of brandTags(brand)) add(tag);
  if (product.type) add(product.type);
  if (product.category && product.category !== product.type) add(product.category);
  if (audience.tag) add(audience.tag);
  return tags.slice(0, 6);
}

function buildTitle({ brand, product, audience }) {
  const gender = audience.titleWord;
  const type = product.type;
  const model = product.model;
  let head = brand;
  if (model) head = `${brand} ${model}`.trim();
  let tail = [gender, type].filter(Boolean).join(" ");
  if (!tail && product.name) tail = product.name;
  const title = tail ? `${head} — ${tail}` : head;
  return withTitleSuffix(title);
}

function buildDescription({ brand, product, audience }) {
  return inferDescription({ brand, product, audience });
}

function parseCaptionHtml(captionHtml, options) {
  if (typeof captionHtml !== "string" || !captionHtml.trim()) {
    throw new Error("Пустой текст поста");
  }
  const postId = options && options.postId;
  if (!isValidPostId(postId)) {
    throw new Error("Нужен id поста Telegram");
  }
  const html = captionHtml.length > MAX_HTML ? captionHtml.slice(0, MAX_HTML) : captionHtml;
  const text = htmlToText(html);
  const products = extractAnchors(html)
    .filter((item) => isShopUrl(item.href) && item.text)
    .map((item) => ({ ...classifyProduct(item.text), href: item.href }));
  if (!products.length) {
    throw new Error("В посте нет ссылки на товар");
  }

  const primary = products[0];
  const audience = parseAudience(text);
  const brand = parseBrand(html, text);

  const pin = {
    title: buildTitle({ brand, product: primary, audience }),
    description: buildDescription({ brand, product: primary, audience }),
    link: canonicalUrl(postId),
    tags: buildTags({ brand, product: primary, audience }),
  };
  const board = inferBoard(primary, audience.key);
  if (board) pin.board = board;
  return pin;
}

function extractEmbedPostId(html) {
  const match = new RegExp(`data-post="${CHANNEL}/(\\d+)"`).exec(html);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseEmbedHtml(html, postId) {
  if (typeof html !== "string" || !html.trim()) {
    throw new Error("Пустой HTML виджета");
  }
  const slice = html.length > MAX_HTML ? html.slice(0, MAX_HTML) : html;
  const id = postId || extractEmbedPostId(slice);
  const photoUrl = extractPhotoUrl(slice);
  const pin = parseCaptionHtml(extractCaptionHtml(slice), { postId: id });
  return { pin, photoUrl };
}

module.exports = {
  MAX_DESC,
  MAX_TITLE,
  TITLE_SUFFIX,
  extractPhotoUrl,
  isShopUrl,
  isTelegramCdnUrl,
  parseCaptionHtml,
  parseEmbedHtml,
};
