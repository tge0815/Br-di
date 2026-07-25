/* Br-di — music.js
 * Prozedurale Chiptune-Hintergrundmusik im Stil der alten Turrican-Ära
 * (Hommage an Chris Hülsbeck): treibende Arpeggios, heroische Lead-Melodie,
 * Bass + Drums. Reines WebAudio, keine Asset-Dateien.
 */
(function (BR) {
  'use strict';

  var BPM = 150;
  var STEP = 60 / BPM / 4;      // 16tel-Dauer (s)
  var BARS = 8, STEPS = BARS * 16;

  // MIDI -> Frequenz
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // Pro Takt: Bass-Grundton (MIDI) + Akkordtöne für Arpeggio
  var PROG = [
    { bass: 45, arp: [57, 60, 64, 69] }, // Am
    { bass: 41, arp: [53, 57, 60, 65] }, // F
    { bass: 48, arp: [60, 64, 67, 72] }, // C
    { bass: 43, arp: [55, 59, 62, 67] }, // G
    { bass: 45, arp: [57, 60, 64, 69] }, // Am
    { bass: 41, arp: [53, 57, 60, 65] }, // F
    { bass: 43, arp: [55, 59, 62, 67] }, // G
    { bass: 40, arp: [52, 56, 59, 64] }  // E (V -> heroischer Loop-Zurück)
  ];

  // Bass-Rhythmus (8tel): Halbton-Offsets vom Grundton
  var BASS_OFF = [0, 0, 12, 0, 7, 0, 12, 7];
  // Arpeggio-Index-Muster über 16 Schritte (rauf & etwas runter)
  var ARP_SEQ = [0, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 0, 0, 1, 2, 3];

  // Heroische Lead-Melodie: {step (global 0..127), midi, dur (in Steps)}
  var LEAD = [
    { s: 0, m: 69, d: 6 }, { s: 8, m: 72, d: 6 },
    { s: 16, m: 65, d: 6 }, { s: 24, m: 69, d: 6 },
    { s: 32, m: 67, d: 3 }, { s: 36, m: 72, d: 3 }, { s: 40, m: 76, d: 8 },
    { s: 48, m: 74, d: 6 }, { s: 56, m: 71, d: 6 },
    { s: 64, m: 69, d: 3 }, { s: 68, m: 72, d: 3 }, { s: 72, m: 76, d: 8 },
    { s: 80, m: 77, d: 6 }, { s: 88, m: 76, d: 6 },
    { s: 96, m: 74, d: 3 }, { s: 100, m: 71, d: 3 }, { s: 104, m: 74, d: 8 },
    { s: 112, m: 76, d: 4 }, { s: 116, m: 79, d: 4 }, { s: 120, m: 84, d: 8 }
  ];
  var LEAD_AT = {};
  LEAD.forEach(function (n) { LEAD_AT[n.s] = n; });

  var M = {
    enabled: true, playing: false, ctx: null, out: null,
    _timer: null, _step: 0, _next: 0, _noise: null
  };

  function ensureCtx() {
    if (BR.audio) { BR.audio.unlock(); M.ctx = BR.audio.ctx; }
    if (!M.ctx) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        M.ctx = new AC();
      } catch (e) { return false; }
    }
    if (M.ctx && M.ctx.state === 'suspended') M.ctx.resume();
    if (!M.out && M.ctx) {
      M.out = M.ctx.createGain();
      M.out.gain.value = 0.16;
      M.out.connect(M.ctx.destination);
    }
    if (!M._noise && M.ctx) {
      var len = M.ctx.sampleRate * 0.5;
      var buf = M.ctx.createBuffer(1, len, M.ctx.sampleRate);
      var dat = buf.getChannelData(0);
      for (var i = 0; i < len; i++) dat[i] = Math.random() * 2 - 1;
      M._noise = buf;
    }
    return !!M.ctx;
  }

  // Ein synthetischer Ton mit Hüllkurve (+ optionalem Vibrato)
  function tone(freq, t, dur, type, vol, vib) {
    var ctx = M.ctx;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 3800;
    osc.type = type; osc.frequency.value = freq;
    var lfo, lfoG;
    if (vib) {
      lfo = ctx.createOscillator(); lfoG = ctx.createGain();
      lfo.frequency.value = 5.5; lfoG.gain.value = freq * 0.012;
      lfo.connect(lfoG); lfoG.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * 0.6), t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filt); filt.connect(g); g.connect(M.out);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  function kick(t) {
    var ctx = M.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(M.out); o.start(t); o.stop(t + 0.18);
  }
  function noiseHit(t, dur, hp, vol) {
    var ctx = M.ctx, src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = M._noise; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(M.out); src.start(t); src.stop(t + dur + 0.02);
  }

  function scheduleStep(step, t) {
    var bar = Math.floor(step / 16), s16 = step % 16;
    var chord = PROG[bar % PROG.length];

    // Bass (8tel)
    if (s16 % 2 === 0) {
      var bi = (s16 / 2) | 0;
      tone(mtof(chord.bass + BASS_OFF[bi]), t, STEP * 1.9, 'square', 0.5, false);
    }
    // Arpeggio (16tel)
    var arpM = chord.arp[ARP_SEQ[s16]] + 12; // eine Oktave höher = brillanter
    tone(mtof(arpM), t, STEP * 0.95, 'square', 0.22, false);

    // Lead
    var ln = LEAD_AT[step];
    if (ln) tone(mtof(ln.m), t, STEP * ln.d * 0.95, 'sawtooth', 0.3, true);

    // Drums
    if (s16 === 0 || s16 === 8) kick(t);
    if (s16 === 4 || s16 === 12) { noiseHit(t, 0.14, 1400, 0.35); tone(mtof(60), t, 0.08, 'triangle', 0.15, false); }
    if (s16 % 2 === 1) noiseHit(t, 0.03, 7000, 0.12); // Hi-Hat Offbeat
  }

  function scheduler() {
    if (!M.ctx) return;
    var ahead = 0.12;
    while (M._next < M.ctx.currentTime + ahead) {
      scheduleStep(M._step, M._next);
      M._next += STEP;
      M._step = (M._step + 1) % STEPS;
    }
  }

  BR.music = {
    start: function () {
      if (M.playing) return;
      if (!ensureCtx()) return;
      M.playing = true;
      M._step = 0; M._next = M.ctx.currentTime + 0.1;
      M._timer = setInterval(scheduler, 25);
      scheduler();
    },
    stop: function () {
      M.playing = false;
      if (M._timer) { clearInterval(M._timer); M._timer = null; }
    },
    isPlaying: function () { return M.playing; },
    setEnabled: function (on) {
      M.enabled = on;
      if (BR.save) BR.save.setSetting('music', on);
      if (on) this.start(); else this.stop();
    },
    toggle: function () { this.setEnabled(!M.enabled); return M.enabled; },
    enabled: function () { return M.enabled; },
    setVolume: function (v) { if (M.out) M.out.gain.value = v; }
  };

  // Anfangszustand aus Save (default an)
  if (BR.save) { var s = BR.save.getSetting('music'); M.enabled = (s !== false); }

})(window.BR = window.BR || {});
