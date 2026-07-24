/* Br-di — utils.js
 * Mathe-Helfer, Easing, Canvas-Helfer, PRNG, Event-Bus.
 */
(function (BR) {
  'use strict';

  BR.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  BR.lerp = function (a, b, t) { return a + (b - a) * t; };
  BR.sign = function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); };

  // Bewegt v Richtung target um maximal maxDelta.
  BR.approach = function (v, target, maxDelta) {
    if (v < target) return Math.min(v + maxDelta, target);
    if (v > target) return Math.max(v - maxDelta, target);
    return v;
  };

  BR.ease = {
    outSine: function (t) { return Math.sin((t * Math.PI) / 2); },
    inOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
    outBack: function (t) {
      var c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); }
  };

  // Abgerundetes Rechteck.
  BR.roundRect = function (ctx, x, y, w, h, r) {
    if (r < 0) r = 0;
    var rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  // --- Seeded PRNG (mulberry32, Spec §7.1) ---
  BR.mulberry32 = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  BR.randInt = function (rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); };
  BR.pick = function (rng, arr) { return arr[Math.floor(rng() * arr.length)]; };

  // 32-bit-Hash aus String (für stabile Deko-Varianten).
  BR.hash32 = function (str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  // --- Event-Bus ---
  BR.EventBus = function () {
    this._h = {};
  };
  BR.EventBus.prototype.on = function (name, fn) {
    (this._h[name] = this._h[name] || []).push(fn);
  };
  BR.EventBus.prototype.emit = function (name, payload) {
    var l = this._h[name];
    if (l) for (var i = 0; i < l.length; i++) l[i](payload);
  };
  BR.EventBus.prototype.clear = function () { this._h = {}; };

  // Zeit hübsch formatieren (ms -> "M:SS.mmm" bzw "SS.m").
  BR.fmtTime = function (ms) {
    if (ms == null) return '--:--';
    var totalS = ms / 1000;
    var m = Math.floor(totalS / 60);
    var s = totalS - m * 60;
    if (m > 0) {
      return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
    }
    return s.toFixed(2) + 's';
  };

})(window.BR = window.BR || {});
