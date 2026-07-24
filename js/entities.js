/* Br-di — entities.js
 * Spieler + interaktive Objekte. Spec §4, §10.3.
 */
(function (BR) {
  'use strict';

  var TILE = BR.TILE;
  var C = BR;

  // ---------- Basis ----------
  function Entity(x, y, w, h, type) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.prevX = x; this.prevY = y;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.touching = { l: false, r: false, u: false, d: false };
    this.standingOn = null;
    this.alive = true;
    this.type = type;
  }
  Entity.prototype.savePrev = function () { this.prevX = this.x; this.prevY = this.y; };
  Object.defineProperty(Entity.prototype, 'cx', { get: function () { return this.x + this.w / 2; } });
  Object.defineProperty(Entity.prototype, 'cy', { get: function () { return this.y + this.h / 2; } });
  BR.Entity = Entity;

  // ---------- Player ----------
  function Player(spawn) {
    Entity.call(this, spawn.x, spawn.y, BR.PLAYER_W, BR.PLAYER_H, 'player');
    this.spawn = { x: spawn.x, y: spawn.y };
    this.reset();
  }
  Player.prototype = Object.create(Entity.prototype);
  Player.prototype.constructor = Player;

  Player.prototype.reset = function () {
    this.x = this.spawn.x; this.y = this.spawn.y;
    this.prevX = this.x; this.prevY = this.y;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.coyote = 0; this.jumpBuffer = 0; this.jumpHeld = false;
    this.wallCoyote = 0; this.wallDir = 0; this.wallJumpLock = 0;
    this.dropTimer = 0;
    this.dashTime = 0; this.dashCd = 0; this.dashAvailable = true;
    this.usedDouble = false;
    this.face = 1;
    this.hasKey = false;
    this.gems = { red: 0, green: 0, blue: 0 };
    this.canDash = false; this.canDoubleJump = false;
    // Animation
    this.squash = 1; this.stretch = 1; this.blink = 0; this.blinkTimer = 2 + Math.random() * 3;
    this.landAnim = 0; this.walkPhase = 0; this.wallSliding = false;
    this.dead = false; this.deathTimer = 0;
  };

  Player.prototype.update = function (dt, ctx) {
    var input = ctx.input;
    var wasGround = this.onGround;

    // Facing
    if (input.dir !== 0) this.face = input.dir;

    // Timers
    if (this.wallJumpLock > 0) this.wallJumpLock -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    this.dropTimer = Math.max(0, this.dropTimer - dt);

    // Dash
    if (this.canDash && input.actionPressed && this.dashAvailable && this.dashCd <= 0 && this.dashTime <= 0) {
      this.dashTime = BR.DASH_TIME; this.dashAvailable = false; this.dashCd = BR.DASH_COOLDOWN;
      this.vx = this.face * BR.DASH_SPEED; this.vy = 0;
      if (ctx.audio) ctx.audio.sfx('jump');
    }

    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.vx = this.face * BR.DASH_SPEED;
      this.vy = 0;
    } else {
      // --- Horizontal ---
      var canControl = this.wallJumpLock <= 0;
      if (canControl && input.dir !== 0) {
        var a = this.onGround ? BR.RUN_ACCEL : BR.AIR_ACCEL;
        if (BR.sign(input.dir) !== BR.sign(this.vx) && this.vx !== 0) a = this.onGround ? BR.TURN_ACCEL : BR.AIR_ACCEL;
        this.vx += input.dir * a * dt;
        this.vx = BR.clamp(this.vx, -BR.MAX_RUN_SPEED, BR.MAX_RUN_SPEED);
      } else if (canControl) {
        var d = this.onGround ? BR.RUN_DECEL : BR.AIR_DECEL;
        this.vx = BR.approach(this.vx, 0, d * dt);
      }

      // --- Coyote / Wall-Coyote / Buffer ---
      this.coyote = this.onGround ? BR.COYOTE_TIME : Math.max(0, this.coyote - dt);
      var onWall = !this.onGround && (this.touching.l || this.touching.r);
      if (onWall) { this.wallCoyote = BR.WALL_COYOTE; this.wallDir = this.touching.l ? -1 : 1; }
      else this.wallCoyote = Math.max(0, this.wallCoyote - dt);
      this.jumpBuffer = input.jumpPressed ? BR.JUMP_BUFFER : Math.max(0, this.jumpBuffer - dt);

      // Drop durch Einweg
      if (input.down && input.jumpPressed) { this.dropTimer = BR.ONEWAY_DROP; this.jumpBuffer = 0; if (this.onGround) this.vy = 40; }

      // --- Sprung ---
      if (this.jumpBuffer > 0) {
        if (this.onGround || this.coyote > 0) {
          this.vy = BR.JUMP_VELOCITY; this.onGround = false; this.coyote = 0;
          this.jumpBuffer = 0; this.jumpHeld = true;
          if (ctx.audio) ctx.audio.sfx('jump');
          if (ctx.particles) ctx.particles.burst(this.cx, this.y + this.h, 'jump', 5);
        } else if (this.wallCoyote > 0) {
          this.vx = -this.wallDir * BR.WALL_JUMP_VX; this.vy = BR.WALL_JUMP_VY;
          this.wallJumpLock = BR.WALL_JUMP_LOCK; this.jumpBuffer = 0; this.jumpHeld = true; this.wallCoyote = 0;
          this.face = -this.wallDir;
          if (ctx.audio) ctx.audio.sfx('walljump');
        } else if (this.canDoubleJump && !this.usedDouble) {
          this.vy = BR.DOUBLE_JUMP_V; this.usedDouble = true; this.jumpBuffer = 0; this.jumpHeld = true;
          if (ctx.audio) ctx.audio.sfx('jump');
        }
      }
      if (input.jumpReleased || !input.jump) this.jumpHeld = false;

      // --- Gravitation ---
      this.wallSliding = !this.onGround && this.vy > 0 &&
        ((this.touching.l && input.left) || (this.touching.r && input.right));
      var g;
      if (this.vy < 0 && !this.jumpHeld) g = BR.GRAVITY_RELEASE;
      else if (Math.abs(this.vy) < BR.APEX_THRESHOLD) g = BR.GRAVITY_APEX;
      else g = BR.GRAVITY;
      this.vy += g * dt;

      // Wind
      if (ctx.winds) {
        for (var wi = 0; wi < ctx.winds.length; wi++) {
          if (BR.aabbOverlap(this, ctx.winds[wi])) { this.vy += BR.WIND_UP * dt; break; }
        }
      }

      if (this.wallSliding) this.vy = Math.min(this.vy, BR.WALL_SLIDE_SPEED);
      this.vy = Math.min(this.vy, BR.TERMINAL);
    }

    // Reset bei Boden
    if (this.onGround) { this.usedDouble = false; this.dashAvailable = true; }

    // --- Animation ---
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) { this.blink = 0.12; this.blinkTimer = 2 + Math.random() * 3; }
    if (this.blink > 0) this.blink -= dt;
    if (!wasGround && this.onGround && this.vy >= 0) {
      this.landAnim = 0.14;
      if (ctx.particles) ctx.particles.burst(this.cx, this.y + this.h, 'dust', 6);
    }
    if (this.landAnim > 0) this.landAnim -= dt;
    var targetSquash = 1, targetStretch = 1;
    if (this.landAnim > 0) { targetSquash = 1.25; targetStretch = 0.75; }
    else if (!this.onGround) {
      var s = BR.clamp(this.vy * 0.0016, -0.25, 0.3);
      targetSquash = 1 - s; targetStretch = 1 + s;
    }
    this.squash = BR.lerp(this.squash, targetSquash, 0.3);
    this.stretch = BR.lerp(this.stretch, targetStretch, 0.3);
    if (Math.abs(this.vx) > 5 && this.onGround) this.walkPhase += dt * 14; else this.walkPhase = 0;
  };

  Player.prototype.aabbHazard = function () {
    // 4px kleinere Hazard-Hitbox (vergebend)
    return { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 6 };
  };
  BR.Player = Player;

  // ---------- Gem ----------
  function Gem(spec) {
    Entity.call(this, spec.tx * TILE + (TILE - 20) / 2, spec.ty * TILE + (TILE - 20) / 2, 20, 20, 'gem');
    this.color = spec.color; this.collected = false; this.bob = Math.random() * Math.PI * 2;
  }
  Gem.prototype = Object.create(Entity.prototype);
  BR.Gem = Gem;

  // ---------- Key ----------
  function KeyItem(spec) {
    Entity.call(this, spec.tx * TILE + (TILE - 20) / 2, spec.ty * TILE + (TILE - 28) / 2, 20, 28, 'key');
    this.taken = false; this.bob = 0;
  }
  KeyItem.prototype = Object.create(Entity.prototype);
  BR.KeyItem = KeyItem;

  // ---------- Door ----------
  // Tür ragt 2 Kacheln über ihren Glyph hinaus, damit sie nicht trivial übersprungen wird.
  function Door(spec) {
    Entity.call(this, spec.tx * TILE, (spec.ty - 2) * TILE, TILE, 3 * TILE, 'door');
    this.open = false; this.oneway = false; this.openAnim = 0;
  }
  Door.prototype = Object.create(Entity.prototype);
  BR.Door = Door;

  // ---------- Plate ----------
  function Plate(spec) {
    Entity.call(this, spec.tx * TILE + 4, spec.ty * TILE + TILE - 10, TILE - 8, 10, 'plate');
    this.color = spec.color; this.on = false; this.press = 0;
  }
  Plate.prototype = Object.create(Entity.prototype);
  BR.Plate = Plate;

  // ---------- Barrier ----------
  // Barriere ragt 2 Kacheln über ihren Glyph hinaus (stapelt sich zu einer hohen Wand).
  function Barrier(spec) {
    Entity.call(this, spec.tx * TILE, (spec.ty - 2) * TILE, TILE, 3 * TILE, 'barrier');
    this.glyphY = spec.ty * TILE;
    this.color = spec.color; this.oneway = false; this.solidNow = true; this.alpha = 1;
  }
  Barrier.prototype = Object.create(Entity.prototype);
  BR.Barrier = Barrier;

  // ---------- Mover ----------
  function Mover(spec) {
    var w = (spec.wTiles || 1) * TILE, h = (spec.hTiles || 1) * TILE;
    Entity.call(this, spec.tx * TILE, spec.ty * TILE + (TILE - Math.min(h, 14)), w, 14, 'mover');
    this.h = 14; // dünne Plattform, oben ausgerichtet an Tile-Top
    this.y = spec.ty * TILE + 2;
    this.axis = spec.axis || 'x';
    this.speed = spec.speed || 100;
    this.oneway = false;
    // Pfad (Welt-px, top-left)
    var sx = spec.tx * TILE, sy = spec.ty * TILE + 2;
    if (spec.path && spec.path.length >= 2) {
      this.path = spec.path.map(function (p) { return { x: p[0] * TILE, y: p[1] * TILE + 2 }; });
    } else {
      var amp = 3 * TILE;
      if (this.axis === 'x') this.path = [{ x: sx, y: sy }, { x: sx + amp, y: sy }];
      else this.path = [{ x: sx, y: sy }, { x: sx, y: sy - amp }];
    }
    this.mode = spec.mode || 'pingpong';
    this.seg = 0; this.t = 0; this.forward = true;
    this.dx = 0; this.dy = 0;
    this.x = this.path[0].x; this.y = this.path[0].y;
  }
  Mover.prototype = Object.create(Entity.prototype);
  Mover.prototype.update = function (dt) {
    var a = this.path[this.seg];
    var b = this.path[this.forward ? (this.seg + 1) % this.path.length : (this.seg - 1 + this.path.length) % this.path.length];
    // Für pingpong nutzen wir eine lineare Kette hin und zurück
    var next = this.path[this.seg + (this.forward ? 1 : -1)];
    if (!next) { this.forward = !this.forward; next = this.path[this.seg + (this.forward ? 1 : -1)]; if (!next) return; }
    var segLen = Math.hypot(next.x - this.path[this.seg].x, next.y - this.path[this.seg].y) || 1;
    this.t += (this.speed * dt) / segLen;
    var px = this.x, py = this.y;
    if (this.t >= 1) {
      this.t = 0; this.seg += this.forward ? 1 : -1;
      if (this.seg >= this.path.length - 1) { this.seg = this.path.length - 1; this.forward = false; }
      else if (this.seg <= 0) { this.seg = 0; this.forward = true; }
    }
    var from = this.path[this.seg];
    var to = this.path[this.seg + (this.forward ? 1 : -1)] || from;
    var e = BR.ease.inOutSine(this.t);
    this.x = BR.lerp(from.x, to.x, e);
    this.y = BR.lerp(from.y, to.y, e);
    this.dx = this.x - px; this.dy = this.y - py;
  };
  BR.Mover = Mover;

  // ---------- Box ----------
  function Box(spec) {
    Entity.call(this, spec.tx * TILE + 1, spec.ty * TILE + 2, TILE - 2, TILE - 2, 'box');
    this.oneway = false; this.startX = this.x; this.startY = this.y;
  }
  Box.prototype = Object.create(Entity.prototype);
  BR.Box = Box;

  // ---------- Mushroom ----------
  function Mushroom(spec) {
    Entity.call(this, spec.tx * TILE + 2, spec.ty * TILE + TILE - 14, TILE - 4, 14, 'mushroom');
    this.squish = 0;
  }
  Mushroom.prototype = Object.create(Entity.prototype);
  BR.Mushroom = Mushroom;

  // ---------- Teleporter ----------
  function Teleporter(spec) {
    Entity.call(this, spec.tx * TILE + 4, spec.ty * TILE + TILE - 40, TILE - 8, 40, 'teleporter');
    this.pairSpec = spec.pair; this.cooldown = 0; this.phase = Math.random() * 6;
  }
  Teleporter.prototype = Object.create(Entity.prototype);
  BR.Teleporter = Teleporter;

  // ---------- WindZone ----------
  function WindZone(spec) {
    Entity.call(this, spec.tx * TILE, spec.ty * TILE, TILE, TILE, 'wind');
  }
  WindZone.prototype = Object.create(Entity.prototype);
  BR.WindZone = WindZone;

  // ---------- Spawn aus Level ----------
  BR.spawnFromLevel = function (level) {
    var out = {
      player: new Player(level.spawn),
      gems: [], keys: [], doors: [], plates: [], barriers: [],
      movers: [], boxes: [], mushrooms: [], teleporters: [], winds: [], deco: []
    };
    var specs = level.specs;
    var usedMover = {};
    var i, sp;

    // Mover mergen (benachbarte gleiche Achse)
    function key(tx, ty) { return tx + ',' + ty; }
    var specMap = {};
    for (i = 0; i < specs.length; i++) {
      sp = specs[i];
      if (sp.type === 'mover') specMap[key(sp.tx, sp.ty)] = sp;
    }

    for (i = 0; i < specs.length; i++) {
      sp = specs[i];
      switch (sp.type) {
        case 'gem': out.gems.push(new Gem(sp)); break;
        case 'key': out.keys.push(new KeyItem(sp)); break;
        case 'door': out.doors.push(new Door(sp)); break;
        case 'plate': out.plates.push(new Plate(sp)); break;
        case 'barrier': out.barriers.push(new Barrier(sp)); break;
        case 'box': out.boxes.push(new Box(sp)); break;
        case 'mushroom': out.mushrooms.push(new Mushroom(sp)); break;
        case 'teleporter': out.teleporters.push(new Teleporter(sp)); break;
        case 'wind': out.winds.push(new WindZone(sp)); break;
        case 'tree': out.deco.push({ kind: 'tree', x: sp.tx * TILE, y: sp.ty * TILE, v: BR.hash32('t' + sp.tx + sp.ty) }); break;
        case 'cloud': out.deco.push({ kind: 'cloud', x: sp.tx * TILE, y: sp.ty * TILE, v: BR.hash32('c' + sp.tx + sp.ty) }); break;
        case 'mover':
          if (usedMover[key(sp.tx, sp.ty)]) break;
          // Merge in Achsen-Richtung
          var wTiles = 1, hTiles = 1;
          if (sp.axis === 'x') {
            var tx = sp.tx;
            while (specMap[key(tx + wTiles, sp.ty)] && specMap[key(tx + wTiles, sp.ty)].axis === 'x') {
              usedMover[key(tx + wTiles, sp.ty)] = true; wTiles++;
            }
          } else {
            var ty = sp.ty;
            while (specMap[key(sp.tx, ty + hTiles)] && specMap[key(sp.tx, ty + hTiles)].axis === 'y') {
              usedMover[key(sp.tx, ty + hTiles)] = true; hTiles++;
            }
          }
          usedMover[key(sp.tx, sp.ty)] = true;
          var mspec = Object.assign({}, sp, { wTiles: wTiles, hTiles: hTiles });
          out.movers.push(new Mover(mspec));
          break;
      }
    }

    // Teleporter-Paar-Referenzen als Instanzen verknüpfen
    for (i = 0; i < out.teleporters.length; i++) {
      var tp = out.teleporters[i];
      if (tp.pairSpec) {
        for (var j = 0; j < out.teleporters.length; j++) {
          var q = out.teleporters[j];
          if (q !== tp && q.x === tp.pairSpec.tx * TILE + 4) { tp.pair = q; break; }
        }
      }
    }
    return out;
  };

})(window.BR = window.BR || {});
