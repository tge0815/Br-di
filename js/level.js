/* Br-di — level.js
 * ASCII-Grid -> Level (Tilemap + Objekt-Specs). Spec §5.
 */
(function (BR) {
  'use strict';

  var T = BR.TileType, TILE = BR.TILE;

  function Level() {
    this.width = 0; this.height = 0;
    this.tiles = null;              // Uint8Array TileType
    this.mat = null;                // 0=dirt('='), 1=grass('#'), 2=water, 3=thorn
    this.spawn = { x: 0, y: 0 };    // top-left px der Spieler-Hitbox
    this.goal = { x: 0, y: 0, w: TILE, h: TILE };
    this.specs = [];                // Objekt-Beschreibungen
    this.meta = {};
  }
  Level.prototype.inBounds = function (tx, ty) {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  };
  Level.prototype.tile = function (tx, ty) {
    if (!this.inBounds(tx, ty)) return ty >= this.height ? T.EMPTY : T.SOLID; // Seiten/oben solide, unten offen
    return this.tiles[ty * this.width + tx];
  };
  Level.prototype.setTile = function (tx, ty, v) {
    if (this.inBounds(tx, ty)) this.tiles[ty * this.width + tx] = v;
  };
  Level.prototype.material = function (tx, ty) {
    if (!this.inBounds(tx, ty)) return 0;
    return this.mat[ty * this.width + tx];
  };
  Object.defineProperty(Level.prototype, 'pixelWidth', { get: function () { return this.width * TILE; } });
  Object.defineProperty(Level.prototype, 'pixelHeight', { get: function () { return this.height * TILE; } });

  // Glyph -> Objekt-Typ
  var OBJ = {
    'H': { type: 'mover', axis: 'x' },
    'V': { type: 'mover', axis: 'y' },
    '^': { type: 'mushroom' },
    'K': { type: 'key' },
    'D': { type: 'door' },
    '1': { type: 'plate', color: 'red' },
    '2': { type: 'plate', color: 'green' },
    '3': { type: 'plate', color: 'blue' },
    '!': { type: 'barrier', color: 'red' },
    '?': { type: 'barrier', color: 'green' },
    '%': { type: 'barrier', color: 'blue' },
    'O': { type: 'box' },
    'T': { type: 'teleporter' },
    'W': { type: 'wind' },
    'r': { type: 'gem', color: 'red' },
    'g': { type: 'gem', color: 'green' },
    'b': { type: 'gem', color: 'blue' },
    '"': { type: 'tree' },
    'o': { type: 'cloud' }
  };

  // rows: Array von Strings. meta: {id,name,par,mode,difficulty,...}
  // configs: optionale objects[] mit tile-Koordinaten (für Mover-Pfade / Teleporter-Pairs)
  BR.parseLevel = function (rows, meta, configs) {
    meta = meta || {};
    configs = configs || [];
    var h = rows.length;
    var w = 0;
    var i;
    for (i = 0; i < h; i++) w = Math.max(w, rows[i].length);

    var lvl = new Level();
    lvl.width = w; lvl.height = h;
    lvl.tiles = new Uint8Array(w * h);
    lvl.mat = new Uint8Array(w * h);
    lvl.meta = meta;

    var telePts = [];
    var y, x, ch, idx;
    for (y = 0; y < h; y++) {
      var row = rows[y];
      for (x = 0; x < w; x++) {
        ch = x < row.length ? row[x] : '.';
        idx = y * w + x;
        if (ch === '#') { lvl.tiles[idx] = T.SOLID; lvl.mat[idx] = 1; }
        else if (ch === '=') { lvl.tiles[idx] = T.SOLID; lvl.mat[idx] = 0; }
        else if (ch === ':') { lvl.tiles[idx] = T.ONEWAY; }
        else if (ch === '*') { lvl.tiles[idx] = T.HAZARD; lvl.mat[idx] = 3; }
        else if (ch === '~') { lvl.tiles[idx] = T.HAZARD; lvl.mat[idx] = 2; }
        else if (ch === 'S') {
          lvl.spawn.x = (x + 0.5) * TILE - BR.PLAYER_W / 2;
          lvl.spawn.y = (y + 1) * TILE - BR.PLAYER_H;
        }
        else if (ch === 'X') {
          lvl.goal.x = x * TILE; lvl.goal.y = y * TILE;
        }
        else if (OBJ[ch]) {
          var o = OBJ[ch];
          var spec = { type: o.type, tx: x, ty: y };
          if (o.color) spec.color = o.color;
          if (o.axis) spec.axis = o.axis;
          if (o.type === 'teleporter') telePts.push(spec);
          lvl.specs.push(spec);
        }
        // '.' oder ' ' oder alles andere -> EMPTY (bereits 0)
      }
    }

    // Teleporter paaren (in Reihenfolge)
    for (i = 0; i + 1 < telePts.length; i += 2) {
      telePts[i].pair = telePts[i + 1];
      telePts[i + 1].pair = telePts[i];
    }

    // Configs auf Mover/Teleporter anwenden
    for (i = 0; i < configs.length; i++) {
      var cfg = configs[i];
      if (!cfg.tile) continue;
      for (var s = 0; s < lvl.specs.length; s++) {
        var sp = lvl.specs[s];
        if (sp.tx === cfg.tile[0] && sp.ty === cfg.tile[1]) {
          for (var kk in cfg) if (kk !== 'tile') sp[kk] = cfg[kk];
        }
      }
    }

    return lvl;
  };

})(window.BR = window.BR || {});
