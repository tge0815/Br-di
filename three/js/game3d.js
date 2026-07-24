/* Br-di 3D — game3d.js
 * Voll-3D-Platformer mit freier Bewegung (Three.js r128).
 * Third-Person-Kamera, AABB-Charakterphysik, Springen, Sammeln, Ziel.
 */
(function () {
  'use strict';
  var T = window.THREE;

  // ---- Konstanten ----
  var GRAVITY = -26, MOVE_SPEED = 7.5, ACCEL = 60, AIR_ACCEL = 24,
      JUMP_V = 9.4, BOUNCE_V = 15.5, MAX_FALL = -32,
      COYOTE = 0.10, JUMP_BUFFER = 0.12;
  var PHX = 0.45, PHY = 0.6, PHZ = 0.45; // Spieler-Halb-Ausdehnung

  var TREE_COLORS = [
    [0x9BE86A, 0x6FBF3E], [0x5FD3B2, 0x37A487], [0xFF8C7A, 0xE85C4A],
    [0xFFC94D, 0xF0A21E], [0xB79BFF, 0x8A6BE0], [0xFF9ED2, 0xF06AB0]
  ];
  var GEM_COLORS = [0xFF4D5E, 0x3EE07A, 0x4D8CFF];

  // ---- Zustand ----
  var renderer, scene, camera, clock;
  var world = null, player = null, input = null, cam = null;
  var state = 'menu', levelIndex = 0, elapsed = 0, deaths = 0, gemsGot = 0, gemsTotal = 0;
  var ui = {};
  var sunMesh, dirLight;

  // =================================================================
  //  Bootstrap
  // =================================================================
  function init() {
    var canvas = document.getElementById('c3d');
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputEncoding = T.sRGBEncoding;

    scene = new T.Scene();
    scene.background = makeSkyTexture();
    scene.fog = new T.Fog(0xBFE3FF, 45, 110);

    camera = new T.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);

    // Licht
    var hemi = new T.HemisphereLight(0xBFE3FF, 0x6FBF3E, 0.85);
    scene.add(hemi);
    dirLight = new T.DirectionalLight(0xFFF3D0, 1.05);
    dirLight.position.set(24, 40, 18);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    var d = 45;
    dirLight.shadow.camera.left = -d; dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d; dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.camera.near = 1; dirLight.shadow.camera.far = 140;
    dirLight.shadow.bias = -0.0004;
    scene.add(dirLight);
    scene.add(dirLight.target);

    // Sonne (Deko)
    sunMesh = new T.Mesh(new T.SphereGeometry(6, 24, 24),
      new T.MeshBasicMaterial({ color: 0xFFF6C8 }));
    sunMesh.position.set(60, 70, -40);
    scene.add(sunMesh);

    clock = new T.Clock();
    input = new Input(canvas);
    cam = new CameraRig();
    player = new Player();
    scene.add(player.group);

    buildUI();
    window.addEventListener('resize', onResize);
    showMenu();
    renderer.setAnimationLoop(loop);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function makeSkyTexture() {
    var c = document.createElement('canvas'); c.width = 4; c.height = 256;
    var g = c.getContext('2d').createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#4EA9FF'); g.addColorStop(0.55, '#8FD0FF'); g.addColorStop(1, '#DFF3FF');
    var ctx = c.getContext('2d'); ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
    var tex = new T.CanvasTexture(c); tex.needsUpdate = true;
    return tex;
  }

  // =================================================================
  //  Welt aus Level-Daten
  // =================================================================
  function World(data) {
    this.data = data;
    this.solids = [];        // { box:Box3, mesh, mover? }
    this.movers = [];
    this.bouncers = [];
    this.gems = [];
    this.goal = null;
    this.group = new T.Group();
    this.deathY = data.deathY != null ? data.deathY : -14;
    this._build();
  }

  World.prototype._boxMesh = function (b) {
    var w = b.s[0], h = b.s[1], dp = b.s[2];
    var cx = b.p[0], topY = b.p[1], cz = b.p[2];
    var cy = topY - h / 2;
    var geo = new T.BoxGeometry(w, h, dp);
    var mesh;
    if (b.grass) {
      var grass = new T.MeshLambertMaterial({ color: 0x57C33E });
      var dirt = new T.MeshLambertMaterial({ color: 0x8A5E34 });
      // BoxGeometry Material-Reihenfolge: +x,-x,+y,-y,+z,-z
      mesh = new T.Mesh(geo, [dirt, dirt, grass, dirt, dirt, dirt]);
    } else {
      mesh = new T.Mesh(geo, new T.MeshLambertMaterial({ color: b.c != null ? b.c : 0xC79A63 }));
    }
    mesh.position.set(cx, cy, cz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  };

  World.prototype._build = function () {
    var i, self = this;
    // Statische Boxen
    for (i = 0; i < this.data.boxes.length; i++) {
      var b = this.data.boxes[i];
      var mesh = this._boxMesh(b);
      this.group.add(mesh);
      this.solids.push({ box: new T.Box3().setFromObject(mesh), mesh: mesh });
    }
    // Bewegliche Plattformen
    for (i = 0; i < (this.data.movers || []).length; i++) {
      var m = this.data.movers[i];
      var mm = this._boxMesh({ p: m.p, s: m.s, c: m.c });
      this.group.add(mm);
      var mv = {
        mesh: mm, axis: m.axis, amp: m.amp, speed: m.speed,
        base: mm.position.clone(), phase: i * 1.3, delta: new T.Vector3(),
        box: new T.Box3().setFromObject(mm)
      };
      this.movers.push(mv);
      this.solids.push({ box: mv.box, mesh: mm, mover: mv });
    }
    // Sprungpilze
    for (i = 0; i < (this.data.bouncers || []).length; i++) {
      var bp = this.data.bouncers[i];
      this.bouncers.push(makeBouncer(bp, this.group));
    }
    // Edelsteine
    for (i = 0; i < this.data.gems.length; i++) {
      this.gems.push(makeGem(this.data.gems[i], i, this.group));
    }
    // Bäume
    for (i = 0; i < (this.data.trees || []).length; i++) makeTree(this.data.trees[i], this.group);
    // Wolken
    for (i = 0; i < (this.data.clouds || []).length; i++) makeCloud(this.data.clouds[i], this.group);
    // Ziel-Portal
    this.goal = makeGoal(this.data.goal, this.group);

    scene.add(this.group);
  };

  World.prototype.updateMovers = function (t, dt) {
    for (var i = 0; i < this.movers.length; i++) {
      var m = this.movers[i];
      var off = Math.sin(t * m.speed + m.phase) * m.amp;
      var np = m.base.clone();
      np[m.axis] += off;
      m.delta.copy(np).sub(m.mesh.position);
      m.mesh.position.copy(np);
      m.box.setFromObject(m.mesh);
    }
  };

  World.prototype.dispose = function () {
    scene.remove(this.group);
    this.group.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (mm) { mm.dispose(); }); }
    });
  };

  // ---- Objekt-Fabriken ----
  function makeGem(p, idx, parent) {
    var col = GEM_COLORS[idx % 3];
    var g = new T.Group();
    var mat = new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.4, metalness: 0.3, roughness: 0.25 });
    var m = new T.Mesh(new T.OctahedronGeometry(0.42), mat);
    m.castShadow = true;
    g.add(m);
    g.position.set(p[0], p[1], p[2]);
    parent.add(g);
    return { group: g, mesh: m, base: p[1], collected: false, spin: Math.random() * 6 };
  }
  function makeBouncer(p, parent) {
    var g = new T.Group();
    var stem = new T.Mesh(new T.CylinderGeometry(0.18, 0.22, 0.5, 12),
      new T.MeshLambertMaterial({ color: 0xF2F0E6 }));
    stem.position.y = 0.25; stem.castShadow = true;
    var cap = new T.Mesh(new T.SphereGeometry(0.7, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new T.MeshLambertMaterial({ color: 0xE85C4A }));
    cap.position.y = 0.5; cap.scale.y = 0.7; cap.castShadow = true;
    g.add(stem); g.add(cap);
    g.position.set(p[0], p[1], p[2]);
    parent.add(g);
    return { group: g, cap: cap, x: p[0], y: p[1], z: p[2], squish: 0 };
  }
  function makeTree(p, parent) {
    var pair = TREE_COLORS[(p[3] || 0) % TREE_COLORS.length];
    var g = new T.Group();
    var trunk = new T.Mesh(new T.CylinderGeometry(0.22, 0.3, 1.6, 8),
      new T.MeshLambertMaterial({ color: 0x8A5E34 }));
    trunk.position.y = 0.8; trunk.castShadow = true;
    g.add(trunk);
    var mat = new T.MeshLambertMaterial({ color: pair[0] });
    var puffs = [[0, 2.0, 0, 1.0], [-0.6, 1.7, 0.2, 0.7], [0.6, 1.8, -0.2, 0.7], [0.1, 2.5, 0.1, 0.6]];
    for (var i = 0; i < puffs.length; i++) {
      var s = new T.Mesh(new T.SphereGeometry(0.85 * puffs[i][3], 12, 10), mat);
      s.position.set(puffs[i][0], puffs[i][1], puffs[i][2]); s.castShadow = true;
      g.add(s);
    }
    g.position.set(p[0], p[1], p[2]);
    g.rotation.y = p[0] * 1.7;
    parent.add(g);
  }
  function makeCloud(p, parent) {
    var g = new T.Group();
    var mat = new T.MeshLambertMaterial({ color: 0xFFFFFF });
    var puffs = [[0, 0, 0, 1.6], [-1.6, -0.2, 0, 1.1], [1.5, -0.1, 0.2, 1.2], [0.6, 0.4, -0.3, 1.0]];
    for (var i = 0; i < puffs.length; i++) {
      var s = new T.Mesh(new T.SphereGeometry(puffs[i][3], 12, 10), mat);
      s.position.set(puffs[i][0], puffs[i][1], puffs[i][2]);
      g.add(s);
    }
    g.position.set(p[0], p[1], p[2]);
    g.userData.driftBase = p[0]; g.userData.phase = p[2];
    parent.add(g);
    return g;
  }
  function makeGoal(p, parent) {
    var g = new T.Group();
    var ring = new T.Mesh(new T.TorusGeometry(1.3, 0.22, 16, 40),
      new T.MeshStandardMaterial({ color: 0x3EE07A, emissive: 0x1F9E4E, emissiveIntensity: 0.5 }));
    ring.castShadow = true;
    g.add(ring);
    var inner = new T.Mesh(new T.CircleGeometry(1.15, 32),
      new T.MeshBasicMaterial({ color: 0xCFFFE0, transparent: true, opacity: 0.35, side: T.DoubleSide }));
    g.add(inner);
    g.position.set(p[0], p[1], p[2]);
    parent.add(g);
    return { group: g, ring: ring, x: p[0], y: p[1], z: p[2] };
  }

  // =================================================================
  //  Spieler
  // =================================================================
  function Player() {
    this.group = new T.Group();
    var body = new T.Mesh(new T.SphereGeometry(0.55, 24, 20),
      new T.MeshStandardMaterial({ color: 0xFF5E7E, roughness: 0.5 }));
    body.scale.set(1, 0.95, 1); body.castShadow = true;
    this.body = body;
    this.group.add(body);
    // Bauch
    var belly = new T.Mesh(new T.SphereGeometry(0.4, 20, 16),
      new T.MeshStandardMaterial({ color: 0xFFE3DE, roughness: 0.6 }));
    belly.position.set(0, -0.05, 0.28); belly.scale.set(1, 1, 0.5);
    this.group.add(belly);
    // Augen
    this.eyes = new T.Group();
    var eyeMat = new T.MeshStandardMaterial({ color: 0x2B2B3A });
    var whiteMat = new T.MeshStandardMaterial({ color: 0xffffff });
    for (var s = -1; s <= 1; s += 2) {
      var w = new T.Mesh(new T.SphereGeometry(0.14, 12, 10), whiteMat);
      w.position.set(0.16 * s, 0.16, 0.46);
      var pupil = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), eyeMat);
      pupil.position.set(0.16 * s, 0.16, 0.57);
      this.eyes.add(w); this.eyes.add(pupil);
    }
    this.group.add(this.eyes);

    this.pos = new T.Vector3();
    this.vel = new T.Vector3();
    this.grounded = false;
    this.coyote = 0; this.jumpBuf = 0;
    this.standingOn = null;
    this.facing = 0;
    this.squash = 1;
  }

  Player.prototype.reset = function (spawn) {
    this.pos.set(spawn[0], spawn[1] + PHY, spawn[2]);
    this.vel.set(0, 0, 0);
    this.grounded = false; this.coyote = 0; this.jumpBuf = 0;
    this.standingOn = null;
    this.group.position.copy(this.pos);
  };

  Player.prototype.box = function () {
    return new T.Box3(
      new T.Vector3(this.pos.x - PHX, this.pos.y - PHY, this.pos.z - PHZ),
      new T.Vector3(this.pos.x + PHX, this.pos.y + PHY, this.pos.z + PHZ)
    );
  };

  Player.prototype.update = function (dt, inp, camYaw, w) {
    // Wunschrichtung relativ zur echten Kamera-Blickrichtung (auf die XZ-Ebene projiziert)
    var mv = inp.move;
    var fwd = new T.Vector3();
    camera.getWorldDirection(fwd); fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    var right = new T.Vector3().crossVectors(fwd, new T.Vector3(0, 1, 0)).normalize();
    var wish = new T.Vector3();
    wish.addScaledVector(fwd, mv.y).addScaledVector(right, mv.x);
    if (wish.lengthSq() > 1) wish.normalize();

    var targetVX = wish.x * MOVE_SPEED, targetVZ = wish.z * MOVE_SPEED;
    var a = (this.grounded ? ACCEL : AIR_ACCEL) * dt;
    this.vel.x = approach(this.vel.x, targetVX, a);
    this.vel.z = approach(this.vel.z, targetVZ, a);

    // Blickrichtung
    if (wish.lengthSq() > 0.01) this.facing = Math.atan2(wish.x, wish.z);

    // Sprung (Coyote + Buffer)
    this.coyote = this.grounded ? COYOTE : Math.max(0, this.coyote - dt);
    this.jumpBuf = inp.jumpPressed ? JUMP_BUFFER : Math.max(0, this.jumpBuf - dt);
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vel.y = JUMP_V; this.grounded = false; this.coyote = 0; this.jumpBuf = 0;
      if (window.BR3D.sfx) window.BR3D.sfx('jump');
    }

    // Schwerkraft
    this.vel.y += GRAVITY * dt;
    if (this.vel.y < MAX_FALL) this.vel.y = MAX_FALL;

    // Mitfahren auf Mover
    if (this.standingOn && this.standingOn.mover) {
      this.pos.add(this.standingOn.mover.delta);
    }

    this.grounded = false;
    var wasStanding = this.standingOn;
    this.standingOn = null;

    // Achsenweise Bewegung + Kollision
    this.pos.x += this.vel.x * dt; this._resolve('x', this.vel.x, w);
    this.pos.z += this.vel.z * dt; this._resolve('z', this.vel.z, w);
    this.pos.y += this.vel.y * dt; this._resolve('y', this.vel.y, w);

    // Animation: Squash beim Aufkommen
    var targetSq = this.grounded ? (wasStanding ? 1 : 0.8) : (1 + Math.min(0.3, Math.abs(this.vel.y) * 0.01));
    this.squash = lerp(this.squash, this.grounded ? 1 : targetSq, 0.25);
    this.body.scale.set(1 / Math.sqrt(this.squash), this.squash * 0.95, 1 / Math.sqrt(this.squash));

    this.group.position.copy(this.pos);
    // sanft in Bewegungsrichtung drehen
    var cur = this.group.rotation.y;
    this.group.rotation.y = cur + angleDiff(this.facing, cur) * 0.2;
  };

  // Testbox mit eingezogenen Rand-Dimensionen (senkrecht zur Achse),
  // damit bloßes Aufstehen/Anlehnen keine falsche Kollision auf der anderen Achse auslöst.
  Player.prototype._testBox = function (axis) {
    var m = 0.06;
    var b = this.box();
    if (axis === 'x') { b.min.y += m; b.max.y -= m; b.min.z += m; b.max.z -= m; }
    else if (axis === 'z') { b.min.y += m; b.max.y -= m; b.min.x += m; b.max.x -= m; }
    else { b.min.x += m; b.max.x -= m; b.min.z += m; b.max.z -= m; }
    return b;
  };

  Player.prototype._resolve = function (axis, v, w) {
    for (var i = 0; i < w.solids.length; i++) {
      var s = w.solids[i];
      if (!this._testBox(axis).intersectsBox(s.box)) continue;
      if (axis === 'y') {
        if (v <= 0) { this.pos.y = s.box.max.y + PHY; this.vel.y = 0; this.grounded = true; this.standingOn = s; }
        else { this.pos.y = s.box.min.y - PHY; this.vel.y = 0; }
      } else if (axis === 'x') {
        if (v > 0) this.pos.x = s.box.min.x - PHX; else this.pos.x = s.box.max.x + PHX;
        this.vel.x = 0;
      } else {
        if (v > 0) this.pos.z = s.box.min.z - PHZ; else this.pos.z = s.box.max.z + PHZ;
        this.vel.z = 0;
      }
    }
  };

  // =================================================================
  //  Kamera-Rig (Third-Person Orbit)
  // =================================================================
  function CameraRig() {
    this.yaw = 0; this.pitch = 0.42; this.dist = 9;
    this.target = new T.Vector3();
  }
  CameraRig.prototype.update = function (dt, inp, playerPos) {
    this.yaw -= inp.look.x * 2.4 * dt + inp.camKey * 1.8 * dt;
    this.pitch -= inp.look.y * 2.0 * dt;
    this.pitch = clamp(this.pitch, 0.08, 1.15);
    this.dist = clamp(this.dist + inp.zoom, 5, 16); inp.zoom = 0;

    var desired = new T.Vector3(playerPos.x, playerPos.y + 1.2, playerPos.z);
    this.target.lerp(desired, 1 - Math.pow(0.001, dt));
    var h = Math.cos(this.pitch) * this.dist;
    var vy = Math.sin(this.pitch) * this.dist;
    camera.position.set(
      this.target.x + Math.sin(this.yaw) * h,
      this.target.y + vy,
      this.target.z + Math.cos(this.yaw) * h
    );
    camera.lookAt(this.target);
  };

  // =================================================================
  //  Eingabe
  // =================================================================
  function Input(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.camKey = 0; this.zoom = 0;
    this.jumpPressed = false; this._prevJump = false;
    this._drag = false; this._lastX = 0; this._lastY = 0;
    this._touchMoveId = null; this._touchLookId = null;
    this._joyStart = { x: 0, y: 0 };
    this.touchJump = false;
    this._bind();
  }
  Input.prototype._bind = function () {
    var self = this;
    window.addEventListener('keydown', function (e) {
      var k = e.key.toLowerCase();
      self.keys[k] = true;
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) >= 0) e.preventDefault();
      if (window.BR3D.audioUnlock) window.BR3D.audioUnlock();
    });
    window.addEventListener('keyup', function (e) { self.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', function () { self.keys = {}; });
    // Maus-Drag = Kamera
    this.canvas.addEventListener('mousedown', function (e) { self._drag = true; self._lastX = e.clientX; self._lastY = e.clientY; });
    window.addEventListener('mouseup', function () { self._drag = false; });
    window.addEventListener('mousemove', function (e) {
      if (!self._drag) return;
      self.look.x += (e.clientX - self._lastX) * 0.02;
      self.look.y += (e.clientY - self._lastY) * 0.02;
      self._lastX = e.clientX; self._lastY = e.clientY;
    });
    this.canvas.addEventListener('wheel', function (e) { self.zoom += e.deltaY * 0.006; e.preventDefault(); }, { passive: false });
    // Touch
    this.canvas.addEventListener('touchstart', function (e) { self._touch(e); }, { passive: false });
    this.canvas.addEventListener('touchmove', function (e) { self._touch(e); e.preventDefault(); }, { passive: false });
    this.canvas.addEventListener('touchend', function (e) { self._touchEnd(e); }, { passive: false });
  };
  Input.prototype._touch = function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      var left = t.clientX < window.innerWidth / 2;
      if (left && this._touchMoveId === null && e.type === 'touchstart') {
        this._touchMoveId = t.identifier; this._joyStart.x = t.clientX; this._joyStart.y = t.clientY;
      } else if (!left && this._touchLookId === null && e.type === 'touchstart') {
        this._touchLookId = t.identifier; this._lastX = t.clientX; this._lastY = t.clientY;
      }
    }
    var touches = e.touches;
    for (var j = 0; j < touches.length; j++) {
      var tt = touches[j];
      if (tt.identifier === this._touchMoveId) {
        var dx = (tt.clientX - this._joyStart.x) / 50, dy = (tt.clientY - this._joyStart.y) / 50;
        this.move.x = clamp(dx, -1, 1); this.move.y = clamp(-dy, -1, 1);
      } else if (tt.identifier === this._touchLookId) {
        this.look.x += (tt.clientX - this._lastX) * 0.02;
        this.look.y += (tt.clientY - this._lastY) * 0.02;
        this._lastX = tt.clientX; this._lastY = tt.clientY;
      }
    }
  };
  Input.prototype._touchEnd = function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var id = e.changedTouches[i].identifier;
      if (id === this._touchMoveId) { this._touchMoveId = null; this.move.x = 0; this.move.y = 0; }
      if (id === this._touchLookId) { this._touchLookId = null; }
    }
  };
  Input.prototype.sample = function () {
    var k = this.keys;
    var mx = 0, my = 0;
    if (k['w'] || k['arrowup']) my += 1;
    if (k['s'] || k['arrowdown']) my -= 1;
    if (k['d'] || k['arrowright']) mx += 1;
    if (k['a'] || k['arrowleft']) mx -= 1;
    // Tastatur überschreibt nur wenn gedrückt (sonst Touch-Joystick behalten)
    if (mx !== 0 || my !== 0) { this.move.x = mx; this.move.y = my; }
    this.camKey = (k['e'] ? 1 : 0) - (k['q'] ? 1 : 0);
    var jump = !!k[' '] || this.touchJump;
    this.jumpPressed = jump && !this._prevJump;
    this._prevJump = jump;
    var out = { move: { x: this.move.x, y: this.move.y }, look: { x: this.look.x, y: this.look.y }, camKey: this.camKey, zoom: this.zoom, jumpPressed: this.jumpPressed };
    this.look.x = 0; this.look.y = 0;
    if (mx === 0 && my === 0 && this._touchMoveId === null) { this.move.x = 0; this.move.y = 0; }
    return out;
  };

  // =================================================================
  //  Spiel-Fluss
  // =================================================================
  function startLevel(idx) {
    levelIndex = idx;
    if (world) world.dispose();
    world = new World(window.BR3D.LEVELS[idx]);
    player.reset(world.data.spawn);
    gemsTotal = world.gems.length; gemsGot = 0;
    elapsed = 0; deaths = 0; state = 'playing';
    cam.yaw = 0; cam.pitch = 0.42; cam.target.set(player.pos.x, player.pos.y + 1.2, player.pos.z);
    hideOverlays();
    ui.hud.style.display = 'flex';
    ui.hint.textContent = world.data.hint || '';
    ui.hint.style.display = 'block';
    setTimeout(function () { ui.hint.style.display = 'none'; }, 4500);
    updateHUD();
  }

  function respawn() { deaths++; player.reset(world.data.spawn); updateHUD(); }

  function loop() {
    var dt = Math.min(clock.getDelta(), 1 / 20);
    var t = clock.elapsedTime;
    var inp = input.sample();

    if (state === 'playing') {
      elapsed += dt;
      world.updateMovers(t, dt);
      player.update(dt, inp, cam.yaw, world);

      // Sprungpilze
      for (var i = 0; i < world.bouncers.length; i++) {
        var b = world.bouncers[i];
        var dx = player.pos.x - b.x, dz = player.pos.z - b.z;
        if (dx * dx + dz * dz < 1.3 && player.vel.y <= 0.5 &&
            Math.abs((player.pos.y - PHY) - b.y) < 0.5) {
          player.vel.y = BOUNCE_V; player.grounded = false; b.squish = 1;
          if (window.BR3D.sfx) window.BR3D.sfx('bounce');
        }
        if (b.squish > 0) { b.squish = Math.max(0, b.squish - dt * 4); b.cap.scale.y = 0.7 - b.squish * 0.4; }
      }

      // Edelsteine
      for (i = 0; i < world.gems.length; i++) {
        var g = world.gems[i];
        if (g.collected) continue;
        g.group.rotation.y += dt * 2;
        g.group.position.y = g.base + Math.sin(t * 2 + g.spin) * 0.15;
        var gx = player.pos.x - g.group.position.x, gy = player.pos.y - g.group.position.y, gz = player.pos.z - g.group.position.z;
        if (gx * gx + gy * gy + gz * gz < 1.1) {
          g.collected = true; g.group.visible = false; gemsGot++;
          updateHUD();
          if (window.BR3D.sfx) window.BR3D.sfx('coin');
        }
      }

      // Ziel
      world.goal.ring.rotation.z += dt * 1.2;
      world.goal.group.rotation.y += dt * 0.6;
      var qx = player.pos.x - world.goal.x, qy = player.pos.y - world.goal.y, qz = player.pos.z - world.goal.z;
      if (qx * qx + qy * qy + qz * qz < 2.2) {
        if (gemsGot >= gemsTotal) win();
        else showHint('Sammle erst alle Edelsteine! (' + gemsGot + '/' + gemsTotal + ')');
      }

      // Tod durch Fall
      if (player.pos.y < world.deathY) { if (window.BR3D.sfx) window.BR3D.sfx('die'); respawn(); }

      // Neustart
      if (input.keys['r']) { input.keys['r'] = false; respawn(); }
      if (input.keys['p'] || input.keys['escape']) { input.keys['p'] = false; input.keys['escape'] = false; pause(); }

      cam.update(dt, inp, player.pos);
      updateTimer();
    } else {
      // Menü/Pause: Kamera trotzdem sanft
      if (world) cam.update(dt, inp, player.pos);
    }

    // Deko-Animationen
    if (world) {
      for (var c = 0; c < world.group.children.length; c++) {
        var o = world.group.children[c];
        if (o.userData.driftBase !== undefined) o.position.x = o.userData.driftBase + Math.sin(t * 0.1 + o.userData.phase) * 3;
      }
    }
    if (sunMesh) sunMesh.rotation.y += dt * 0.1;

    renderer.render(scene, camera);
  }

  function win() {
    state = 'won';
    var stars = 1;
    if (deaths === 0) stars++;
    if (gemsGot >= gemsTotal) stars++;
    if (window.BR3D.sfx) window.BR3D.sfx('goal');
    showWin(stars);
  }

  // =================================================================
  //  UI (DOM-Overlays)
  // =================================================================
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function buildUI() {
    var root = document.getElementById('ui3d');

    // HUD
    ui.hud = el('div', 'hud3d');
    ui.hudLevel = el('div', 'hud-pill');
    ui.hudGems = el('div', 'hud-pill');
    ui.hudTime = el('div', 'hud-pill');
    ui.hud.appendChild(ui.hudLevel); ui.hud.appendChild(ui.hudGems); ui.hud.appendChild(ui.hudTime);
    ui.hud.style.display = 'none';
    root.appendChild(ui.hud);

    ui.hint = el('div', 'hint3d'); ui.hint.style.display = 'none';
    root.appendChild(ui.hint);

    // Touch-Jump-Button
    ui.jump = el('div', 'jump3d', '⬆');
    var j = ui.jump;
    j.addEventListener('touchstart', function (e) { e.preventDefault(); input.touchJump = true; j.classList.add('active'); });
    j.addEventListener('touchend', function (e) { e.preventDefault(); input.touchJump = false; j.classList.remove('active'); });
    j.style.display = 'none';
    root.appendChild(ui.jump);

    // Menü
    ui.menu = el('div', 'screen3d');
    ui.menu.appendChild(el('h1', 'title3d', 'Br-di 3D'));
    ui.menu.appendChild(el('p', 'subtitle3d', 'Ein 3D-Abenteuer in der bunten Graswelt'));
    var lvlWrap = el('div', 'levels3d');
    window.BR3D.LEVELS.forEach(function (lv, i) {
      var btn = el('button', 'btn3d', (i + 1) + '. ' + lv.name);
      btn.onclick = function () { if (window.BR3D.audioUnlock) window.BR3D.audioUnlock(); startLevel(i); };
      lvlWrap.appendChild(btn);
    });
    ui.menu.appendChild(lvlWrap);
    var ctr = el('div', 'controls3d');
    ctr.innerHTML = '<b>Steuerung:</b> WASD / Pfeile — Laufen &nbsp;·&nbsp; Leertaste — Springen &nbsp;·&nbsp; Maus ziehen / Q E — Kamera &nbsp;·&nbsp; Mausrad — Zoom &nbsp;·&nbsp; R — Neustart';
    ui.menu.appendChild(ctr);
    var back2d = el('a', 'btn3d btn3d-small', '← Zur 2D-Version');
    back2d.href = '../index.html';
    ui.menu.appendChild(back2d);
    root.appendChild(ui.menu);

    // Pause
    ui.pause = el('div', 'screen3d overlay3d'); ui.pause.style.display = 'none';
    var pp = el('div', 'panel3d');
    pp.appendChild(el('h2', 'panel-title3d', 'Pause'));
    var pr = el('button', 'btn3d', 'Weiter'); pr.onclick = function () { state = 'playing'; hideOverlays(); };
    var prr = el('button', 'btn3d', 'Neustart'); prr.onclick = function () { startLevel(levelIndex); };
    var pm = el('button', 'btn3d', 'Menü'); pm.onclick = function () { showMenu(); };
    pp.appendChild(pr); pp.appendChild(prr); pp.appendChild(pm);
    ui.pause.appendChild(pp);
    root.appendChild(ui.pause);

    // Sieg
    ui.win = el('div', 'screen3d overlay3d'); ui.win.style.display = 'none';
    ui.winPanel = el('div', 'panel3d panel-win3d');
    ui.win.appendChild(ui.winPanel);
    root.appendChild(ui.win);
  }

  function updateHUD() {
    ui.hudLevel.textContent = '🌱 ' + world.data.name;
    ui.hudGems.textContent = '💎 ' + gemsGot + '/' + gemsTotal;
  }
  function updateTimer() { ui.hudTime.textContent = '⏱ ' + elapsed.toFixed(1) + 's'; }

  function showHint(msg) { ui.hint.textContent = msg; ui.hint.style.display = 'block'; clearTimeout(ui._hintT); ui._hintT = setTimeout(function () { ui.hint.style.display = 'none'; }, 2000); }

  function showMenu() {
    state = 'menu';
    hideOverlays();
    ui.hud.style.display = 'none'; ui.hint.style.display = 'none'; ui.jump.style.display = 'none';
    ui.menu.style.display = 'flex';
  }
  function pause() { state = 'paused'; ui.pause.style.display = 'flex'; }
  function hideOverlays() { ui.menu.style.display = 'none'; ui.pause.style.display = 'none'; ui.win.style.display = 'none'; }

  function showWin(stars) {
    ui.hud.style.display = 'none'; ui.jump.style.display = 'none';
    var p = ui.winPanel; p.innerHTML = '';
    p.appendChild(el('h2', 'panel-title3d', 'Geschafft! 🎉'));
    p.appendChild(el('div', 'win-level3d', world.data.name));
    var sr = el('div', 'stars3d');
    for (var s = 0; s < 3; s++) sr.appendChild(el('span', 'star3d' + (s < stars ? ' on' : ''), s < stars ? '★' : '☆'));
    p.appendChild(sr);
    var st = el('div', 'winstats3d');
    st.appendChild(el('div', null, 'Zeit: ' + elapsed.toFixed(1) + 's'));
    st.appendChild(el('div', null, 'Edelsteine: ' + gemsGot + '/' + gemsTotal));
    st.appendChild(el('div', null, 'Abstürze: ' + deaths));
    p.appendChild(st);
    var row = el('div', 'btnrow3d');
    if (levelIndex + 1 < window.BR3D.LEVELS.length) {
      var nx = el('button', 'btn3d btn-accent3d', 'Nächstes Level →'); nx.onclick = function () { startLevel(levelIndex + 1); }; row.appendChild(nx);
    }
    var rr = el('button', 'btn3d', 'Nochmal'); rr.onclick = function () { startLevel(levelIndex); }; row.appendChild(rr);
    var mn = el('button', 'btn3d', 'Menü'); mn.onclick = function () { showMenu(); }; row.appendChild(mn);
    p.appendChild(row);
    ui.win.style.display = 'flex';
    state = 'won';
  }

  // Touch-Jump-Button einblenden bei Touch-Geräten
  function maybeTouch() {
    if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) {
      var orig = startLevel;
      startLevel = function (i) { orig(i); ui.jump.style.display = 'flex'; };
    }
  }

  // ---- Mathe-Helfer ----
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function approach(v, target, d) { if (v < target) return Math.min(v + d, target); if (v > target) return Math.max(v - d, target); return v; }
  function angleDiff(a, b) { var d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

  // Start
  window.addEventListener('DOMContentLoaded', function () { init(); maybeTouch(); });
  window.BR3D.debug = function () { return { state: function () { return state; }, player: function () { return player; }, start: function (i) { startLevel(i); }, gems: function () { return gemsGot + '/' + gemsTotal; } }; };
})();
