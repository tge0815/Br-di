/* Br-di — generator.js
 * Seeded Endlos-/Tages-Level aus garantiert lösbaren Segment-Bausteinen. Spec §7.
 * Höhe H=14. Boden: row11 '#', row12/13 '='. Alle Bausteine haben an beiden
 * Rändern begehbaren Boden -> nahtlose Verkettung, keine Sackgassen.
 */
(function (BR) {
  'use strict';

  var H = 14;

  function pad(row, w) { while (row.length < w) row += '.'; return row; }
  // Baustein: Objekt { rows:[14 strings gleicher Breite] }
  function block(lines) {
    var w = 0, i;
    for (i = 0; i < lines.length; i++) w = Math.max(w, lines[i].length);
    // auf 14 Zeilen bringen (oben Luft), unten Boden falls fehlt
    var rows = [];
    for (i = 0; i < H; i++) rows.push(pad(lines[i] !== undefined ? lines[i] : '', w));
    return { rows: rows, w: w };
  }

  // --- Bausteine (rng, diff) -> block ---
  function FLAT(rng) {
    var g = BR.pick(rng, ['r', 'g', 'b']);
    return block([
      '........', '........', '........', '........', '........', '........',
      '........', '...' + g + '....', '........', '........', '........',
      '########', '========', '========'
    ]);
  }
  function GAP(rng, diff) {
    var gw = Math.min(4, 2 + BR.randInt(rng, 0, diff));
    var water = new Array(gw + 1).join('~');
    var w = 3 + gw + 3;
    var top = '###' + water + '###';
    return block([
      '', '', '', '', '', '', '', '', '', '', '',
      top, '===' + water + '===', '===' + water + '==='
    ].map(function (r) { return pad(r, w); }));
  }
  function PILLAR() {
    return block([
      '', '', '', '', '', '', '', '', '', '....#....',
      '....#....', '#########', '=========', '========='
    ]);
  }
  function LEDGE(rng) {
    var g = BR.pick(rng, ['r', 'g', 'b']);
    return block([
      '', '', '', '', '', '......' + g + '...', '.....:::..', '', '..:::.....',
      '', '', '##########', '==========', '=========='
    ]);
  }
  function MUSH(rng) {
    var g = BR.pick(rng, ['r', 'g', 'b']);
    return block([
      '', '', '', '....' + g + '....', '', '', '', '', '', '', '',
      '####^####', '=========', '========='
    ]);
  }
  function THORNS() {
    return block([
      '', '', '', '', '', '', '', '', '', '', '',
      '###*###*###', '===========', '==========='
    ]);
  }
  function MOVER() {
    return block([
      '', '', '', '', '', '', '', '.....H......', '', '', '',
      '####~~~~####', '====~~~~====', '====~~~~===='
    ]);
  }
  function KEYGATE(rng) {
    return block([
      '', '', '', '', '....K.......', '...:::......', '', '', '',
      '.......###..', '.......D....', '############', '============', '============'
    ]);
  }
  function COLORGATE(rng) {
    // Box auf Platte schieben -> gleichfarbige Barriere (hoch) öffnet.
    return block([
      '', '', '', '', '', '.........###', '.........!..', '.........!..',
      '.........!..', '..O......!..', '.....1......', '############', '============', '============'
    ]);
  }

  var START = function () {
    return block([
      '', '', '', '', '', '', '', '', '', '', '.S....',
      '######', '======', '======'
    ]);
  };
  var END = function () {
    return block([
      '', '', '', '', '', '', '', '', '', '', '....X.',
      '######', '======', '======'
    ]);
  };

  function buildersUpTo(diff) {
    var pool = [FLAT, FLAT, GAP, LEDGE, PILLAR];
    if (diff >= 1) pool.push(MUSH, GAP);
    if (diff >= 2) pool.push(LEDGE, MOVER);
    if (diff >= 3) pool.push(THORNS, MOVER);
    if (diff >= 3) pool.push(KEYGATE);
    if (diff >= 4) pool.push(COLORGATE, THORNS);
    return pool;
  }

  // rows-Array zusammenketten (spaltenweise über gemeinsame 14 Zeilen)
  function concatBlocks(blocks) {
    var rows = [];
    for (var y = 0; y < H; y++) {
      var s = '';
      for (var b = 0; b < blocks.length; b++) s += blocks[b].rows[y];
      rows.push(s);
    }
    return rows;
  }

  // opts: { length, difficulty (fest oder null=ramping), guaranteeOneOf, mode, name }
  BR.generateLevelRows = function (seed, opts) {
    opts = opts || {};
    var rng = BR.mulberry32(seed >>> 0);
    var length = opts.length || 24;
    var blocks = [START()];
    var guaranteed = false;
    var guaranteeSet = opts.guaranteeOneOf || null;

    for (var i = 0; i < length; i++) {
      var diff = (opts.difficulty != null) ? opts.difficulty : Math.min(5, Math.floor(i / 5));
      var pool = buildersUpTo(diff);
      var fn;
      // Mindestens ein echtes Rätsel garantieren
      if (guaranteeSet && !guaranteed && i === Math.floor(length / 2)) {
        var map = { KEY_GATE: KEYGATE, COLOR_GATE: COLORGATE, MOVING: MOVER };
        fn = map[BR.pick(rng, guaranteeSet)] || KEYGATE;
        guaranteed = true;
      } else {
        fn = BR.pick(rng, pool);
      }
      blocks.push(fn(rng, diff));
    }
    blocks.push(END());
    return concatBlocks(blocks);
  };

  BR.dailySeedFromDate = function (date) {
    date = date || new Date();
    var y = date.getUTCFullYear();
    var m = ('0' + (date.getUTCMonth() + 1)).slice(-2);
    var d = ('0' + date.getUTCDate()).slice(-2);
    return parseInt('' + y + m + d, 10);
  };
  BR.dailyDateStr = function (date) {
    date = date || new Date();
    return date.toISOString().slice(0, 10);
  };

  // Fertige Level bauen (-> BR.parseLevel)
  BR.generateDaily = function (date) {
    var seed = BR.dailySeedFromDate(date);
    var rows = BR.generateLevelRows(seed, {
      length: 14, difficulty: 3,
      guaranteeOneOf: ['COLOR_GATE', 'KEY_GATE', 'MOVING']
    });
    return BR.parseLevel(rows, {
      id: 'daily-' + BR.dailyDateStr(date), name: 'Rätsel des Tages',
      mode: BR.Mode.DAILY, par: 75, seed: seed
    });
  };

  BR.generateEndless = function (runSeed, section) {
    section = section || 0;
    // Jeder Abschnitt härter und länger
    var seed = (runSeed + section * 2654435761) >>> 0;
    var rows = BR.generateLevelRows(seed, {
      length: 18 + section * 4,
      difficulty: null // Ramping innerhalb + Basis steigt über Distanz
    });
    return BR.parseLevel(rows, {
      id: 'endless-' + section, name: 'Endlos · Abschnitt ' + (section + 1),
      mode: BR.Mode.ENDLESS, par: 0, seed: seed, section: section
    });
  };

})(window.BR = window.BR || {});
