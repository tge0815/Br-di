/* Br-di — audio.js
 * Prozedurale SFX über WebAudio (keine Assets). Spec §10.3.
 */
(function (BR) {
  'use strict';

  function Audio() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  Audio.prototype.unlock = function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  };

  // Ein Ton mit Hüllkurve.
  Audio.prototype._tone = function (freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    var t = this.ctx.currentTime;
    var osc = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  };

  Audio.prototype.sfx = function (name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'jump':   this._tone(420, 0.14, 'square', 0.25, 720); break;
      case 'coin':   this._tone(880, 0.09, 'triangle', 0.3, 1320);
                     setTimeout(this._tone.bind(this, 1320, 0.10, 'triangle', 0.25), 60); break;
      case 'die':    this._tone(320, 0.30, 'sawtooth', 0.3, 90); break;
      case 'goal':   this._tone(660, 0.12, 'triangle', 0.3);
                     setTimeout(this._tone.bind(this, 880, 0.12, 'triangle', 0.3), 110);
                     setTimeout(this._tone.bind(this, 1174, 0.22, 'triangle', 0.3), 220); break;
      case 'key':    this._tone(700, 0.10, 'triangle', 0.3, 1050); break;
      case 'plate':  this._tone(300, 0.08, 'square', 0.25, 460); break;
      case 'bounce': this._tone(300, 0.18, 'sine', 0.35, 900); break;
      case 'tele':   this._tone(900, 0.16, 'sine', 0.28, 300); break;
      case 'menu':   this._tone(560, 0.07, 'square', 0.22, 680); break;
      case 'walljump': this._tone(500, 0.10, 'square', 0.2, 760); break;
    }
  };

  Audio.prototype.setMuted = function (b) { this.muted = b; };

  BR.audio = new Audio();

})(window.BR = window.BR || {});
