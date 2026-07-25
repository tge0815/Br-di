/* Br-di — ui.js
 * DOM-Menüs, Overlays und Touch-Steuerung. Spec §9.
 */
(function (BR) {
  'use strict';

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function UI(opts) {
    this.root = opts.root;
    this.onAction = opts.onAction;
    this.save = BR.save;
    this._build();
  }

  UI.prototype._build = function () {
    var self = this;

    // --- Menü ---
    this.menu = el('div', 'screen menu-screen');
    var title = el('h1', 'title', 'Br-di');
    var sub = el('p', 'subtitle', 'Ein farbenfroher Rätsel-Platformer');
    this.menu.appendChild(title);
    this.menu.appendChild(sub);

    var modes = el('div', 'mode-buttons');
    var bCamp = el('button', 'btn btn-big', '🌱  Kampagne');
    var bDaily = el('button', 'btn btn-big', '📅  Rätsel des Tages');
    var bEndless = el('button', 'btn btn-big', '♾️  Endlos-Modus');
    bCamp.onclick = function () { BR.audio.sfx('menu'); self._showCampaignPicker(); };
    bDaily.onclick = function () { BR.audio.sfx('menu'); self.onAction('start', { mode: BR.Mode.DAILY }); };
    bEndless.onclick = function () { BR.audio.sfx('menu'); self.onAction('start', { mode: BR.Mode.ENDLESS }); };
    modes.appendChild(bCamp); modes.appendChild(bDaily); modes.appendChild(bEndless);
    this.menu.appendChild(modes);

    // Link zur 3D-Version
    var d3 = el('a', 'btn btn-3d', '🎮  In 3D spielen (neu!)');
    d3.href = 'three/index.html';
    this.menu.appendChild(d3);

    var foot = el('div', 'menu-foot');
    this.muteBtn = el('button', 'btn btn-small', '🔊 Ton an');
    this.muteBtn.onclick = function () { self.onAction('toggleMute'); };
    this.musicBtn = el('button', 'btn btn-small', '🎵 Musik an');
    this.musicBtn.onclick = function () { self.onAction('toggleMusic'); };
    var help = el('button', 'btn btn-small', '❔ Steuerung');
    help.onclick = function () { self._toggleHelp(); };
    foot.appendChild(this.muteBtn); foot.appendChild(this.musicBtn); foot.appendChild(help);
    this.menu.appendChild(foot);

    this.helpBox = el('div', 'help-box hidden');
    this.helpBox.innerHTML =
      '<b>Steuerung</b><br>← → / A D — Laufen &nbsp;·&nbsp; Leertaste / W / ↑ — Springen (gedrückt halten = höher)<br>' +
      '↓ + Sprung — durch Blätter fallen &nbsp;·&nbsp; an Wänden: abrutschen &amp; Wandsprung<br>' +
      'R — Neustart &nbsp;·&nbsp; P / Esc — Pause &nbsp;·&nbsp; Am Handy: Touch-Buttons';
    this.menu.appendChild(this.helpBox);

    // --- Kampagne-Auswahl ---
    this.picker = el('div', 'screen picker-screen hidden');
    var pTitle = el('h2', 'title2', 'Kampagne');
    this.picker.appendChild(pTitle);
    this.pickerGrid = el('div', 'level-grid');
    this.picker.appendChild(this.pickerGrid);
    var back = el('button', 'btn btn-small', '← Zurück');
    back.onclick = function () { self.showMenu(); };
    this.picker.appendChild(back);

    // --- Pause ---
    this.pause = el('div', 'screen overlay hidden');
    var pPanel = el('div', 'panel');
    pPanel.appendChild(el('h2', 'panel-title', 'Pause'));
    var pRes = el('button', 'btn', 'Weiter'); pRes.onclick = function () { self.onAction('resume'); };
    var pRestart = el('button', 'btn', 'Neustart'); pRestart.onclick = function () { self.onAction('restart'); };
    var pMenu = el('button', 'btn', 'Hauptmenü'); pMenu.onclick = function () { self.onAction('menu'); };
    pPanel.appendChild(pRes); pPanel.appendChild(pRestart); pPanel.appendChild(pMenu);
    this.pause.appendChild(pPanel);

    // --- Level-Complete ---
    this.complete = el('div', 'screen overlay hidden');
    this.completePanel = el('div', 'panel panel-win');
    this.complete.appendChild(this.completePanel);

    this.root.appendChild(this.menu);
    this.root.appendChild(this.picker);
    this.root.appendChild(this.pause);
    this.root.appendChild(this.complete);

    this._buildTouch();
  };

  UI.prototype._toggleHelp = function () { this.helpBox.classList.toggle('hidden'); };

  UI.prototype._showCampaignPicker = function () {
    var self = this;
    this.menu.classList.add('hidden');
    this.picker.classList.remove('hidden');
    this.pickerGrid.innerHTML = '';
    var levels = BR.CAMPAIGN.levels;
    for (var i = 0; i < levels.length; i++) {
      (function (lv, idx) {
        var unlocked = self.save.isUnlocked(lv.id);
        var best = self.save.getBest(BR.Mode.CAMPAIGN, lv.id);
        var cell = el('button', 'level-cell' + (unlocked ? '' : ' locked'));
        var num = el('div', 'level-num', unlocked ? String(idx + 1) : '🔒');
        var nm = el('div', 'level-name', lv.name);
        cell.appendChild(num); cell.appendChild(nm);
        if (best) {
          var stars = el('div', 'level-stars', '⭐'.repeat(best.stars || 0));
          cell.appendChild(stars);
        }
        if (unlocked) cell.onclick = function () { BR.audio.sfx('menu'); self.onAction('start', { mode: BR.Mode.CAMPAIGN, levelId: lv.id, index: idx }); };
        self.pickerGrid.appendChild(cell);
      })(levels[i], i);
    }
  };

  UI.prototype.showMenu = function () {
    this.menu.classList.remove('hidden');
    this.picker.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.complete.classList.add('hidden');
    this.helpBox.classList.add('hidden');
  };

  UI.prototype.hideAll = function () {
    this.menu.classList.add('hidden');
    this.picker.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.complete.classList.add('hidden');
  };

  UI.prototype.showPause = function () { this.pause.classList.remove('hidden'); };
  UI.prototype.hidePause = function () { this.pause.classList.add('hidden'); };

  UI.prototype.showComplete = function (m) {
    var self = this;
    var pnl = this.completePanel;
    pnl.innerHTML = '';
    pnl.appendChild(el('h2', 'panel-title', m.mode === BR.Mode.ENDLESS ? 'Abschnitt geschafft!' : 'Geschafft! 🎉'));
    pnl.appendChild(el('div', 'win-level', m.name));
    var starRow = el('div', 'star-row');
    for (var s = 0; s < 3; s++) starRow.appendChild(el('span', 'big-star' + (s < m.stars ? ' on' : ''), s < m.stars ? '★' : '☆'));
    pnl.appendChild(starRow);

    var stats = el('div', 'win-stats');
    stats.appendChild(el('div', 'stat', 'Zeit: ' + BR.fmtTime(m.timeMs)));
    if (m.par) stats.appendChild(el('div', 'stat', 'Ziel: ' + BR.fmtTime(m.par * 1000)));
    stats.appendChild(el('div', 'stat', 'Edelsteine: ' + m.gems + '/' + m.gemsTotal));
    stats.appendChild(el('div', 'stat', 'Tode: ' + m.deaths));
    if (m.isNew && m.mode === BR.Mode.CAMPAIGN) stats.appendChild(el('div', 'stat badge-new', '🏆 Neue Bestzeit!'));
    if (m.streak) stats.appendChild(el('div', 'stat', '🔥 Serie: ' + m.streak + ' Tage'));
    pnl.appendChild(stats);

    var row = el('div', 'btn-row');
    if (m.hasNext) {
      var nx = el('button', 'btn btn-accent', m.mode === BR.Mode.ENDLESS ? 'Weiter ♾️' : 'Nächstes Level →');
      nx.onclick = function () { self.onAction('next'); };
      row.appendChild(nx);
    }
    if (m.mode === BR.Mode.CAMPAIGN) {
      var rr = el('button', 'btn', 'Nochmal'); rr.onclick = function () { self.onAction('restart'); }; row.appendChild(rr);
    }
    var mb = el('button', 'btn', 'Menü'); mb.onclick = function () { self.onAction('menu'); };
    row.appendChild(mb);
    pnl.appendChild(row);

    this.complete.classList.remove('hidden');
  };

  UI.prototype.setMuted = function (muted) {
    this.muteBtn.textContent = muted ? '🔇 Ton aus' : '🔊 Ton an';
  };
  UI.prototype.setMusic = function (on) {
    this.musicBtn.textContent = on ? '🎵 Musik an' : '🔇 Musik aus';
  };

  // --- Touch-Controls ---
  UI.prototype._buildTouch = function () {
    this.touchWrap = el('div', 'touch-controls hidden');
    var leftPad = el('div', 'touch-left');
    this.tLeft = el('div', 'tbtn', '◀');
    this.tRight = el('div', 'tbtn', '▶');
    leftPad.appendChild(this.tLeft); leftPad.appendChild(this.tRight);
    var rightPad = el('div', 'touch-right');
    this.tAction = el('div', 'tbtn tbtn-b', '✦');
    this.tJump = el('div', 'tbtn tbtn-a', '⬆');
    rightPad.appendChild(this.tAction); rightPad.appendChild(this.tJump);
    this.touchWrap.appendChild(leftPad); this.touchWrap.appendChild(rightPad);
    this.root.appendChild(this.touchWrap);
  };

  UI.prototype.enableTouch = function (input) {
    input.bindTouchButton(this.tLeft, 'left');
    input.bindTouchButton(this.tRight, 'right');
    input.bindTouchButton(this.tJump, 'jump');
    input.bindTouchButton(this.tAction, 'action');
  };
  UI.prototype.showTouch = function (show) { this.touchWrap.classList.toggle('hidden', !show); };

  BR.UI = UI;

})(window.BR = window.BR || {});
