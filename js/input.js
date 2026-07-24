/* Br-di — input.js
 * Vereint Tastatur + Touch zu einem InputState. Spec §2.
 */
(function (BR) {
  'use strict';

  function Input(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.touch = { left: false, right: false, jump: false, action: false, down: false };
    this._jumpEdge = false;   // wurde Sprung seit letztem Sample neu gedrückt?
    this._jumpHeld = false;
    this._restartEdge = false;
    this._pauseEdge = false;
    this._actionEdge = false;
    this._prevJump = false;
    this._prevRestart = false;
    this._prevPause = false;
    this._prevAction = false;
    this.onFirstInput = null; // callback (für Audio-Unlock)
    this._bind();
  }

  var JUMP_KEYS = { ' ': 1, 'arrowup': 1, 'w': 1 };
  var LEFT_KEYS = { 'arrowleft': 1, 'a': 1 };
  var RIGHT_KEYS = { 'arrowright': 1, 'd': 1 };
  var DOWN_KEYS = { 'arrowdown': 1, 's': 1 };
  var ACTION_KEYS = { 'j': 1, 'shift': 1, 'e': 1 };

  Input.prototype._fire = function () {
    if (this.onFirstInput) { this.onFirstInput(); }
  };

  Input.prototype._bind = function () {
    var self = this;
    window.addEventListener('keydown', function (e) {
      var k = e.key.toLowerCase();
      if (JUMP_KEYS[k] || LEFT_KEYS[k] || RIGHT_KEYS[k] || DOWN_KEYS[k] ||
          k === 'r' || k === 'p' || k === 'escape') {
        if (e.key === ' ' || k === 'arrowup' || k === 'arrowdown' ||
            k === 'arrowleft' || k === 'arrowright') e.preventDefault();
      }
      self.keys[k] = true;
      self._fire();
    });
    window.addEventListener('keyup', function (e) {
      self.keys[e.key.toLowerCase()] = false;
    });
    window.addEventListener('blur', function () { self.keys = {}; });
  };

  // Touch-Button-Bindung von außen (ui.js liefert DOM-Buttons).
  Input.prototype.bindTouchButton = function (el, name) {
    var self = this;
    var set = function (v) {
      return function (e) {
        e.preventDefault();
        self.touch[name] = v;
        el.classList.toggle('active', v);
        if (v) self._fire();
      };
    };
    el.addEventListener('touchstart', set(true), { passive: false });
    el.addEventListener('touchend', set(false), { passive: false });
    el.addEventListener('touchcancel', set(false), { passive: false });
    el.addEventListener('mousedown', set(true));
    window.addEventListener('mouseup', set(false));
    el.addEventListener('mouseleave', function () { if (self.touch[name]) { self.touch[name] = false; el.classList.remove('active'); } });
  };

  function anyKey(keys, map) {
    for (var k in map) if (keys[k]) return true;
    return false;
  }

  // Einmal pro Frame: liefert aktuellen Zustand + Edge-Trigger.
  Input.prototype.sample = function () {
    var k = this.keys, t = this.touch;
    var jump = anyKey(k, JUMP_KEYS) || t.jump;
    var restart = !!k['r'];
    var pause = !!k['p'] || !!k['escape'];
    var action = anyKey(k, ACTION_KEYS) || t.action;

    var s = {
      left: (anyKey(k, LEFT_KEYS) || t.left) ? 1 : 0,
      right: (anyKey(k, RIGHT_KEYS) || t.right) ? 1 : 0,
      down: anyKey(k, DOWN_KEYS) || t.down,
      jump: jump,
      jumpPressed: jump && !this._prevJump,
      jumpReleased: !jump && this._prevJump,
      action: action,
      actionPressed: action && !this._prevAction,
      restartPressed: restart && !this._prevRestart,
      pausePressed: pause && !this._prevPause
    };
    s.dir = s.right - s.left; // -1,0,1

    this._prevJump = jump;
    this._prevRestart = restart;
    this._prevPause = pause;
    this._prevAction = action;
    return s;
  };

  BR.Input = Input;

})(window.BR = window.BR || {});
