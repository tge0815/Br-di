/* Br-di — physics.js
 * AABB-Kollision gegen Tilemap + bewegliche Solids. Spec §10.3.
 * Auflösung X-Achse dann Y-Achse. Bewegung pro Tick < TILE -> kein Tunneling.
 */
(function (BR) {
  'use strict';

  var T = BR.TileType, TILE = BR.TILE, EPS = 0.001;

  BR.aabbOverlap = function (a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  function isSolidTile(v) { return v === T.SOLID; }

  // --- X-Achse gegen Tiles ---
  function collideTilesX(e, level) {
    var top = Math.floor(e.y / TILE);
    var bottom = Math.floor((e.y + e.h - EPS) / TILE);
    var col, row;
    if (e.vx > 0) {
      col = Math.floor((e.x + e.w - EPS) / TILE);
      for (row = top; row <= bottom; row++) {
        if (isSolidTile(level.tile(col, row))) {
          e.x = col * TILE - e.w; e.vx = 0; e.touching.r = true; return;
        }
      }
    } else if (e.vx < 0) {
      col = Math.floor(e.x / TILE);
      for (row = top; row <= bottom; row++) {
        if (isSolidTile(level.tile(col, row))) {
          e.x = (col + 1) * TILE; e.vx = 0; e.touching.l = true; return;
        }
      }
    }
  }

  // --- Y-Achse gegen Tiles (inkl. Einweg) ---
  function collideTilesY(e, level, oldBottom, dropThrough) {
    var left = Math.floor(e.x / TILE);
    var right = Math.floor((e.x + e.w - EPS) / TILE);
    var row, colc;
    if (e.vy > 0) {
      row = Math.floor((e.y + e.h - EPS) / TILE);
      for (colc = left; colc <= right; colc++) {
        var tv = level.tile(colc, row);
        if (isSolidTile(tv)) {
          e.y = row * TILE - e.h; e.vy = 0; e.onGround = true; e.touching.d = true; return;
        }
        if (tv === T.ONEWAY && !dropThrough) {
          var top = row * TILE;
          if (oldBottom <= top + 1) {
            e.y = top - e.h; e.vy = 0; e.onGround = true; e.touching.d = true; return;
          }
        }
      }
    } else if (e.vy < 0) {
      row = Math.floor(e.y / TILE);
      for (colc = left; colc <= right; colc++) {
        if (isSolidTile(level.tile(colc, row))) {
          e.y = (row + 1) * TILE; e.vy = 0; e.touching.u = true; return;
        }
      }
    }
  }

  // --- gegen bewegliche Solids (Movers/Boxes/Barrieren/Türen) ---
  function collideSolidsX(e, solids) {
    for (var i = 0; i < solids.length; i++) {
      var s = solids[i];
      if (s === e || s.oneway) continue;
      if (!BR.aabbOverlap(e, s)) continue;
      if (e.vx > 0) { e.x = s.x - e.w; e.vx = 0; e.touching.r = true; }
      else if (e.vx < 0) { e.x = s.x + s.w; e.vx = 0; e.touching.l = true; }
      else {
        // stationär hineingedrückt: kleinstmögliche Trennung
        var dl = (e.x + e.w) - s.x, dr = (s.x + s.w) - e.x;
        if (dl < dr) e.x = s.x - e.w; else e.x = s.x + s.w;
      }
    }
  }

  function collideSolidsY(e, solids, oldBottom) {
    for (var i = 0; i < solids.length; i++) {
      var s = solids[i];
      if (s === e) continue;
      if (!BR.aabbOverlap(e, s)) continue;
      if (s.oneway) {
        if (e.vy > 0 && oldBottom <= s.y + 1) { e.y = s.y - e.h; e.vy = 0; e.onGround = true; e.touching.d = true; e.standingOn = s; }
        continue;
      }
      if (e.vy > 0) { e.y = s.y - e.h; e.vy = 0; e.onGround = true; e.touching.d = true; e.standingOn = s; }
      else if (e.vy < 0) { e.y = s.y + s.h; e.vy = 0; e.touching.u = true; }
    }
  }

  // Haupt-Auflösung: mutiert e.x/e.y/e.vx/e.vy, setzt onGround/touching/standingOn.
  BR.resolveEntity = function (e, level, solids, dt, dropThrough) {
    e.touching = { l: false, r: false, u: false, d: false };
    e.onGround = false;
    e.standingOn = null;

    // X
    e.x += e.vx * dt;
    collideTilesX(e, level);
    collideSolidsX(e, solids);

    // Y
    var oldBottom = e.y + e.h;
    e.y += e.vy * dt;
    collideTilesY(e, level, oldBottom, dropThrough);
    collideSolidsY(e, solids, oldBottom);
  };

  // Prüft ob eine Box (1px unter e) auf einem Solid/Tile ruht -> Support-Objekt oder null.
  BR.supportBelow = function (e, level, solids) {
    var probe = { x: e.x + 2, y: e.y + e.h, w: e.w - 4, h: 2 };
    // Tiles
    var left = Math.floor(probe.x / TILE);
    var right = Math.floor((probe.x + probe.w - EPS) / TILE);
    var row = Math.floor((probe.y + 1) / TILE);
    for (var c = left; c <= right; c++) {
      var tv = level.tile(c, row);
      if (tv === T.SOLID) return { tile: true };
      if (tv === T.ONEWAY && (row * TILE) >= (e.y + e.h) - 1) return { tile: true };
    }
    // Solids
    for (var i = 0; i < solids.length; i++) {
      var s = solids[i];
      if (s === e) continue;
      if (BR.aabbOverlap(probe, s) && s.y >= (e.y + e.h) - 2) return s;
    }
    return null;
  };

})(window.BR = window.BR || {});
