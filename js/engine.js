/* Br-di — engine.js
 * Fixed-timestep Game-Loop mit Accumulator + Interpolation. Spec §10.5.
 */
(function (BR) {
  'use strict';

  function Engine(opts) {
    this.update = opts.update;       // update(dt)
    this.render = opts.render;       // render(alpha)
    this.dt = opts.dt || BR.DT;
    this.maxFrame = opts.maxFrame || BR.MAX_FRAME;
    this._raf = 0; this._last = 0; this._acc = 0; this._running = false;
    this._fps = 60; this._fpsT = 0; this._fpsC = 0;
  }

  Engine.prototype.start = function () {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    var self = this;
    var frame = function (now) {
      if (!self._running) return;
      self._raf = requestAnimationFrame(frame);
      var elapsed = (now - self._last) / 1000;
      self._last = now;
      if (elapsed > self.maxFrame) elapsed = self.maxFrame;
      self._acc += elapsed;
      var steps = 0;
      while (self._acc >= self.dt && steps < 240) { self.update(self.dt); self._acc -= self.dt; steps++; }
      self.render(self._acc / self.dt);
      // FPS
      self._fpsC++; self._fpsT += elapsed;
      if (self._fpsT >= 0.5) { self._fps = Math.round(self._fpsC / self._fpsT); self._fpsC = 0; self._fpsT = 0; }
    };
    this._raf = requestAnimationFrame(frame);
  };

  Engine.prototype.stop = function () { this._running = false; cancelAnimationFrame(this._raf); };
  Object.defineProperty(Engine.prototype, 'fps', { get: function () { return this._fps; } });

  BR.Engine = Engine;

})(window.BR = window.BR || {});
