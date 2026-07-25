/* Br-di — main.js
 * Bootstrap, Session, Spiellogik-Pipeline, Zustandsmaschine, HUD. Spec §10.6.
 */
(function (BR) {
  'use strict';

  var TILE = BR.TILE, S = BR.GameState, Mode = BR.Mode, P = BR.PAL;

  function boot() {
    var canvas = document.getElementById('game');
    var uiRoot = document.getElementById('ui');
    var renderer = new BR.Renderer(canvas);
    var camera = new BR.Camera();
    var input = new BR.Input(canvas);
    var particles = new BR.Particles();
    var audio = BR.audio;

    // Audio-Unlock beim ersten Input (+ Musik starten, falls aktiviert)
    input.onFirstInput = function () {
      audio.unlock();
      if (BR.music && BR.music.enabled()) BR.music.start();
    };

    // Mute aus Save
    audio.setMuted(!!BR.save.getSetting('muted'));

    var state = S.MENU;
    var session = null;
    var shake = 0;

    var ui = new BR.UI({
      root: uiRoot,
      onAction: function (kind, payload) { onAction(kind, payload); }
    });
    ui.setMuted(audio.muted);
    if (BR.music) ui.setMusic(BR.music.enabled());
    ui.enableTouch(input);

    // Touch-Controls automatisch bei Touch-Geräten
    var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    function setState(s) {
      state = s;
      var showTouch = isTouch && (s === S.PLAYING || s === S.PAUSED);
      ui.showTouch(showTouch);
    }

    // ---------------- Session ----------------
    function buildLevel(mode, opts) {
      opts = opts || {};
      if (mode === Mode.CAMPAIGN) {
        var lv = BR.CAMPAIGN.levels[opts.index];
        return BR.parseLevel(lv.rows, {
          id: lv.id, name: lv.name, par: lv.par, difficulty: lv.difficulty,
          mode: Mode.CAMPAIGN, index: opts.index
        }, lv.objects);
      } else if (mode === Mode.DAILY) {
        return BR.generateDaily(new Date());
      } else {
        return BR.generateEndless(session ? session.runSeed : (BR.dailySeedFromDate() ^ 0x9e3779b9), opts.section || 0);
      }
    }

    function startSession(mode, opts) {
      opts = opts || {};
      var runSeed = (Date.now ? (Date.now() & 0x7fffffff) : 12345) >>> 0;
      session = {
        mode: mode, index: opts.index || 0, section: 0,
        runSeed: runSeed, level: null, ent: null,
        startedAt: 0, elapsed: 0, deaths: 0, started: false,
        totalElapsed: 0
      };
      loadLevelIntoSession(buildLevel(mode, { index: session.index, section: 0 }));
      ui.hideAll();
      setState(S.PLAYING);
    }

    function loadLevelIntoSession(level) {
      session.level = level;
      session.ent = BR.spawnFromLevel(level);
      session.elapsed = 0; session.started = false;
      session.goalBox = { x: level.goal.x, y: level.goal.y, w: TILE, h: TILE };
      particles.clear();
      camera.reset();
      camera.setView(renderer.cssW, renderer.cssH);
      camera.follow(session.ent.player, level, 1);
    }

    function respawn() {
      // Objekte deterministisch zurücksetzen, Zähler behalten
      var d = session.deaths, e = session.elapsed;
      session.ent = BR.spawnFromLevel(session.level);
      session.deaths = d; session.elapsed = e;
      particles.clear();
    }

    // ---------------- Update-Pipeline ----------------
    function update(dt) {
      var inp = input.sample();

      // Pause/Restart-Kanten überall
      if (inp.pausePressed) {
        if (state === S.PLAYING) { setState(S.PAUSED); ui.showPause(); }
        else if (state === S.PAUSED) { setState(S.PLAYING); ui.hidePause(); }
      }
      if (shake > 0) shake = Math.max(0, shake - dt);

      if (state !== S.PLAYING) return;
      if (inp.restartPressed) { session.deaths++; respawn(); return; }

      var ent = session.ent, level = session.level, player = ent.player;
      if (!session.started && inp.dir !== 0 || inp.jump) session.started = true;
      if (session.started) session.elapsed += dt;

      // savePrev
      player.savePrev();
      var i;
      for (i = 0; i < ent.movers.length; i++) ent.movers[i].savePrev();
      for (i = 0; i < ent.boxes.length; i++) ent.boxes[i].savePrev();

      // 1) Movers
      for (i = 0; i < ent.movers.length; i++) ent.movers[i].update(dt);
      // Carry (player + boxes) auf Movern
      carry(player, ent.movers);
      for (i = 0; i < ent.boxes.length; i++) carry(ent.boxes[i], ent.movers);

      // 2) Box-Intent + Physik
      boxIntent(player, ent.boxes, inp);
      for (i = 0; i < ent.boxes.length; i++) {
        var b = ent.boxes[i];
        b.vy += BR.GRAVITY * dt; b.vy = Math.min(b.vy, BR.TERMINAL);
        BR.resolveEntity(b, level, boxSolids(ent, b), dt, false);
      }

      // 3) Platten/Barrieren/Türen aktualisieren
      updatePlates(ent, player);
      updateDoors(ent, player);

      // 4) Spieler
      player.update(dt, { input: inp, level: level, audio: audio, particles: particles, winds: ent.winds });
      BR.resolveEntity(player, level, playerSolids(ent), dt, player.dropTimer > 0);

      // 5) Trigger
      handleTriggers(ent, player, dt);

      // 6) Tod
      if (isDead(player, level)) { die(); return; }

      // 7) Ziel
      if (BR.aabbOverlap(player, session.goalBox)) { win(); return; }

      particles.update(dt);
    }

    function carry(e, movers) {
      if (e.standingOn && movers.indexOf(e.standingOn) !== -1) {
        e.x += e.standingOn.dx; e.y += e.standingOn.dy;
      }
    }

    function boxIntent(player, boxes, inp) {
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i]; b.vx = 0;
        if (!player.onGround || inp.dir === 0) continue;
        // vertikale Überlappung?
        var vOverlap = player.y < b.y + b.h - 4 && player.y + player.h > b.y + 4;
        if (!vOverlap) continue;
        if (inp.dir > 0 && Math.abs((player.x + player.w) - b.x) < 3) b.vx = BR.PUSH_SPEED;
        else if (inp.dir < 0 && Math.abs(player.x - (b.x + b.w)) < 3) b.vx = -BR.PUSH_SPEED;
      }
    }

    function playerSolids(ent) {
      var s = [];
      var i;
      for (i = 0; i < ent.movers.length; i++) s.push(ent.movers[i]);
      for (i = 0; i < ent.boxes.length; i++) s.push(ent.boxes[i]);
      for (i = 0; i < ent.doors.length; i++) if (!ent.doors[i].open) s.push(ent.doors[i]);
      for (i = 0; i < ent.barriers.length; i++) if (ent.barriers[i].solidNow) s.push(ent.barriers[i]);
      return s;
    }
    function boxSolids(ent, self) {
      var s = [];
      var i;
      for (i = 0; i < ent.movers.length; i++) s.push(ent.movers[i]);
      for (i = 0; i < ent.boxes.length; i++) if (ent.boxes[i] !== self) s.push(ent.boxes[i]);
      for (i = 0; i < ent.doors.length; i++) if (!ent.doors[i].open) s.push(ent.doors[i]);
      for (i = 0; i < ent.barriers.length; i++) if (ent.barriers[i].solidNow) s.push(ent.barriers[i]);
      return s;
    }

    function updatePlates(ent, player) {
      var onByColor = { red: false, green: false, blue: false };
      var i, pl;
      for (i = 0; i < ent.plates.length; i++) {
        pl = ent.plates[i];
        var pressed = BR.aabbOverlap(player, pl);
        if (!pressed) {
          for (var j = 0; j < ent.boxes.length; j++) { if (BR.aabbOverlap(ent.boxes[j], pl)) { pressed = true; break; } }
        }
        if (pressed && !pl.everOn) audio.sfx('plate');
        pl.on = pressed;
        // Einrastend: einmal ausgelöst bleibt die Platte aktiv -> keine Softlocks.
        if (pressed) pl.everOn = true;
        if (pl.everOn) onByColor[pl.color] = true;
        pl.press = BR.lerp(pl.press || 0, (pressed || pl.everOn) ? 1 : 0, 0.3);
      }
      for (i = 0; i < ent.barriers.length; i++) {
        ent.barriers[i].solidNow = !onByColor[ent.barriers[i].color];
      }
    }

    function updateDoors(ent, player) {
      for (var i = 0; i < ent.doors.length; i++) ent.doors[i].open = player.hasKey;
    }

    function handleTriggers(ent, player, dt) {
      var i;
      // Gems
      for (i = 0; i < ent.gems.length; i++) {
        var g = ent.gems[i];
        if (!g.collected && BR.aabbOverlap(player, g)) {
          g.collected = true; player.gems[g.color]++;
          audio.sfx('coin'); particles.burst(g.cx, g.cy, 'coin', 8, P.gems[g.color].base);
        }
      }
      // Keys
      for (i = 0; i < ent.keys.length; i++) {
        var k = ent.keys[i];
        if (!k.taken && BR.aabbOverlap(player, k)) {
          k.taken = true; player.hasKey = true; audio.sfx('key');
          particles.burst(k.cx, k.cy, 'coin', 8, P.key.body);
        }
      }
      // Mushrooms
      for (i = 0; i < ent.mushrooms.length; i++) {
        var m = ent.mushrooms[i];
        if (BR.aabbOverlap(player, m) && player.vy >= -20 && (player.y + player.h) <= m.y + 14) {
          player.y = m.y - player.h;
          player.vy = player.jumpHeld ? BR.BOUNCE_V_HELD : BR.BOUNCE_V;
          player.onGround = false; m.squish = 6; audio.sfx('bounce');
          particles.burst(m.x + m.w / 2, m.y, 'jump', 5);
        }
        if (m.squish > 0) m.squish = Math.max(0, m.squish - dt * 40);
      }
      // Teleporter
      for (i = 0; i < ent.teleporters.length; i++) {
        var tp = ent.teleporters[i];
        if (tp.cooldown > 0) tp.cooldown -= dt;
        if (tp.cooldown <= 0 && tp.pair && BR.aabbOverlap(player, tp)) {
          var pair = tp.pair;
          player.x = pair.x + pair.w / 2 - player.w / 2;
          player.y = pair.y + pair.h - player.h;
          player.prevX = player.x; player.prevY = player.y;
          tp.cooldown = BR.TELEPORT_CD; pair.cooldown = BR.TELEPORT_CD;
          audio.sfx('tele'); particles.burst(player.cx, player.cy, 'jump', 10);
        }
      }
    }

    function isDead(player, level) {
      var hb = player.aabbHazard();
      var x0 = Math.floor(hb.x / TILE), x1 = Math.floor((hb.x + hb.w) / TILE);
      var y0 = Math.floor(hb.y / TILE), y1 = Math.floor((hb.y + hb.h) / TILE);
      for (var ty = y0; ty <= y1; ty++)
        for (var tx = x0; tx <= x1; tx++)
          if (level.tile(tx, ty) === BR.TileType.HAZARD) return true;
      if (player.y > level.pixelHeight + 40) return true;
      return false;
    }

    function die() {
      session.deaths++;
      audio.sfx('die');
      particles.burst(session.ent.player.cx, session.ent.player.cy, 'death', 16);
      shake = 0.4;
      respawn();
    }

    function win() {
      var mode = session.mode, level = session.level, player = session.ent.player;
      var timeMs = Math.round(session.elapsed * 1000);
      var gemsTotal = session.ent.gems.length;
      var gemsGot = 0;
      for (var i = 0; i < session.ent.gems.length; i++) if (session.ent.gems[i].collected) gemsGot++;
      var par = level.meta.par || 0;
      var stars = 1;
      if (mode === Mode.CAMPAIGN) {
        if ((par && timeMs <= par * 1000) || session.deaths === 0) stars++;
        if (gemsTotal > 0 && gemsGot === gemsTotal) stars++;
        else if (gemsTotal === 0) stars++;
      }
      audio.sfx('goal');
      for (var c = 0; c < 24; c++) particles.burst(player.cx, player.cy - 20, 'coin', 1, ['#FFC94D', '#3EE07A', '#FF5E7E', '#4D8CFF'][c % 4]);

      var res = { mode: mode, name: level.meta.name, timeMs: timeMs, par: par, gems: gemsGot, gemsTotal: gemsTotal, deaths: session.deaths, stars: stars };

      if (mode === Mode.CAMPAIGN) {
        var rec = BR.save.recordBest(Mode.CAMPAIGN, level.meta.id, timeMs, session.deaths, stars);
        res.isNew = rec.isNew; res.best = rec.best;
        var nextIdx = session.index + 1;
        if (nextIdx < BR.CAMPAIGN.levels.length) { BR.save.unlockNext(BR.CAMPAIGN.levels[nextIdx].id); res.hasNext = true; }
      } else if (mode === Mode.DAILY) {
        var dr = BR.save.recordDaily(BR.dailyDateStr(), timeMs, session.deaths);
        res.streak = dr.streak; res.hasNext = false;
      } else { // Endless
        res.hasNext = true;
        session.totalElapsed += session.elapsed;
        BR.save.recordEndless(session.section + 1, Math.round(session.totalElapsed * 1000));
      }
      setState(S.LEVEL_COMPLETE);
      ui.showComplete(res);
    }

    // ---------------- Aktionen aus UI ----------------
    function onAction(kind, payload) {
      switch (kind) {
        case 'start': startSession(payload.mode, payload); break;
        case 'resume': setState(S.PLAYING); ui.hidePause(); break;
        case 'restart':
          if (state === S.LEVEL_COMPLETE) { loadLevelIntoSession(buildLevel(session.mode, { index: session.index, section: session.section })); session.deaths = 0; }
          else { session.deaths++; respawn(); }
          ui.hideAll(); setState(S.PLAYING);
          break;
        case 'menu': session = null; ui.showMenu(); setState(S.MENU); break;
        case 'next': nextLevel(); break;
        case 'toggleMute':
          audio.setMuted(!audio.muted); BR.save.setSetting('muted', audio.muted); ui.setMuted(audio.muted);
          break;
        case 'toggleMusic':
          if (BR.music) { audio.unlock(); var on = BR.music.toggle(); ui.setMusic(on); }
          break;
      }
    }

    function nextLevel() {
      if (session.mode === Mode.CAMPAIGN) {
        session.index++;
        if (session.index >= BR.CAMPAIGN.levels.length) { ui.showMenu(); setState(S.MENU); session = null; return; }
        loadLevelIntoSession(buildLevel(Mode.CAMPAIGN, { index: session.index }));
        session.deaths = 0;
      } else if (session.mode === Mode.ENDLESS) {
        session.section++;
        loadLevelIntoSession(buildLevel(Mode.ENDLESS, { section: session.section }));
      }
      ui.hideAll(); setState(S.PLAYING);
    }

    // ---------------- Render ----------------
    function render(alpha) {
      var t = performance.now() / 1000;
      renderer.clear();
      renderer.drawParallax(camera, t);
      if (session && (state === S.PLAYING || state === S.PAUSED || state === S.LEVEL_COMPLETE)) {
        var ent = session.ent, level = session.level;
        if (state === S.PLAYING) camera.follow(ent.player, level, 0.18);
        var sx = 0, sy = 0;
        if (shake > 0) { var mag = shake / 0.4 * 8; sx = (Math.random() - 0.5) * mag * renderer.dpr; sy = (Math.random() - 0.5) * mag * renderer.dpr; }
        renderer.beginWorld(camera, sx, sy);
        renderer.drawWorld(level, camera, t);
        renderer.drawDeco(ent.deco, t);
        ent.goal = session.goalBox;
        renderer.drawEntities(ent, camera, alpha, t);
        particles.draw(renderer.ctx);
        renderer.endWorld();
        drawHUD(ent, level);
      }
    }

    function drawHUD(ent, level) {
      var ctx = renderer.ctx, w = renderer.cssW;
      ctx.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
      ctx.save();
      // Panel
      ctx.font = '600 15px system-ui, sans-serif';
      var name = level.meta.name;
      var modeLabel = session.mode === Mode.CAMPAIGN ? 'Kampagne' : (session.mode === Mode.DAILY ? 'Rätsel des Tages' : 'Endlos');
      // linkes Panel
      roundPanel(ctx, 10, 10, 260, 40);
      ctx.fillStyle = P.hud.text; ctx.textBaseline = 'middle';
      ctx.fillText(name, 22, 24);
      ctx.font = '600 11px system-ui, sans-serif'; ctx.fillStyle = P.hud.accent;
      ctx.fillText(modeLabel.toUpperCase(), 22, 40);

      // rechtes Panel: Timer + Tode
      var timeMs = Math.round(session.elapsed * 1000);
      var timeStr = BR.fmtTime(timeMs);
      roundPanel(ctx, w - 150, 10, 140, 40);
      ctx.textAlign = 'right';
      var low = level.meta.par && session.elapsed > level.meta.par;
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.fillStyle = low ? P.hud.timerLow : P.hud.timer;
      ctx.fillText(timeStr, w - 20, 24);
      ctx.font = '600 12px system-ui, sans-serif'; ctx.fillStyle = P.hud.deaths;
      ctx.fillText('☠ ' + session.deaths, w - 20, 42);
      ctx.textAlign = 'left';

      // Edelstein-Zähler (Mitte)
      var total = { red: 0, green: 0, blue: 0 };
      for (var i = 0; i < ent.gems.length; i++) total[ent.gems[i].color]++;
      if (ent.gems.length > 0) {
        var gx = w / 2 - 60;
        roundPanel(ctx, gx - 8, 10, 136, 30);
        var order = ['red', 'green', 'blue'];
        var px = gx;
        for (var o = 0; o < 3; o++) {
          var col = order[o];
          if (total[col] === 0) continue;
          drawGemIcon(ctx, px, 25, col);
          ctx.fillStyle = P.hud.text; ctx.font = '700 13px system-ui, sans-serif'; ctx.textBaseline = 'middle';
          ctx.fillText(ent.player.gems[col] + '/' + total[col], px + 12, 25);
          px += 46;
        }
      }
      ctx.restore();

      if (state === S.PLAYING && session.mode === Mode.ENDLESS) {
        ctx.fillStyle = P.hud.text2; ctx.font = '600 12px system-ui, sans-serif';
        ctx.fillText('Abschnitt ' + (session.section + 1), 22, 66);
      }
    }

    function roundPanel(ctx, x, y, w, h) {
      ctx.fillStyle = P.hud.panel;
      BR.roundRect(ctx, x, y, w, h, 12); ctx.fill();
      ctx.strokeStyle = P.hud.panelBorder; ctx.lineWidth = 1; ctx.stroke();
    }
    function drawGemIcon(ctx, x, y, color) {
      var col = P.gems[color];
      ctx.fillStyle = col.base;
      ctx.beginPath();
      ctx.moveTo(x, y - 6); ctx.lineTo(x + 5, y - 1); ctx.lineTo(x + 3, y + 6); ctx.lineTo(x - 3, y + 6); ctx.lineTo(x - 5, y - 1); ctx.closePath();
      ctx.fill();
    }

    // ---------------- Start ----------------
    window.addEventListener('resize', function () {
      renderer.resize();
      camera.setView(renderer.cssW, renderer.cssH);
    });

    ui.showMenu();
    setState(S.MENU);
    var engine = new BR.Engine({ update: update, render: render });
    engine.start();

    // Debug-Hook
    BR._debug = { getState: function () { return state; }, getSession: function () { return session; }, startSession: startSession, engine: engine };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.BR = window.BR || {});
