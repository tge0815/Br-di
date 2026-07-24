/* Br-di 3D — levels3d.js
 * Level-Daten für den 3D-Platformer.
 * Konvention: box.p = [x, TOP-Y, z] (Oberflächen-Höhe), box.s = [breite, höhe, tiefe].
 * gems/bouncer/goal/spawn = [x, y, z] (y = Steh-/Schwebehöhe).
 */
window.BR3D = window.BR3D || {};
window.BR3D.LEVELS = [
  {
    name: 'Grüne Wiesen',
    hint: 'Sammle alle Edelsteine und erreiche das Portal!',
    spawn: [0, 1.2, 12],
    deathY: -14,
    goal: [0, 8.2, -20],
    boxes: [
      { p: [0, 0, 8], s: [30, 2, 22], grass: true },        // Start-Wiese
      { p: [-10, 1.4, -2], s: [8, 3, 8], grass: true },      // Hügel links
      { p: [10, 1.0, -1], s: [7, 2.5, 7], grass: true },     // Hügel rechts
      { p: [-4, 2.2, -8], s: [4, 1, 4], c: 0xFF8C7A },       // Stufe 1
      { p: [2, 3.4, -11], s: [4, 1, 4], c: 0x5FD3B2 },       // Stufe 2
      { p: [-2, 4.8, -15], s: [4, 1, 4], c: 0xB79BFF },      // Stufe 3
      { p: [0, 6.4, -20], s: [8, 1, 8], grass: true },       // Ziel-Plateau (unter Portal)
      { p: [14, 2.2, -12], s: [3, 1, 3], c: 0xFFC94D },      // Bonus-Podest
    ],
    movers: [
      { p: [6, 4.0, -16], s: [4, 0.8, 4], c: 0xFF9ED2, axis: 'x', amp: 5, speed: 1.4 },
    ],
    bouncers: [ [-10, 3.0, -2], [14, 3.8, -12] ],
    gems: [
      [0, 2.2, 4], [-9, 4.6, -2], [-4, 4.0, -8], [2, 5.2, -11],
      [6, 6.0, -16], [-2, 6.6, -15], [14, 5.5, -12], [0, 8.0, -20],
    ],
    trees: [ [-13, 1, 10, 0], [12, 1, 9, 3], [-8, 2.9, -4, 4], [9, 2.5, -3, 5], [13, 1, -6, 1] ],
    clouds: [ [-14, 12, -6], [10, 14, -14], [0, 16, 4] ],
  },
  {
    name: 'Schwebende Inseln',
    hint: 'Springe von Insel zu Insel – nutze die Sprungpilze!',
    spawn: [0, 1.2, 14],
    deathY: -16,
    goal: [0, 6.2, -26],
    boxes: [
      { p: [0, 0, 12], s: [12, 2, 10], grass: true },        // Start
      { p: [-8, 1.5, 2], s: [6, 2, 6], grass: true },
      { p: [7, 2.5, -1], s: [6, 2, 6], grass: true },
      { p: [-6, 3.5, -8], s: [5, 1, 5], c: 0x9BE86A },
      { p: [4, 4.5, -13], s: [5, 1, 5], c: 0xFFC94D },
      { p: [-3, 5.5, -19], s: [5, 1, 5], c: 0x5FD3B2 },
      { p: [0, 4.5, -26], s: [9, 1, 9], grass: true },       // Ziel-Insel
    ],
    movers: [
      { p: [0, 3.0, 4], s: [4, 0.8, 4], c: 0xFF9ED2, axis: 'z', amp: 5, speed: 1.6 },
      { p: [-1, 4.5, -13], s: [4, 0.8, 4], c: 0xB79BFF, axis: 'x', amp: 6, speed: 1.8 },
    ],
    bouncers: [ [-8, 3.5, 2], [7, 4.5, -1], [-3, 6.5, -19] ],
    gems: [
      [0, 2.2, 12], [-8, 4.0, 2], [7, 5.0, -1], [-6, 5.2, -8],
      [4, 6.2, -13], [-3, 7.2, -19], [0, 6.0, -26], [0, 8.0, 4],
    ],
    trees: [ [-4, 1, 13, 2], [4, 1, 14, 5], [-9, 3.5, 2, 0] ],
    clouds: [ [-12, 14, 0], [12, 16, -12], [-4, 18, -24] ],
  },
  {
    name: 'Der Gipfelsturm',
    hint: 'Erklimme den bunten Berg bis zur Spitze!',
    spawn: [0, 1.2, 16],
    deathY: -18,
    goal: [0, 14.2, -6],
    boxes: [
      { p: [0, 0, 12], s: [16, 2, 12], grass: true },
      { p: [-9, 2, 4], s: [6, 3, 6], grass: true },
      { p: [8, 3, 2], s: [6, 3, 6], grass: true },
      { p: [0, 5, -2], s: [6, 2, 6], c: 0xFF8C7A },
      { p: [-7, 7, -4], s: [4, 1, 4], c: 0x5FD3B2 },
      { p: [7, 9, -4], s: [4, 1, 4], c: 0xFFC94D },
      { p: [0, 11, -5], s: [4, 1, 4], c: 0xB79BFF },
      { p: [0, 12.5, -6], s: [7, 1, 7], grass: true },       // Gipfel-Plateau
    ],
    movers: [
      { p: [-4, 6, -2], s: [3.5, 0.8, 3.5], c: 0xFF9ED2, axis: 'y', amp: 2.5, speed: 1.3 },
      { p: [4, 10, -4], s: [3.5, 0.8, 3.5], c: 0x9BE86A, axis: 'x', amp: 5, speed: 2.0 },
    ],
    bouncers: [ [-9, 3.5, 4], [8, 4.5, 2], [0, 6.0, -2] ],
    gems: [
      [0, 2.2, 12], [-9, 5.5, 4], [8, 6.5, 2], [0, 7.0, -2],
      [-7, 8.2, -4], [7, 10.2, -4], [0, 12.2, -5], [0, 14.0, -6],
    ],
    trees: [ [-6, 1, 14, 4], [6, 1, 15, 1], [-11, 3.5, 4, 5], [10, 4.5, 2, 2] ],
    clouds: [ [-10, 16, 2], [10, 18, -4], [0, 20, -10] ],
  },
];
