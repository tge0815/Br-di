/* Br-di — particles.js
 * Einfacher Partikel-Pool für Juice (Spec §9.3).
 */
(function (BR) {
  'use strict';
  var P = BR.PAL;

  function Particles() { this.list = []; }

  Particles.prototype.burst = function (x, y, kind, n) {
    var cols, spread, life, grav, size;
    if (kind === 'dust') { cols = P.particle.dust; spread = 90; life = 0.4; grav = 200; size = 3; }
    else if (kind === 'jump') { cols = P.particle.jump; spread = 70; life = 0.3; grav = -60; size = 3; }
    else if (kind === 'death') { cols = P.particle.death; spread = 220; life = 0.7; grav = 500; size = 4; }
    else if (kind === 'coin') { cols = [arguments[4] || '#fff', '#fff']; spread = 140; life = 0.5; grav = 120; size = 3; }
    else { cols = ['#fff']; spread = 100; life = 0.4; grav = 200; size = 3; }
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = Math.random() * spread;
      this.list.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'death' ? 100 : 40),
        life: life * (0.7 + Math.random() * 0.6), max: life,
        col: cols[(Math.random() * cols.length) | 0], grav: grav, size: size * (0.6 + Math.random() * 0.8)
      });
    }
  };

  Particles.prototype.update = function (dt) {
    for (var i = this.list.length - 1; i >= 0; i--) {
      var p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  };

  Particles.prototype.draw = function (ctx) {
    for (var i = 0; i < this.list.length; i++) {
      var p = this.list[i];
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  };

  Particles.prototype.clear = function () { this.list.length = 0; };

  BR.Particles = Particles;

})(window.BR = window.BR || {});
