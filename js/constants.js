/* Br-di — constants.js
 * Zentrale Konstanten, Enums und Farbpaletten (Spec §3, §5, §8, §10.2).
 * Klassisches Skript im BR-Namespace (funktioniert per file://).
 */
(function (BR) {
  'use strict';

  BR.TILE = 32;            // px pro Kachel
  BR.DT = 1 / 120;         // fester Physik-Schritt (s)
  BR.MAX_FRAME = 0.25;     // Clamp gegen "spiral of death"

  // --- Horizontale Bewegung (px/s, px/s²) ---
  BR.MAX_RUN_SPEED = 270;
  BR.RUN_ACCEL = 3240;
  BR.RUN_DECEL = 4680;
  BR.TURN_ACCEL = 5760;
  BR.AIR_ACCEL = 1980;
  BR.AIR_DECEL = 1260;

  // --- Vertikale Bewegung / Springen ---
  BR.GRAVITY = 2700;
  BR.GRAVITY_APEX = 1620;      // aktiv wenn |vy| < APEX_THRESHOLD
  BR.GRAVITY_RELEASE = 6840;   // Aufstieg + Taste losgelassen
  BR.APEX_THRESHOLD = 72;      // px/s
  BR.JUMP_VELOCITY = -756;
  BR.TERMINAL = 900;
  BR.COYOTE_TIME = 0.10;       // s
  BR.JUMP_BUFFER = 0.116;      // s

  // --- Wall-Slide / Wall-Jump ---
  BR.WALL_SLIDE_SPEED = 132;
  BR.WALL_JUMP_VX = 288;
  BR.WALL_JUMP_VY = -690;
  BR.WALL_JUMP_LOCK = 0.133;
  BR.WALL_COYOTE = 0.083;

  // --- Optionale Fähigkeiten ---
  BR.DASH_SPEED = 540;
  BR.DASH_TIME = 0.133;
  BR.DASH_COOLDOWN = 0.5;
  BR.DOUBLE_JUMP_V = -630;

  // --- Objekte ---
  BR.BOUNCE_V = -1020;         // Pilz; gehalten -1122
  BR.BOUNCE_V_HELD = -1122;
  BR.PUSH_SPEED = 120;
  BR.WIND_UP = -1800;          // px/s² Aufwind
  BR.TELEPORT_CD = 0.333;
  BR.CRUMBLE_DELAY = 0.4;
  BR.CRUMBLE_RESPAWN = 3.0;
  BR.ONEWAY_DROP = 0.12;       // s Kollision-aus beim Durchfallen

  // --- Spieler-Hitbox ---
  BR.PLAYER_W = 28;
  BR.PLAYER_H = 36;

  BR.TileType = Object.freeze({
    EMPTY: 0, SOLID: 1, ONEWAY: 2, HAZARD: 3, SPAWN: 4, GOAL: 5
  });

  BR.Color = Object.freeze({ RED: 'red', GREEN: 'green', BLUE: 'blue' });

  BR.GameState = Object.freeze({
    MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused',
    LEVEL_COMPLETE: 'level_complete', GAME_OVER: 'game_over'
  });

  BR.Mode = Object.freeze({ CAMPAIGN: 'campaign', DAILY: 'daily', ENDLESS: 'endless' });

  // --- Farbpalette (Spec §8.1) ---
  BR.PAL = Object.freeze({
    sky: { top: '#4EA9FF', mid: '#8FD0FF', bot: '#DFF3FF' },
    sun: { core: '#FFF6C8', edge: '#FFD447', glow: '#FFE79A', ray: '#FFDE6B' },
    cloud: { hi: '#FFFFFF', base: '#F2F7FF', shadow: '#D6E4F5', under: '#C2D6EE' },
    grass: { hi: '#7ED957', mid: '#57C33E', dark: '#3E9E33', blade: '#A6F07A' },
    dirt: { hi: '#B07A47', dark: '#7E5230', speck: '#5E3D22' },
    trees: [
      { hi: '#9BE86A', dark: '#6FBF3E' }, // Limette
      { hi: '#5FD3B2', dark: '#37A487' }, // Türkis-Mint
      { hi: '#FF8C7A', dark: '#E85C4A' }, // Koralle
      { hi: '#FFC94D', dark: '#F0A21E' }, // Sonnengelb
      { hi: '#B79BFF', dark: '#8A6BE0' }, // Lavendel
      { hi: '#FF9ED2', dark: '#F06AB0' }  // Pink
    ],
    trunk: { hi: '#B07A47', dark: '#7E5230' },
    mountains: [
      { col: '#C9B8F0', factor: 0.15 }, // fern
      { col: '#9FC9E8', factor: 0.30 }, // mittel
      { col: '#8FD98A', factor: 0.55 }  // nah-BG
    ],
    hill: { top: '#EAFBE4', hi: '#8AD86E', mid: '#63BE49', shadow: '#479235', rock: '#C9C2A8' },
    plat: { top: '#7ED957', hi: '#C79A63', dark: '#9A6E3E', outline: '#6B4A28', mover: '#FFB84D' },
    player: {
      body: '#FF5E7E', shadow: '#E23E60', hi: '#FF9DB0', belly: '#FFE3DE',
      eye: '#2B2B3A', eyeShine: '#FFFFFF', cheek: '#FF9DB0', outline: '#3A2233'
    },
    gems: {
      red: { base: '#FF4D5E', dark: '#C21F35', shine: '#FFD3D8' },
      green: { base: '#3EE07A', dark: '#1F9E4E', shine: '#CFFFE0' },
      blue: { base: '#4D8CFF', dark: '#1F52C2', shine: '#D3E2FF' }
    },
    hazard: {
      thornBody: '#4A4A5A', thornTip: '#8A8AA0', thornBase: '#2E2E3A',
      waterHi: '#4D8CFF', waterLo: '#1F52C2', warn: '#FF2E4D'
    },
    barrier: { red: '#FF4D5E', green: '#3EE07A', blue: '#4D8CFF' },
    box: { hi: '#D9B892', mid: '#B98D5E', dark: '#8A6238', outline: '#5E3D22' },
    tele: { ring: '#B79BFF', core: '#8A6BE0', spark: '#EAD8FF' },
    wind: { col: '#DFF3FF', arrow: '#8FD0FF' },
    door: { hi: '#C9A24D', mid: '#9A7526', dark: '#6B4E18', outline: '#3A2A0E' },
    key: { body: '#FFD447', dark: '#F0A21E', outline: '#7E5230' },
    hud: {
      panel: 'rgba(43,36,56,0.72)', panelBorder: 'rgba(255,255,255,0.15)',
      text: '#FFFFFF', text2: '#C9BFE0', accent: '#FFC94D',
      success: '#3EE07A', timer: '#8FD0FF', timerLow: '#FF7A2E', deaths: '#FF5E7E'
    },
    particle: {
      dust: ['#EAFBE4', '#B07A47'], jump: ['#FFFFFF', '#DFF3FF'],
      death: ['#FF5E7E', '#3A2233', '#FFC94D'], pollen: 'rgba(255,246,200,0.25)'
    }
  });

})(window.BR = window.BR || {});
