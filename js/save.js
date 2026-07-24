/* Br-di — save.js
 * localStorage-Persistenz (Namespace brdi_, ein Objekt brdi_save). Spec §10.3.
 */
(function (BR) {
  'use strict';

  var KEY = 'brdi_save';

  function defaults() {
    return {
      version: 1,
      settings: { muted: false, touch: 'auto' },
      campaign: { unlocked: ['c01'], bests: {} },
      daily: { streak: 0, lastDay: null },
      endless: { bestLength: 0, bestTimeMs: null }
    };
  }

  function safeGet() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      var data = JSON.parse(raw);
      // Migration / Defaults auffüllen
      var d = defaults();
      data.settings = Object.assign(d.settings, data.settings || {});
      data.campaign = Object.assign(d.campaign, data.campaign || {});
      data.campaign.bests = data.campaign.bests || {};
      data.campaign.unlocked = data.campaign.unlocked || ['c01'];
      data.daily = Object.assign(d.daily, data.daily || {});
      data.endless = Object.assign(d.endless, data.endless || {});
      data.version = 1;
      return data;
    } catch (e) {
      return defaults();
    }
  }

  var cache = null;

  BR.save = {
    load: function () {
      if (!cache) cache = safeGet();
      return cache;
    },
    persist: function () {
      try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* ignore */ }
    },
    recordBest: function (mode, id, timeMs, deaths, stars) {
      var s = this.load();
      var isNew = false;
      if (mode === BR.Mode.CAMPAIGN) {
        var prev = s.campaign.bests[id];
        if (!prev || timeMs < prev.timeMs) {
          s.campaign.bests[id] = { timeMs: timeMs, deaths: deaths, stars: stars };
          isNew = true;
        } else if (stars > (prev.stars || 0)) {
          prev.stars = stars; // Sterne behalten, auch ohne Zeitrekord
        }
      }
      this.persist();
      return { best: (s.campaign.bests[id] || {}).timeMs, isNew: isNew };
    },
    getBest: function (mode, id) {
      var s = this.load();
      if (mode === BR.Mode.CAMPAIGN) return s.campaign.bests[id] || null;
      return null;
    },
    unlockNext: function (nextId) {
      var s = this.load();
      if (nextId && s.campaign.unlocked.indexOf(nextId) === -1) {
        s.campaign.unlocked.push(nextId);
        this.persist();
      }
    },
    isUnlocked: function (id) {
      return this.load().campaign.unlocked.indexOf(id) !== -1;
    },
    recordDaily: function (dayStr, timeMs, deaths) {
      var s = this.load();
      var prev = s.daily[dayStr];
      var isNew = !prev || timeMs < prev.timeMs;
      if (isNew) s.daily[dayStr] = { done: true, timeMs: timeMs, deaths: deaths };
      // Streak
      if (!prev) {
        var y = new Date(dayStr + 'T00:00:00Z');
        var yesterday = new Date(y.getTime() - 86400000);
        var yStr = yesterday.toISOString().slice(0, 10);
        if (s.daily.lastDay === yStr) s.daily.streak = (s.daily.streak || 0) + 1;
        else s.daily.streak = 1;
        s.daily.lastDay = dayStr;
      }
      this.persist();
      return { isNew: isNew, streak: s.daily.streak };
    },
    dailyDone: function (dayStr) {
      var s = this.load();
      return !!(s.daily[dayStr] && s.daily[dayStr].done);
    },
    recordEndless: function (length, timeMs) {
      var s = this.load();
      var isNew = length > (s.endless.bestLength || 0);
      if (isNew) { s.endless.bestLength = length; s.endless.bestTimeMs = timeMs; }
      this.persist();
      return { isNew: isNew, best: s.endless.bestLength };
    },
    setSetting: function (key, val) {
      var s = this.load();
      s.settings[key] = val;
      this.persist();
    },
    getSetting: function (key) { return this.load().settings[key]; }
  };

})(window.BR = window.BR || {});
