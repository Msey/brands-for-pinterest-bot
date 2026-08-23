"use strict";

const { formatPinJson } = require("./pin-dirs");

const TG_MAX_LEN = 4000;

function pinJsonText(pin) {
  if (!pin || typeof pin !== "object" || Array.isArray(pin)) return "";
  return formatPinJson(pin).replace(/\n$/, "");
}

function buildReplyWithJson(summary, pins) {
  const head = String(summary || "");
  const jsons = [];
  for (const pin of Array.isArray(pins) ? pins : []) {
    const json = pinJsonText(pin);
    if (json) jsons.push(json);
  }
  if (!head && !jsons.length) {
    return { text: "", entities: [] };
  }
  if (!jsons.length) {
    return { text: head, entities: [] };
  }

  let text = head;
  const entities = [];
  for (const json of jsons) {
    const sep = text ? "\n\n" : "";
    const offset = text.length + sep.length;
    let body = json;
    const room = TG_MAX_LEN - offset;
    if (room < 8) break;
    if (body.length > room) {
      body = body.slice(0, Math.max(0, room - 1)) + "…";
    }
    text += sep + body;
    entities.push({
      type: "pre",
      offset,
      length: body.length,
      language: "json",
    });
  }
  return { text, entities };
}

module.exports = {
  TG_MAX_LEN,
  buildReplyWithJson,
  pinJsonText,
};
