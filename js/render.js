/* Br-di — render.js
 * Kamera, Parallax, Welt, Entities, Partikel, HUD. Spec §8, §9.
 */
(function (BR) {
  'use strict';

  var TILE = BR.TILE, T = BR.TileType, P = BR.PAL;
  var VIEW_TILES_H = 15; // sichtbare Welthöhe in Kacheln

  // ---------- Kamera ----------
  function Camera() { this.x = 0; this.y = 0; this.zoom = 1; this.viewW = 0; this.viewH = 0; this._init = false; }
  Camera.prototype.setView = function (cssW, cssH) {
    this.zoom = cssH / (VIEW_TILES_H * TILE);
    this.viewW = cssW / this.zoom;
    this.viewH = cssH / this.zoom;
  };
  Camera.prototype.follow = function (target, level, lerpAmt) {
    var tx = target.cx - this.viewW / 2;
    var ty = target.cy - this.viewH * 0.55;
    var maxX = Math.max(0, level.pixelWidth - this.viewW);
    var maxY = Math.max(0, level.pixelHeight - this.viewH);
    tx = BR.clamp(tx, 0, maxX);
    ty = BR.clamp(ty, 0, maxY);
    if (!this._init) { this.x = tx; this.y = ty; this._init = true; }
    else { this.x = BR.lerp(this.x, tx, lerpAmt); this.y = BR.lerp(this.y, ty, lerpAmt); }
  };
  Camera.prototype.reset = function () { this._init = false; };
  BR.Camera = Camera;

  // ---------- Renderer ----------
  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.cssW = 0; this.cssH = 0;
    this.clouds = null;
    this.resize();
  }

  Renderer.prototype.resize = function () {
    var dpr = window.devicePixelRatio || 1;
    var w = this.canvas.clientWidth || window.innerWidth;
    var h = this.canvas.clientHeight || window.innerHeight;
    this.dpr = dpr; this.cssW = w; this.cssH = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
  };

  Renderer.prototype.clear = function () {
    var ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);
  };

  // ---- Parallax-Hintergrund (Screen-space, Kamera-getrieben) ----
  Renderer.prototype.drawParallax = function (camera, t) {
    var ctx = this.ctx, w = this.cssW, h = this.cssH;
    // Himmel
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, P.sky.top); sky.addColorStop(0.55, P.sky.mid); sky.addColorStop(1, P.sky.bot);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

    // Sonne
    var sx = w * 0.80 - camera.x * 0.05 * camera.zoom % w;
    var sy = h * 0.20;
    ctx.save();
    var glow = ctx.createRadialGradient(sx, sy, 8, sx, sy, 120);
    glow.addColorStop(0, 'rgba(255,231,154,0.7)'); glow.addColorStop(1, 'rgba(255,231,154,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, 120, 0, 7); ctx.fill();
    // Strahlen
    ctx.strokeStyle = 'rgba(255,222,107,0.35)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (var r = 0; r < 12; r++) {
      var a = t * 0.05 + r * Math.PI / 6;
      var len = 46 + Math.sin(t * 2 + r) * 8;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * 40, sy + Math.sin(a) * 40);
      ctx.lineTo(sx + Math.cos(a) * (40 + len), sy + Math.sin(a) * (40 + len));
      ctx.stroke();
    }
    var disc = ctx.createRadialGradient(sx - 6, sy - 6, 4, sx, sy, 34);
    disc.addColorStop(0, P.sun.core); disc.addColorStop(1, P.sun.edge);
    ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(sx, sy, 34, 0, 7); ctx.fill();
    ctx.restore();

    // Berg-Ebenen
    for (var m = 0; m < P.mountains.length; m++) {
      var mt = P.mountains[m];
      this._mountainLayer(camera, mt.col, mt.factor, h * (0.42 + m * 0.10), 90 + m * 30, 220 + m * 60);
    }

    // Wolken
    if (!this.clouds) this._initClouds();
    ctx.save();
    for (var c = 0; c < this.clouds.length; c++) {
      var cl = this.clouds[c];
      var cx = ((cl.x + t * cl.spd - camera.x * 0.2 * camera.zoom) % (w + 300) + (w + 300)) % (w + 300) - 150;
      this._cloud(cx, cl.y * h, cl.s);
    }
    ctx.restore();
  };

  Renderer.prototype._mountainLayer = function (camera, col, factor, baseY, amp, span) {
    var ctx = this.ctx, w = this.cssW, h = this.cssH;
    var off = -(camera.x * factor * camera.zoom) % span;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-span, h);
    var x = -span + off;
    var i = 0;
    while (x < w + span) {
      var peak = baseY - (amp * (0.6 + 0.4 * ((i % 3) / 2)));
      ctx.lineTo(x + span / 2, peak);
      ctx.lineTo(x + span, baseY);
      x += span; i++;
    }
    ctx.lineTo(w + span, h); ctx.closePath(); ctx.fill();
  };

  Renderer.prototype._initClouds = function () {
    this.clouds = [];
    for (var i = 0; i < 6; i++) {
      this.clouds.push({ x: i * 260 + (i * 97 % 120), y: 0.10 + (i % 3) * 0.09, s: 0.8 + (i % 3) * 0.35, spd: 6 + (i % 4) * 3 });
    }
  };
  Renderer.prototype._cloud = function (x, y, s) {
    var ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = P.cloud.under;
    ctx.beginPath(); ctx.ellipse(0, 14, 60, 16, 0, 0, 7); ctx.fill();
    var puffs = [[-34, 4, 20], [-8, -6, 26], [22, -2, 22], [44, 8, 18], [8, 10, 24]];
    ctx.fillStyle = P.cloud.base;
    for (var i = 0; i < puffs.length; i++) { ctx.beginPath(); ctx.arc(puffs[i][0], puffs[i][1], puffs[i][2], 0, 7); ctx.fill(); }
    ctx.fillStyle = P.cloud.hi;
    for (i = 0; i < puffs.length; i++) { ctx.beginPath(); ctx.arc(puffs[i][0] - 3, puffs[i][1] - 5, puffs[i][2] * 0.7, 0, 7); ctx.fill(); }
    ctx.restore();
  };

  // ---- Welt-Transform ----
  Renderer.prototype.beginWorld = function (camera, shakeX, shakeY) {
    var ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate((-camera.x * camera.zoom) + (shakeX || 0), (-camera.y * camera.zoom) + (shakeY || 0));
    ctx.scale(camera.zoom, camera.zoom);
  };
  Renderer.prototype.endWorld = function () { this.ctx.restore(); };

  // ---- Tiles + Boden ----
  Renderer.prototype.drawWorld = function (level, camera, t) {
    var ctx = this.ctx;
    var x0 = Math.max(0, Math.floor(camera.x / TILE) - 1);
    var y0 = Math.max(0, Math.floor(camera.y / TILE) - 1);
    var x1 = Math.min(level.width, Math.ceil((camera.x + camera.viewW) / TILE) + 1);
    var y1 = Math.min(level.height, Math.ceil((camera.y + camera.viewH) / TILE) + 1);
    var tx, ty;
    for (ty = y0; ty < y1; ty++) {
      for (tx = x0; tx < x1; tx++) {
        var v = level.tile(tx, ty);
        if (v === T.SOLID) this._ground(tx, ty, level, t);
        else if (v === T.ONEWAY) this._oneway(tx, ty);
        else if (v === T.HAZARD) {
          if (level.material(tx, ty) === 2) this._water(tx, ty, t);
          else this._thorn(tx, ty, t);
        }
      }
    }
  };

  Renderer.prototype._ground = function (tx, ty, level, t) {
    var ctx = this.ctx, x = tx * TILE, y = ty * TILE;
    var topExposed = level.tile(tx, ty - 1) === T.EMPTY;
    // Erdkörper
    var body = ctx.createLinearGradient(0, y, 0, y + TILE);
    body.addColorStop(0, P.dirt.hi); body.addColorStop(1, P.dirt.dark);
    ctx.fillStyle = body; ctx.fillRect(x, y, TILE, TILE);
    // Sprenkel (stabil)
    ctx.fillStyle = P.dirt.speck;
    var hsh = BR.hash32(tx + '_' + ty);
    for (var s = 0; s < 3; s++) {
      var px = x + 4 + ((hsh >> (s * 3)) & 7) * 3;
      var py = y + 8 + ((hsh >> (s * 3 + 8)) & 7) * 2.6;
      ctx.fillRect(px, py, 2, 2);
    }
    if (topExposed) {
      // Gras-Deckel mit welliger Oberkante
      ctx.fillStyle = P.grass.mid;
      ctx.beginPath();
      ctx.moveTo(x, y + 10);
      ctx.quadraticCurveTo(x + TILE / 2, y + 10 + Math.sin(t * 2 + tx) * 1.5, x + TILE, y + 10);
      ctx.lineTo(x + TILE, y); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.grass.hi;
      ctx.fillRect(x, y, TILE, 5);
      // Halme
      ctx.strokeStyle = P.grass.blade; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (var b = 0; b < 3; b++) {
        var bx = x + 5 + b * 9;
        var sway = Math.sin(t * 2 + bx * 0.3) * 2.5;
        ctx.beginPath(); ctx.moveTo(bx, y + 6); ctx.lineTo(bx + sway, y - 4); ctx.stroke();
      }
    }
  };

  Renderer.prototype._oneway = function (tx, ty) {
    var ctx = this.ctx, x = tx * TILE, y = ty * TILE;
    ctx.fillStyle = P.grass.dark;
    BR.roundRect(ctx, x + 1, y + 3, TILE - 2, 9, 4); ctx.fill();
    ctx.fillStyle = P.grass.hi;
    BR.roundRect(ctx, x + 1, y + 2, TILE - 2, 5, 4); ctx.fill();
  };

  Renderer.prototype._water = function (tx, ty, t) {
    var ctx = this.ctx, x = tx * TILE, y = ty * TILE;
    var g = ctx.createLinearGradient(0, y, 0, y + TILE);
    g.addColorStop(0, P.hazard.waterHi); g.addColorStop(1, P.hazard.waterLo);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y + 5);
    for (var i = 0; i <= TILE; i += 8) ctx.lineTo(x + i, y + 5 + Math.sin(t * 3 + (x + i) * 0.2) * 2.5);
    ctx.lineTo(x + TILE, y + TILE); ctx.lineTo(x, y + TILE); ctx.closePath(); ctx.fill();
  };

  Renderer.prototype._thorn = function (tx, ty, t) {
    var ctx = this.ctx, x = tx * TILE, y = ty * TILE;
    ctx.fillStyle = P.hazard.thornBase; ctx.fillRect(x, y + TILE - 8, TILE, 8);
    for (var i = 0; i < 4; i++) {
      var bx = x + i * 8;
      var grad = ctx.createLinearGradient(0, y + 8, 0, y + TILE);
      grad.addColorStop(0, P.hazard.thornTip); grad.addColorStop(1, P.hazard.thornBody);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(bx, y + TILE - 4); ctx.lineTo(bx + 4, y + 6); ctx.lineTo(bx + 8, y + TILE - 4); ctx.closePath(); ctx.fill();
    }
    var pulse = 0.2 + 0.15 * Math.sin(t * 6);
    ctx.fillStyle = 'rgba(255,46,77,' + pulse + ')';
    ctx.fillRect(x, y + 4, TILE, 3);
  };

  // ---- Deko (Bäume, Hügel im Vordergrund) ----
  Renderer.prototype.drawDeco = function (deco, t) {
    for (var i = 0; i < deco.length; i++) {
      var d = deco[i];
      if (d.kind === 'tree') this._tree(d.x, d.y, d.v, t);
      // Wolken-Deko im Grid ignorieren (Parallax übernimmt Wolken)
    }
  };
  Renderer.prototype._tree = function (x, y, v, t) {
    var ctx = this.ctx;
    var col = P.trees[v % P.trees.length];
    var bx = x + TILE / 2;
    var baseY = y + TILE + 4;
    var sway = Math.sin(t * 1.5 + v) * 3;
    // Stamm
    ctx.fillStyle = P.trunk.dark;
    BR.roundRect(ctx, bx - 5, baseY - 40, 10, 44, 4); ctx.fill();
    ctx.fillStyle = P.trunk.hi;
    BR.roundRect(ctx, bx - 5, baseY - 40, 4, 44, 4); ctx.fill();
    // Krone
    ctx.save();
    ctx.translate(bx + sway, baseY - 46);
    ctx.fillStyle = col.dark;
    var puffs = [[-14, 6, 16], [0, 0, 20], [14, 6, 16], [-6, -8, 14], [8, -6, 14]];
    for (var i = 0; i < puffs.length; i++) { ctx.beginPath(); ctx.arc(puffs[i][0], puffs[i][1], puffs[i][2], 0, 7); ctx.fill(); }
    ctx.fillStyle = col.hi;
    for (i = 0; i < puffs.length; i++) { ctx.beginPath(); ctx.arc(puffs[i][0] - 2, puffs[i][1] - 4, puffs[i][2] * 0.72, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(-8, -10, 6, 0, 7); ctx.fill();
    ctx.restore();
  };

  // ---- Entities ----
  function ip(a, b, al) { return a + (b - a) * al; }

  Renderer.prototype.drawEntities = function (sets, camera, alpha, t) {
    var ctx = this.ctx;
    // Reihenfolge: winds < platforms < gems/keys < boxes < doors/barriers < mushrooms < teleporters < player
    var i;
    for (i = 0; i < sets.winds.length; i++) this._wind(sets.winds[i], t);
    for (i = 0; i < sets.teleporters.length; i++) this._teleporter(sets.teleporters[i], t);
    for (i = 0; i < sets.movers.length; i++) this._mover(sets.movers[i], alpha);
    for (i = 0; i < sets.mushrooms.length; i++) this._mushroom(sets.mushrooms[i]);
    for (i = 0; i < sets.plates.length; i++) this._plate(sets.plates[i]);
    for (i = 0; i < sets.gems.length; i++) this._gem(sets.gems[i], t);
    for (i = 0; i < sets.keys.length; i++) this._key(sets.keys[i], t);
    for (i = 0; i < sets.boxes.length; i++) this._box(sets.boxes[i], alpha);
    for (i = 0; i < sets.doors.length; i++) this._door(sets.doors[i]);
    for (i = 0; i < sets.barriers.length; i++) this._barrier(sets.barriers[i], t);
    this._goalFlag(sets.goal, t);
    this._player(sets.player, alpha, t);
  };

  Renderer.prototype._shadow = function (x, y, w) {
    var ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.28, 0, 0, 7); ctx.fill();
  };

  Renderer.prototype._player = function (pl, alpha, t) {
    if (!pl) return;
    var ctx = this.ctx;
    var x = ip(pl.prevX, pl.x, alpha), y = ip(pl.prevY, pl.y, alpha);
    var cx = x + pl.w / 2, feet = y + pl.h;
    this._shadow(cx, feet - 1, pl.w * 0.5);
    ctx.save();
    ctx.translate(cx, feet);
    var wob = (pl.walkPhase ? Math.sin(pl.walkPhase) * 0.06 : 0);
    ctx.rotate(wob);
    ctx.scale(pl.stretch, pl.squash);
    var bw = pl.w, bh = pl.h;
    // Körper
    var g = ctx.createLinearGradient(0, -bh, 0, 0);
    g.addColorStop(0, P.player.hi); g.addColorStop(0.5, P.player.body); g.addColorStop(1, P.player.shadow);
    ctx.fillStyle = g; ctx.strokeStyle = P.player.outline; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    BR.roundRect(ctx, -bw / 2, -bh, bw, bh, bw / 2); ctx.fill(); ctx.stroke();
    // Bauch
    ctx.fillStyle = P.player.belly;
    BR.roundRect(ctx, -bw / 2 + 5, -bh + 12, bw - 10, bh - 16, 6); ctx.fill();
    // Augen
    var face = pl.face || 1;
    var ex = 4 * face;
    ctx.fillStyle = P.player.eye;
    var eyeH = pl.blink > 0 ? 1.5 : 6;
    ctx.beginPath(); ctx.ellipse(-4 + ex, -bh + 15, 3, eyeH, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6 + ex, -bh + 15, 3, eyeH, 0, 0, 7); ctx.fill();
    if (pl.blink <= 0) {
      ctx.fillStyle = P.player.eyeShine;
      ctx.beginPath(); ctx.arc(-5 + ex, -bh + 13, 1.3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(5 + ex, -bh + 13, 1.3, 0, 7); ctx.fill();
    }
    // Wangen
    ctx.fillStyle = 'rgba(255,157,176,0.7)';
    ctx.beginPath(); ctx.arc(-8, -bh + 20, 2.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -bh + 20, 2.5, 0, 7); ctx.fill();
    ctx.restore();
  };

  Renderer.prototype._gem = function (gm, t) {
    if (gm.collected) return;
    var ctx = this.ctx, col = P.gems[gm.color];
    var cx = gm.x + gm.w / 2, cy = gm.y + gm.h / 2 + Math.sin(t * 2 + gm.bob) * 3;
    var sxs = 0.7 + 0.3 * Math.abs(Math.sin(t * 1.5 + gm.bob));
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sxs, 1);
    var glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
    glow.addColorStop(0, col.base); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.35; ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = col.dark; ctx.strokeStyle = P.player.outline; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(8, -2); ctx.lineTo(5, 9); ctx.lineTo(-5, 9); ctx.lineTo(-8, -2); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = col.base;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(8, -2); ctx.lineTo(0, 2); ctx.lineTo(-8, -2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col.shine;
    ctx.beginPath(); ctx.moveTo(-2, -6); ctx.lineTo(2, -6); ctx.lineTo(0, -1); ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  Renderer.prototype._key = function (k, t) {
    if (k.taken) return;
    var ctx = this.ctx, cx = k.x + k.w / 2, cy = k.y + k.h / 2 + Math.sin(t * 2) * 3;
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = P.key.outline; ctx.lineWidth = 2;
    ctx.fillStyle = P.key.body;
    ctx.beginPath(); ctx.arc(0, -7, 6, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.key.dark; ctx.beginPath(); ctx.arc(0, -7, 2.5, 0, 7); ctx.fill();
    ctx.fillStyle = P.key.body;
    BR.roundRect(ctx, -2, -3, 4, 14, 2); ctx.fill(); ctx.stroke();
    ctx.fillRect(2, 6, 4, 2); ctx.fillRect(2, 10, 5, 2);
    ctx.restore();
  };

  Renderer.prototype._door = function (d) {
    if (d.open) return;
    var ctx = this.ctx;
    var g = ctx.createLinearGradient(d.x, 0, d.x + d.w, 0);
    g.addColorStop(0, P.door.dark); g.addColorStop(0.5, P.door.mid); g.addColorStop(1, P.door.dark);
    ctx.fillStyle = g; ctx.strokeStyle = P.door.outline; ctx.lineWidth = 2;
    BR.roundRect(ctx, d.x + 2, d.y, d.w - 4, d.h, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.door.hi;
    ctx.beginPath(); ctx.arc(d.x + d.w - 8, d.y + d.h / 2, 2.5, 0, 7); ctx.fill();
    // Schlüsselloch
    ctx.fillStyle = P.door.outline;
    ctx.beginPath(); ctx.arc(d.x + d.w / 2, d.y + d.h * 0.4, 3, 0, 7); ctx.fill();
  };

  Renderer.prototype._barrier = function (b, t) {
    var ctx = this.ctx, col = P.barrier[b.color];
    if (!b.solidNow) {
      ctx.globalAlpha = 0.18;
    }
    var g = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
    g.addColorStop(0, col); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.globalAlpha *= (b.solidNow ? 0.85 : 0.18);
    BR.roundRect(ctx, b.x + 6, b.y, b.w - 12, b.h, 5); ctx.fill();
    // Energie-Linien
    ctx.globalAlpha = b.solidNow ? 0.5 : 0.12;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    for (var yy = b.y + 6; yy < b.y + b.h; yy += 10) {
      ctx.beginPath(); ctx.moveTo(b.x + 8, yy + Math.sin(t * 4 + yy) * 1.5); ctx.lineTo(b.x + b.w - 8, yy); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  Renderer.prototype._plate = function (pl) {
    var ctx = this.ctx, col = P.barrier[pl.color];
    var yy = pl.y + (pl.on ? 4 : 0);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(pl.x, pl.y + 6, pl.w, 4);
    ctx.fillStyle = col;
    BR.roundRect(ctx, pl.x, yy, pl.w, 8, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    BR.roundRect(ctx, pl.x + 2, yy, pl.w - 4, 3, 2); ctx.fill();
  };

  Renderer.prototype._mover = function (m, alpha) {
    var ctx = this.ctx;
    var x = ip(m.prevX, m.x, alpha), y = ip(m.prevY, m.y, alpha);
    this._shadow(x + m.w / 2, y + m.h + 4, m.w * 0.45);
    var g = ctx.createLinearGradient(0, y, 0, y + m.h);
    g.addColorStop(0, P.plat.hi); g.addColorStop(1, P.plat.dark);
    ctx.fillStyle = g; ctx.strokeStyle = P.plat.mover; ctx.lineWidth = 2.5;
    BR.roundRect(ctx, x, y, m.w, m.h, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.plat.top; ctx.fillRect(x + 2, y, m.w - 4, 4);
    // Pfeil-Indikator
    ctx.fillStyle = P.plat.mover;
    var midx = x + m.w / 2, midy = y + m.h / 2;
    if (m.axis === 'x') { ctx.beginPath(); ctx.moveTo(midx - 4, midy + 4); ctx.lineTo(midx + 4, midy + 4); ctx.lineTo(midx, midy + 8); ctx.closePath(); ctx.fill(); }
  };

  Renderer.prototype._box = function (b, alpha) {
    var ctx = this.ctx;
    var x = ip(b.prevX, b.x, alpha), y = ip(b.prevY, b.y, alpha);
    this._shadow(x + b.w / 2, y + b.h + 2, b.w * 0.45);
    var g = ctx.createLinearGradient(0, y, 0, y + b.h);
    g.addColorStop(0, P.box.hi); g.addColorStop(0.5, P.box.mid); g.addColorStop(1, P.box.dark);
    ctx.fillStyle = g; ctx.strokeStyle = P.box.outline; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    BR.roundRect(ctx, x, y, b.w, b.h, 5); ctx.fill(); ctx.stroke();
    // Holz-Kreuz
    ctx.strokeStyle = 'rgba(94,61,34,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + b.w - 4, y + b.h - 4);
    ctx.moveTo(x + b.w - 4, y + 4); ctx.lineTo(x + 4, y + b.h - 4); ctx.stroke();
  };

  Renderer.prototype._mushroom = function (m) {
    var ctx = this.ctx, x = m.x, y = m.y;
    var sq = m.squish || 0;
    ctx.fillStyle = '#F0F0F0';
    BR.roundRect(ctx, x + m.w / 2 - 4, y + 4, 8, m.h - 4, 3); ctx.fill();
    var g = ctx.createLinearGradient(0, y - sq, 0, y + 12);
    g.addColorStop(0, '#FF8C7A'); g.addColorStop(1, '#E85C4A');
    ctx.fillStyle = g; ctx.strokeStyle = P.player.outline; ctx.lineWidth = 2;
    BR.roundRect(ctx, x - 2, y + sq, m.w + 4, 12 - sq, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(x + 6, y + 5 + sq, 2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + m.w - 6, y + 6 + sq, 1.6, 0, 7); ctx.fill();
  };

  Renderer.prototype._teleporter = function (tp, t) {
    var ctx = this.ctx, cx = tp.x + tp.w / 2;
    ctx.save();
    for (var i = 0; i < 3; i++) {
      var rr = 6 + i * 6 + Math.sin(t * 3 + tp.phase + i) * 2;
      ctx.globalAlpha = 0.5 - i * 0.12;
      ctx.strokeStyle = P.tele.ring; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, tp.y + tp.h / 2, rr * 0.7, rr, 0, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 0.8;
    var g = ctx.createRadialGradient(cx, tp.y + tp.h / 2, 1, cx, tp.y + tp.h / 2, 12);
    g.addColorStop(0, P.tele.spark); g.addColorStop(1, P.tele.core);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, tp.y + tp.h / 2, 7, 14, 0, 0, 7); ctx.fill();
    ctx.restore();
  };

  Renderer.prototype._wind = function (w, t) {
    var ctx = this.ctx;
    ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = P.wind.arrow; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var phase = (t * 60 + i * 40) % TILE;
      var yy = w.y + TILE - phase;
      var xx = w.x + 6 + i * 8;
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - 8);
      ctx.moveTo(xx - 3, yy - 5); ctx.lineTo(xx, yy - 8); ctx.lineTo(xx + 3, yy - 5); ctx.stroke();
    }
    ctx.restore();
  };

  Renderer.prototype._goalFlag = function (goal, t) {
    if (!goal) return;
    var ctx = this.ctx, x = goal.x, y = goal.y;
    // Portal/Fahne
    var poleX = x + 8;
    ctx.strokeStyle = '#8A6E3E'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(poleX, y + TILE); ctx.lineTo(poleX, y - 4); ctx.stroke();
    var g = ctx.createLinearGradient(poleX, 0, poleX + 22, 0);
    g.addColorStop(0, '#3EE07A'); g.addColorStop(1, '#1F9E4E');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(poleX, y - 2);
    ctx.lineTo(poleX + 20, y + 3 + Math.sin(t * 4) * 2);
    ctx.lineTo(poleX, y + 10); ctx.closePath(); ctx.fill();
    // funkelnder Stern oben
    var sa = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.fillStyle = 'rgba(255,201,77,' + sa + ')';
    ctx.beginPath(); ctx.arc(poleX, y - 6, 3, 0, 7); ctx.fill();
  };

  BR.Renderer = Renderer;

})(window.BR = window.BR || {});
