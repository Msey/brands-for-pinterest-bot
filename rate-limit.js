"use strict";

class RateLimiter {
  constructor(options) {
    const opts = options || {};
    this.windowMs = Number.isFinite(opts.windowMs) && opts.windowMs > 0 ? opts.windowMs : 60 * 1000;
    this.max = Number.isFinite(opts.max) && opts.max > 0 ? opts.max : 30;
    this.maxKeys = Number.isFinite(opts.maxKeys) && opts.maxKeys > 0 ? opts.maxKeys : 64;
    this.hits = new Map();
  }

  sweep(now) {
    const ts = Number.isFinite(now) ? now : Date.now();
    for (const [key, slot] of this.hits) {
      if (ts > slot.reset) this.hits.delete(key);
    }
  }

  tooMany(userId, now) {
    if (!userId) return true;
    const ts = Number.isFinite(now) ? now : Date.now();
    if (this.hits.size >= this.maxKeys) this.sweep(ts);
    let slot = this.hits.get(userId);
    if (!slot || ts > slot.reset) {
      slot = { count: 0, reset: ts + this.windowMs };
      this.hits.set(userId, slot);
    }
    slot.count += 1;
    return slot.count > this.max;
  }
}

module.exports = {
  RateLimiter,
};
