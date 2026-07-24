# Br-di — Verbindliche Spezifikation (GAME_DESIGN.md)

> **Status:** Final. Alle Konflikte der vier Facetten-Entwürfe sind aufgelöst. Diese Datei ist die einzige Wahrheitsquelle. Wo Facetten sich widersprachen, gilt die hier fixierte Entscheidung — die abweichenden Zahlen der Ursprungsentwürfe sind ungültig.
>
> **Zentrale Konfliktentscheidungen (verbindlich):**
> 1. **Kachelgröße = 32px** (Level- & Architektur-Facette; die 40px der Mechanik-Facette werden verworfen). Alle Physikwerte sind in **px/s** absolut und damit kachelunabhängig — die Sprunghöhe in *Kacheln* ergibt sich neu aus 32px.
> 2. **Fixer Physik-Timestep = 1/120 s** (Architektur-Facette). Rendering entkoppelt/interpoliert.
> 3. **Physik-Konstanten** stammen aus der Mechanik-Facette (sorgfältig getunt), umgerechnet in px/s. Die abweichenden Werte der Architektur-Facette (`GRAVITY=2200` etc.) sind verworfen.
> 4. **Tile-Legende** = reiche Legende der Level-Facette (die die 10 Grids trägt). Die MVP-Glyphen der Architektur-Facette (`P/G/C/=`-als-Plattform) sind verworfen.
> 5. **3-Farben-System** (rot/grün/blau) für Platten/Barrieren/Edelsteine. Gelb entfällt.
> 6. **Ein Schlüssel öffnet alle Tore** des Levels (monochrom, wie in den Grids).
> 7. **localStorage-Namespace = `brdi_`**, ein einziges versioniertes Save-Objekt unter `brdi_save`.

---

## 1. Vision & Kernschleife

**Br-di** ist ein 2D-Puzzle-Platformer in einer warmen, bunten „Knuddel-Vektor"-Graswelt. Reines Vanilla-JS, Canvas-2D, keine Assets, kein Build. Leitmotiv: **„anspruchsvoll aber fair"** — präzises, griffiges Movement, sodass schwere Passagen an Können scheitern, nie an schwammiger Steuerung.

**Drei Modi, eine Engine:**
- **Kampagne** — 10 handgebaute Level mit steigender Schwierigkeit, je eine Rätsel-Idee × eine Platforming-Hürde.
- **Rätsel des Tages** — ein täglich für alle identisches, generiertes Level (Seed = Datum).
- **Endlos** — endlos verkettete, mit Distanz härter werdende Segmente.

**Kernschleife (Sekundentakt):** Level betreten → beobachten/planen → laufen, springen, Objekte manipulieren → sterben & sofort respawnen (Instant-Retry) → Ausgang erreichen → Sterne-Wertung (Zeit / kein Tod / alle Edelsteine) → nächstes Level / neuer Run.

**Designphilosophie-Regeln (fix):**
- **JA** zu Assists ohne Skill-Verlust: Coyote-Time, Jump-Buffer, variable Sprunghöhe.
- **Basis-Moveset immer verfügbar:** Laufen, Springen (variabel), Wall-Slide, Wall-Jump, Aktion/Greifen.
- **Kein Doppelsprung als Standard.** Dash und Doppelsprung sind ausschließlich freischaltbare Items / Endlos-Modifier.
- Unbegrenzte Retries; „Leben" existieren nicht. Todeszähler nur für die Wertung.

---

## 2. Steuerung (Tastatur + Touch)

Gemeinsame Input-Abstraktion → identisches Fairness-Gefühl (gleiche Buffer-/Coyote-Logik) auf beiden Wegen.

### 2.1 Tastatur

| Aktion | Tasten |
|---|---|
| Laufen links / rechts | ← / → **oder** A / D |
| Springen (variabel) | Leertaste, ↑ **oder** W |
| Runterfallen (Einweg-Plattform) | ↓ + Sprung **oder** S + Sprung |
| Aktion (Greifen / Ziehen / Schalter / Dash) | J / Shift / E |
| Neustart (sofort, ohne Bestätigung) | R |
| Pause | P / Esc |

**Prinzip:** Sprunghöhe = Haltedauer (Key-Up ⇒ Jump-Cut). Input wird pro Frame gepollt; `jumpPressed` ist ein Edge (nur im Druckframe true) und speist den Jump-Buffer.

### 2.2 Touch (On-Screen)

- **Links unten:** zwei Buttons ◀ ▶ (Slide-Zone optional für analoges Gefühl).
- **Rechts unten:** großer **Sprung**-Button (A) + kleinerer **Aktion/Dash**-Button (B).
- **Einweg-Drop:** ▼-Wisch auf Sprung **oder** ↓-Button + Sprung.
- **Oben rechts:** Pause.
- Buttons semi-transparent, `touch-action:none`, Multi-Touch (gleichzeitig laufen + springen), Hitflächen **≥ 56px**, Totzone gegen Fehlauslösung. Kurzer Scale-Pop (0.92 → 1) beim Drücken.

---

## 3. Physik & Spielerfähigkeiten (konkrete Konstanten)

**Referenz:** 1 Kachel = **32px**. Simulation bei fixem **1/120 s**-Substep. Alle Werte in **px/s** (Beschleunigungen px/s²) — kachelunabhängig. Die Spalte „px/frame@60" dient nur als Herkunfts-/Tuning-Referenz aus der Mechanik-Facette.

**Spieler-Hitbox (Kollision):** **28px breit × 36px hoch** (schlanker als eine Kachel → 1-Kachel-Lücken wirken vergebend). Ursprung mittig-unten. Sichtbare Figur ~32×36px (Art).

### 3.1 Horizontale Bewegung

| Konstante | Wert (px/s bzw. px/s²) | px/frame@60 |
|---|---|---|
| `MAX_RUN_SPEED` | 270 | 4.5 |
| `RUN_ACCEL` (Boden) | 3240 | 0.9 |
| `RUN_DECEL` (Boden-Reibung) | 4680 | 1.3 |
| `TURN_ACCEL` (Richtungswechsel) | 5760 | 1.6 |
| `AIR_ACCEL` | 1980 | 0.55 |
| `AIR_DECEL` | 1260 | 0.35 |

Horizontal-Logik pro Physik-Tick (`dt = 1/120`):
```
if input != 0:
    a = grounded ? RUN_ACCEL : AIR_ACCEL
    if sign(input) != sign(vx) and vx != 0: a = grounded ? TURN_ACCEL : AIR_ACCEL
    vx += input * a * dt
    vx = clamp(vx, -MAX_RUN_SPEED, MAX_RUN_SPEED)
else:
    d = grounded ? RUN_DECEL : AIR_DECEL
    vx = approach(vx, 0, d * dt)
```

### 3.2 Vertikale Bewegung / Springen

| Konstante | Wert | px/frame@60 |
|---|---|---|
| `GRAVITY` | 2700 px/s² | 0.75 |
| `GRAVITY_APEX` (bei \|vy\| < 72 px/s) | 1620 px/s² | 0.45 |
| `GRAVITY_RELEASE` (Aufstieg + Taste los) | 6840 px/s² | 1.9 |
| `JUMP_VELOCITY` | −756 px/s | −12.6 |
| `TERMINAL_VELOCITY` | 900 px/s | 15.0 |
| `COYOTE_TIME` | 0.10 s | 6 frames |
| `JUMP_BUFFER` | 0.116 s | 7 frames |

**Resultierende Sprung-Kennwerte (fix, bei 32px):**
- **Volle Sprunghöhe:** ≈ 106px ≈ **3.3 Kacheln** (Taste gehalten).
- **Minimalsprung:** ≈ 40px ≈ **1.25 Kacheln** (sofort losgelassen).
- **Sprungweite bei Max-Speed:** ≈ 144px ≈ **4.5 Kacheln**.
- **Fairness-Obergrenze fürs Level-Design:** Standardlücke **≤ 4 Kacheln**, geforderte Sprunghöhe **≤ 3 Kacheln** (ohne Pilz).

Sprung-Logik pro Tick:
```
coyote = grounded ? COYOTE_TIME : max(0, coyote - dt)
jumpBuffer = jumpPressed ? JUMP_BUFFER : max(0, jumpBuffer - dt)

if jumpBuffer > 0 and (grounded or coyote > 0):
    vy = JUMP_VELOCITY; grounded=false; coyote=0; jumpBuffer=0; jumpHeld=true

if vy < 0 and not jumpHeld:      g = GRAVITY_RELEASE     // variable Höhe
elif abs(vy) < 72:               g = GRAVITY_APEX        // Hangtime
else:                            g = GRAVITY
vy = min(vy + g*dt, TERMINAL_VELOCITY)
```

### 3.3 Wall-Slide & Wall-Jump (Basis-Moveset)

| Konstante | Wert | px/frame@60 |
|---|---|---|
| `WALL_SLIDE_SPEED` | 132 px/s | 2.2 |
| `WALL_JUMP_VX` | 288 px/s | 4.8 |
| `WALL_JUMP_VY` | −690 px/s | −11.5 |
| `WALL_JUMP_LOCK` | 0.133 s (Input-Lock) | 8 frames |
| `WALL_COYOTE` | 0.083 s | 5 frames |

Wall-Slide-Bedingung: nicht grounded **und** `vy>0` **und** Input drückt in Wandrichtung **und** seitlicher Kontakt → `vy = min(vy, WALL_SLIDE_SPEED)`.
Wall-Jump (bei Sprung während Slide/Wall-Coyote): `vx = -wallDir*WALL_JUMP_VX; vy = WALL_JUMP_VY`, Input-Lock für `WALL_JUMP_LOCK`.

### 3.4 Optionale Fähigkeiten (freischaltbar / Modifier)

- **Dash:** `DASH_SPEED = 540 px/s`, Dauer `0.133 s`, danach `vx` auf `MAX_RUN_SPEED` gekappt; während Dash `GRAVITY = 0`; `DASH_COOLDOWN = 0.5 s`; 1× pro Luftphase (Reset bei Boden/Wand). Für Lücken bis 6 Kacheln & als Rätsel-Gate.
- **Doppelsprung:** zweiter Sprung `−630 px/s`, 1× pro Luftphase, Reset bei Boden/Wall-Jump. Nur in Endlos-Modifiern oder späten Kampagnenwelten.

Beide sind **nicht** Teil des Basis-Movesets; jede geforderte Kampagnen-/Generator-Passage ist ohne sie lösbar, außer ein entsprechendes Item liegt im Level.

---

## 4. Rätsel- & Platforming-Mechaniken (Verhalten je Element)

Alle Objekte sind kachel-gerastert (32px), Zustände deterministisch. **Fixe Update-Reihenfolge pro Frame:** Input → bewegliche Plattformen/Blöcke → Spielerphysik → Kollision → Trigger/Interaktionen → Tod-Check. Bewegliche Objekte updaten **vor** dem Spieler (Mitführung stimmt).

### 4.1 Farbige Druckplatten `1 2 3` & Barrieren `! ? %`
Kopplung: `1↔!` (rot), `2↔?` (grün), `3↔%` (blau). Platte aktiv (`on`), solange Spielergewicht **oder** ein `O`-Block daraufsteht; gleichfarbige Barriere wird dann durchlässig. Mehrere Platten/Barrieren gleicher Farbe sind ODER-verknüpft. **Verhalten in dieser Spezifikation: momentan** (Barriere schließt wieder bei Entlasten) → erzwingt Block-auf-Platte-Rätsel oder Timing-Sprints.

### 4.2 Schlüssel `K` & Tore `D`
`K` beim Berühren eingesammelt; öffnet **alle** `D`-Tore des Levels dauerhaft (Tor verschwindet). Rätsel entsteht durch Route/Reihenfolge, nicht durch Farbe. (Farbige Schlüssel = optionale Zukunftserweiterung, nicht im MVP.)

### 4.3 Schiebbarer Block `O`
Belegt 1×1. Schieben: Laufen gegen den Block bei Bodenkontakt bewegt ihn mit `PUSH_SPEED = 120 px/s`. Ziehen: Aktionstaste halten + weglaufen. Blöcke fallen mit Gravitation (können auf Platten / in Lücken fallen). Nutzen: Trittstufe, Lücke füllen, Platte dauerhaft belasten, Dornen abdecken. (Baumstamm 2×1 = optionale Variante, nicht in Kampagnen-Grids genutzt.)

### 4.4 Bewegliche Plattformen `H` (horizontal) / `V` (vertikal)
Folgen einer Waypoint-Liste; Modi Ping-Pong / Loop / Once-on-trigger. Speed 60–150 px/s. Ease-in-out (`sin`-Interpolation). Spieler wird per Positions-Delta mitgeführt; beim Absprung kein Momentum-Transfer (Standard).

### 4.5 Sprungpilz `^`
Bei Landung darauf `vy = BOUNCE_VELOCITY = −1020 px/s` (≈ 4.5 Kacheln). Hält der Spieler Sprung: +10% (`−1122 px/s`). Erreicht sonst unerreichbare Höhen; kettenbar.

### 4.6 Einweg-Plattform `:` (Blätter)
Kollision nur von **oben** (`vy>0` und Fußhöhe im Vorframe über Oberkante). Von unten durchspringbar. Runterfallen: ↓ + Sprung deaktiviert Kollision für `0.1 s` (12 frames).

### 4.7 Wind (Aufwind) `W`
Zone übt konstante Aufwärtskraft `WIND_FORCE_UP = −1800 px/s²` aus, solange der Spieler in der Spalte ist; kappt Fallspeed und erlaubt „Gleiten". (Seitlicher Wind `±2160 px/s²` = Generator-Option.)

### 4.8 Teleporter `T`
Paarweise (2 pro Farbe/Level). Betreten von A → Spieler an B, `TELEPORT_COOLDOWN = 0.333 s` gegen Ping-Pong. Objekte (`O`) können mitgeschickt werden. Momentum-Übertragung: aus (Standard).

### 4.9 Farb-Edelsteine `r g b`
Kollektibel, nicht solide, Zähler pro Farbe. Reine Sammel-/Wertungsobjekte (3. Stern). Nicht siegentscheidend in der Kampagne.

### 4.10 Weitere im Generator/optional verfügbare Mechaniken
Einstürzende Plattformen (`CRUMBLE_DELAY 0.4 s` / `RESPAWN 3.0 s`), Toggle-Blöcke (An/Aus, global oder Timer), Pendel-Ranken, freundliche Wusel-Gegner (Kopfsprung besiegt, Bounce `−540 px/s`; Seitkontakt = Tod). Nicht Teil der 10 Kampagnen-Grids; als Endlos-Bausteine/Erweiterung dokumentiert.

### 4.11 Gefahren & Tod
- **Dornen `*`** und **Wasser/Abgrund `~`**: Berührung = Tod (Hazard-Hitbox 4px kleiner als Kachel = vergebend).
- Fallen unter Level-Untergrenze = Tod.
- **Tod & Respawn:** ≤ 0.1 s Freeze + kurzer Fade, dann Neustart am letzten Checkpoint bzw. Levelstart. Bewegliche/veränderte Objekte auf Checkpoint-Snapshot zurücksetzen (deterministisch). **R** = sofortiger Full-Restart. Kein Blut, nur Partikel-Auflösung.

### 4.12 Siegbedingung
Level-Config `winCondition`:
- `REACH_EXIT` — `X` berühren. **Alle 10 Kampagnen-Level nutzen dies.**
- `COLLECT_ALL_THEN_EXIT` — alle Pflicht-Edelsteine, dann `X` (bis dahin geschlossen). Für Generator-/Zukunftsvarianten.
- `SURVIVE_TIME` — Endlos-Sub-Modus.

### 4.13 Wertung (3 Sterne pro Level)
1. ⭐ Level beendet.
2. ⭐ Unter `par` **oder** ohne Tod.
3. ⭐ Alle optionalen Edelsteine gesammelt.

Level-Timer läuft mit; Bestzeit lokal gespeichert (§5.3, §10). Todeszähler nur für Wertung.

---

## 5. Tile-Legende & Level-Datenformat (JSON)

### 5.1 Tile-Legende (verbindlich)

Ein Zeichen = eine 32×32-Kachel. In Grids steht `.` für Luft (Ausrichtung); im Parser sind `.` und Leerzeichen identisch (leer).

| Zeichen | Element | Kollision / Rolle | Repräsentation |
|---|---|---|---|
| `.` / (Leer) | Luft | nicht solide | Tile EMPTY |
| `#` | Gras-Boden | solide (Graskante oben) | Tile SOLID |
| `=` | Erde | solide (Füllung) | Tile SOLID |
| `:` | Einweg-Plattform | nur von oben solide | Tile ONEWAY |
| `H` | bewegl. Plattform horizontal | solide, trägt Spieler | Objekt Mover |
| `V` | bewegl. Plattform vertikal | solide, trägt Spieler | Objekt Mover |
| `^` | Sprungpilz | Bounce | Objekt Mushroom |
| `*` | Dorn | tödlich | Tile HAZARD |
| `~` | Wasser / Abgrund | tödlich | Tile HAZARD |
| `K` | Schlüssel | einsammelbar, öffnet alle `D` | Objekt KeyItem |
| `D` | Tor | solide bis Schlüssel geholt | Objekt Door |
| `1` `2` `3` | Druckplatte rot/grün/blau | Trigger (Spieler/`O`) | Objekt Plate |
| `!` `?` `%` | Barriere rot/grün/blau | solide, wenn Platte inaktiv | Objekt Barrier |
| `O` | schiebbarer Block | solide, fällt, schiebbar | Objekt Box |
| `T` | Teleporter | paarweise | Objekt Teleporter |
| `W` | Wind (Aufwind) | Kraftzone | Objekt WindZone |
| `r` `g` `b` | Edelstein rot/grün/blau | Sammelobjekt | Objekt Gem |
| `S` | Start | Spawn (genau 1) | `level.spawn` |
| `X` | Ausgang | Ziel (≥ 1) | `level.goal` |
| `"` | Deko-Baum | rein visuell | Deko |
| `o` | Deko-Wolke | rein visuell (Parallax) | Deko |

**Regeln:** Grid ist ein rechteckiges Zeichen-Array (`rows[y][x]`, y=0 oben); Parser padded kürzere Zeilen mit `.`. Genau ein `S`, mindestens ein `X`. Marker-Glyphen (`S X K D O T W ^ H V r g b " o`) schreiben in die Tilemap **EMPTY** und werden zusätzlich als Objekt/Marker extrahiert (blockieren die Statik nicht). Teleporter, Platten/Barrieren nach Farbe gruppiert.

### 5.2 JSON-Level-Format (verbindlich)

Ein Level-Set ist **eine** Datei; Kampagne, Daily und Endless durchlaufen **dieselbe** `parseLevel`-Pipeline.

```json
{
  "version": 1,
  "tileSize": 32,
  "levels": [
    {
      "id": "c01",
      "name": "Erste Schritte",
      "author": "Br-di Team",
      "par": 20,
      "difficulty": 1,
      "palette": "spring",
      "winCondition": "REACH_EXIT",
      "rows": [
        "............................",
        ".......o....................",
        "..\".........................",
        "............................",
        "............................",
        "...............K............",
        "..............::::..........",
        "........::::................",
        "............................",
        ".S....................D...X.",
        "########~~~#################",
        "============================"
      ],
      "objects": [
        { "id": "h1", "type": "mover", "axis": "x", "tile": [4,6],
          "path": [[4,6],[10,6]], "mode": "pingpong", "speed": 100 }
      ]
    }
  ]
}
```

**Feld-Verträge:**
- `par` in **Sekunden** (Autoren-freundlich); intern als ms verrechnet.
- `rows` = ASCII-Grid (die einzige Geometriequelle). Reine Glyphen (Pilz, Edelstein, Schlüssel, Block, Teleporter, Wind, Dorn) brauchen **keinen** `objects`-Eintrag — sie werden aus dem Grid instanziiert.
- `objects` nur für **konfigurierte** Objekte: Mover-Pfade (`path`, `mode` ∈ pingpong/loop/once, `speed` px/s, `axis`), Teleporter-Pairing (`pair`, `color`), Toggle-Targets. Verortung per `tile`-Koordinate `[tx,ty]`.
- Fehlt zu einem `H`/`V`-Glyph ein `objects`-Eintrag, erzeugt der Parser einen Default-Ping-Pong über 3 Kacheln, Speed 100.
- Der Generator baut intern denselben `rows`-Array und ruft `parseLevel` → identische Pipeline.

---

## 6. Die 10 Kampagnen-Level (ASCII-Grids + Kernidee)

Alle Grids sind rechteckig und legendenkonform; alle lösbar unter den Invarianten (Sprung ≤ 3 hoch / ≤ 4 breit, self-contained Rätsel). `par` = Richtwert-Zielzeit (Sekunden). Alle: `winCondition = REACH_EXIT`.

### Level 1 — „Erste Schritte" · par 20
Kernidee: Wasser überspringen, Schlüssel holen, Tor öffnen — Sprung, Sammeln, Tor in einem Atemzug.
```
............................
.......o....................
..".........................
............................
............................
...............K............
..............::::..........
........::::................
............................
.S....................D...X.
########~~~#################
============================
```

### Level 2 — „Pilzsprünge" · par 25
Kernidee: Kette aus Sprungpilzen `^` trägt über drei Wassergräben; die `:`-Plattformen sind optionale Landepunkte für die Edelsteine.
```
...............................
..........g........b...........
...............................
....r..........................
...............................
......::::........::::.........
...............................
...............................
.S...........................X.
###^~~~###^~~~###^~~~###^~~~##.
==============================.
==============================.
```

### Level 3 — „Farbenspiel" · par 35
Kernidee: Erster Block `O` als Werkzeug — schiebe ihn auf die rote Platte `1`, damit die rote Barriere `!` offen bleibt, während du weiterläufst.
```
..................................
..........o.......................
..................................
.........................g........
.................!...........X....
..........O......!................
......=====......!....=====.......
.................!................
.S....O.......1..!................
#################################.
#################################.
=================================.
```

### Level 4 — „Bewegliche Wege" · par 40
Kernidee: Breiter See, nur horizontal pendelnde Plattformen `H`; Timing der Sprünge zwischen den Trägern; Edelstein `b` auf Umweg-Podest.
```
....................................
.......o..................o.........
....................................
..............b.....................
.........::::.......................
..............................X.....
....H..........H.........HHHH.......
....................................
.S..................................
###~~~~~~~~~~~~~~~~~~~~~~~~~~~######
===~~~~~~~~~~~~~~~~~~~~~~~~~~~======
==================================..
```

### Level 5 — „Der Schlüsselgarten" · par 45
Kernidee: Zwei Tore `D`, ein `K` öffnet beide — die Route zwingt zum präzisen Zurückspringen durch enge Dornen-`*`-Passagen.
```
....................................
...".........o..............".......
....................................
.........K...........K..............
........:::.........:::.............
....................................
.............D..........D.......X...
.....**......#......**...#......#...
.S...**......#......**...#......#...
#####**#######******#####*******####
####################################
====================================
```

### Level 6 — „Windkanal" · par 50
Kernidee: Aufwind-Spalten `W` heben dich, aber nur im Luftstrom — zu früh raus = Wasser; oben führen `:`-Absätze zum Ziel.
```
...................................
...........g.......................
.....:::...........................
..............:::..................
.W.........................:::.....
.W..............W.............X....
.W..............W.............#....
.W..............W.............#....
.S..............#.........:::.#....
###~~~~~~~~~~~~~~#~~~~~~~~~~~~~####
===~~~~~~~~~~~~~~#~~~~~~~~~~~~~####
=================#################.
```

### Level 7 — „Teleporter-Labyrinth" · par 55
Kernidee: Linker Teleporter `T` bringt dich nach rechts oben — die rote Barriere `!` versperrt den Rückweg, also erst unten den Block `O` auf die Platte `1` schieben, dann teleportieren.
```
...................................
.......=====.......................
.......T..........O................
.......#####......#....=====.......
..................#....T......X....
..................#....#######.....
.....1............#....!...........
.....!............#....!...........
.S...!......O.....#....!...........
##########################.........
##########################.........
==================================.
```

### Level 8 — „Dornenpfad" · par 60
Kernidee: Reines Präzisions-Platforming — Sprünge über Dornen-`*`-Gräben, Sprungpilz `^` und bewegliche Plattform `H` verketten sich; Edelsteine auf der riskanten Oberlinie.
```
....................................
..........b.........................
.......:::..........................
..............*........::::.........
...........::::....H................
................................X...
....::::...................:::::....
.S..............^..............#....
###*~~~*###*~~~###*~~~*###*~~~*###..
===~~~~~===~~~~~==~~~~~~===~~~~~===.
===================================.
===================================.
```

### Level 9 — „Drei Farben" · par 75
Kernidee: Drei Farb-Gates hintereinander (`1!`/`2?`/`3%`); jede Barriere braucht ihren Block `O` auf der passenden Platte — Reihenfolge-Rätsel plus Sprint durch die öffnenden Tore.
```
.......................................
..........g.........r.........b........
.........:::.......:::.......:::.......
.......................................
...1.....!....2.....?....3.....%...X...
...O.....!....O.....?....O.....%...#...
...=.....!....=.....?....=.....%...#...
.S.......!............?........%...#...
######################################.
######################################.
######################################.
======================================.
```

### Level 10 — „Gipfelsturm" · par 90
Kernidee: Finale — Block/Platte-Gate am Start, Wasser auf `H`-Plattformen queren, Aufwind `W` hoch, Schlüssel `K` fürs Tor `D`, dann über Pilz und `:`-Absätze zum Gipfel-Ausgang.
```
..........................................
.....o................o...................
..............................K......X....
...................W.........::::.....#...
............b......W...............D..#...
.......::::........W.............=====#...
..................W.........^........#....
....1....^........W...............:::.#....
....!....###..........HHHH...........#....
.S..!....===~~~~~~~~~~~~~~~~~~*###^~~~#...
####!####===~~~~~~~~~~~~~~~~~~####===###..
=========================================.
```

**Schwierigkeitskurve (Design-Absicht):**

| Lvl | Neue Mechanik | Rätsel-Last | Platforming-Last |
|---|---|---|---|
| 1 | Schlüssel/Tor | ● | ● |
| 2 | Sprungpilz | ● | ●● |
| 3 | Block + Farbplatte | ●● | ● |
| 4 | bewegl. Plattform | ● | ●●● |
| 5 | 1 Schlüssel → 2 Tore + Dornen | ●● | ●● |
| 6 | Wind | ●● | ●● |
| 7 | Teleporter + Block-Gate | ●●● | ●● |
| 8 | Dornen-Ketten | ● | ●●●● |
| 9 | 3-Farben-Sequenz | ●●●● | ●● |
| 10 | alles kombiniert | ●●● | ●●●● |

---

## 7. Endlos-Generator & Rätsel-des-Tages (Algorithmus)

### 7.1 Seeded-PRNG (mulberry32) — gemeinsame Grundlage

```js
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick    = (rng, arr)    => arr[Math.floor(rng() * arr.length)];
```

### 7.2 Segment-Verkettung

Level = Band fester Höhe **H = 14**, aus **Segmenten** (Chunks, 8–12 Spalten) links→rechts. Jedes Segment garantiert einen Weg von Eingangshöhe `yin` (linke Kante) zu Ausgangshöhe `yout` (rechte Kante); `yout` eines Segments = `yin` des nächsten → keine Brüche.

```
Level = [StartPad] + [Segment_0 ... Segment_N] + [ZielPad]
```

### 7.3 Lösbarkeits-Invarianten (harte Regeln)

Abgeleitet aus der Physik (voller Sprung ≈ 3.3 Kacheln hoch, 4.5 breit):
1. **Höhensprung ≤ 3** Kacheln zwischen zwei begehbaren Feldern (1 Puffer).
2. **Lücke ≤ 4 Kacheln** über Wasser/Abgrund ohne Hilfe; breitere Lücken **müssen** `:`, `H` oder `^` in Reichweite enthalten.
3. **Keine Decke tiefer als 4 Kacheln** über einem Sprungbogen.
4. **Jedes Rätsel-Segment ist self-contained:** Block, Platte, Barriere, Ziel im selben Chunk.
5. **Reachability-Check (BFS über Sprung-Nachbarschaft)** nach Platzierung; Fehlschlag → deterministisches Reroll mit anderem Seed-Offset.

### 7.4 Segment-Bausteine (gewichtet nach Schwierigkeit)

Jeder Baustein: `(rng, difficulty, yin) → { tiles, yout }`.

| Baustein | Inhalt | ab Diff |
|---|---|---|
| `FLAT` | ebener Boden, evtl. 1 Edelstein | 0 |
| `STEP` | Treppe hoch/runter (Δy ≤ 3) | 0 |
| `GAP_JUMP` | Wassergraben Breite 2–4 | 1 |
| `MUSHROOM` | `^` überbrückt Graben/Höhe | 1 |
| `ONEWAY_CLIMB` | Staffel aus `:`-Plattformen | 2 |
| `MOVING` | 1–2 `H`-Plattformen über Wasser | 2 |
| `SPIKE_RUN` | Dornen-`*`-Graben-Kette | 3 |
| `KEY_GATE` | `K` + `D` mit kleinem Umweg | 3 |
| `COLOR_GATE` | `O` + Platte + Barriere (1 Farbe) | 4 |
| `WIND_LIFT` | `W`-Spalte + oberer Absatz | 4 |
| `TELE_HOP` | `T`-Paar überspringt Hindernis | 5 |

### 7.5 Endlos: Skalierung mit Distanz

```js
function makeEndless(seed, length = 30) {
  const rng = mulberry32(seed);
  const H = 14;
  let cols = startPad();
  let yout = 10;                         // groundRow
  for (let i = 0; i < length; i++) {
    const difficulty = Math.min(5, Math.floor(i / 5));   // härter alle 5 Segmente
    const pool = buildersUpTo(difficulty);
    let seg, tries = 0;
    do {
      seg = pick(rng, pool)(rng, difficulty, yout);
      tries++;
    } while (!bfsReachable(seg) && tries < 8);            // Invariante 5
    if (!bfsReachable(seg)) seg = FLAT(rng, 0, yout);     // Sicherheitsnetz
    cols = concat(cols, seg.tiles);
    yout = seg.yout;
  }
  return finalizeGrid(concat(cols, exitPad(yout)), H);    // → rows[] → parseLevel
}
```
- Hazard-/Lückendichte wächst linear mit `difficulty` (Grabenbreite `randInt(rng,2,2+difficulty)`, gedeckelt bei 4).
- Ab Diff 3: ~1 Rätsel-Segment pro 3 Chunks.
- 8× Reroll gescheitert → garantiert lösbares `FLAT`. Der Lauf bricht nie ab.

### 7.6 Rätsel des Tages

Ein Level pro Kalendertag, für alle identisch, **konstante** mittlere Schwierigkeit (≈ Kampagne 5–6), kein Ramping.

```js
function dailySeed(date = new Date()) {           // UTC → weltweit gleich
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return parseInt(`${y}${m}${d}`, 10);            // z.B. 20260724
}

function dailyPuzzle(date = new Date()) {
  const rng = mulberry32(dailySeed(date));
  return generateLevel(rng, {
    length: 14,           // kurz & knackig, ~60–90 s
    difficulty: 3,        // KONSTANT
    guaranteeOneOf: ['COLOR_GATE', 'KEY_GATE', 'TELE_HOP'],  // ≥1 echtes Rätsel
    hazardDensity: 0.5    // fix → reproduzierbar
  });
}
```
- Deterministisch: gleicher Tag → identisches Level → faire Bestzeiten-Vergleiche.
- Dieselben Bausteine & Invarianten wie Endlos, aber ohne Distanz-Ramping.
- Speicherung: siehe §10 (`brdi_save.daily['YYYY-MM-DD']`), Streak über aufeinanderfolgende gelöste Tage.
- Beispiel: heute (2026-07-24) → Seed **`20260724`**, für alle identisch.

---

## 8. Farbpalette (Hex) & Zeichen-Rezepte / Art-Style

**Identität:** warm, bunt, freundlich, „Knuddel-Vektor". Alles aus Canvas-2D-Primitiven (roundRect, Kreise, Verläufe), keine Assets. Weiche große Rundungen, satte-leicht-entsättigte Farben (Pastell im BG, kräftig im VG), helle Rim-Lights oben, dezente Schatten unten.

### 8.1 Farbpalette (verbindliche Hex-Werte)

**Himmel & Atmosphäre**
| Rolle | Hex |
|---|---|
| Himmel oben | `#4EA9FF` |
| Himmel Mitte (55%) | `#8FD0FF` |
| Himmel unten (Horizont) | `#DFF3FF` |
| Sonne Kern | `#FFF6C8` |
| Sonne Rand | `#FFD447` |
| Sonnen-Glow | `#FFE79A` (α~0.6) |
| Sonnenstrahlen | `#FFDE6B` (α~0.35) |

**Wolken**
| Rolle | Hex |
|---|---|
| Highlight | `#FFFFFF` |
| Grundton | `#F2F7FF` |
| Schatten | `#D6E4F5` |
| Unterkante | `#C2D6EE` |

**Gras & Boden**
| Rolle | Hex |
|---|---|
| Gras hell (Oberkante) | `#7ED957` |
| Gras mittel | `#57C33E` |
| Gras dunkel | `#3E9E33` |
| Gras-Halme Akzent | `#A6F07A` |
| Erde hell | `#B07A47` |
| Erde dunkel | `#7E5230` |
| Erd-Sprenkel | `#5E3D22` |

**Bunte Baumkronen (6 Varianten, per Positions-Hash rotieren)**
| Baum | Krone hell | Krone dunkel |
|---|---|---|
| Limette | `#9BE86A` | `#6FBF3E` |
| Türkis-Mint | `#5FD3B2` | `#37A487` |
| Koralle | `#FF8C7A` | `#E85C4A` |
| Sonnengelb | `#FFC94D` | `#F0A21E` |
| Lavendel | `#B79BFF` | `#8A6BE0` |
| Pink | `#FF9ED2` | `#F06AB0` |
| Stamm hell / dunkel | `#B07A47` | `#7E5230` |

**Parallax-Berge (3 Ebenen)**
| Ebene | Hex | Scroll-Faktor |
|---|---|---|
| Fern (Lavendel-Dunst) | `#C9B8F0` | 0.15 |
| Mittel (Pastellblau) | `#9FC9E8` | 0.30 |
| Nah-BG (Pastellgrün Hügelfuß) | `#8FD98A` | 0.55 |

**Begehbare Berge/Hügel**
| Rolle | Hex |
|---|---|
| Top (Highlight/Schnee) | `#EAFBE4` |
| hell | `#8AD86E` |
| mittel | `#63BE49` |
| Schatten | `#479235` |
| Fels-Akzent | `#C9C2A8` |

**Plattformen**
| Rolle | Hex |
|---|---|
| Deckel (Gras) | `#7ED957` |
| Körper hell | `#C79A63` |
| Körper dunkel | `#9A6E3E` |
| Outline | `#6B4A28` |
| beweglich (Akzent) | `#FFB84D` |

**Spielfigur „Br-di"**
| Rolle | Hex |
|---|---|
| Körper Hauptton | `#FF5E7E` |
| Körper Schatten | `#E23E60` |
| Körper Highlight | `#FF9DB0` |
| Bauch/Gesicht hell | `#FFE3DE` |
| Augen | `#2B2B3A` |
| Augen-Glanz | `#FFFFFF` |
| Wangen | `#FF9DB0` (α 0.7) |
| Outline (überall) | `#3A2233` |

**Edelsteine**
| Typ | Grund | dunkel | Glanz |
|---|---|---|---|
| Rubin (r) | `#FF4D5E` | `#C21F35` | `#FFD3D8` |
| Smaragd (g) | `#3EE07A` | `#1F9E4E` | `#CFFFE0` |
| Saphir (b) | `#4D8CFF` | `#1F52C2` | `#D3E2FF` |
| Funkel-Stern | `#FFFFFF` | — | α-Blitz |

**Gefahren**
| Rolle | Hex |
|---|---|
| Dorn Körper | `#4A4A5A` |
| Dorn Spitze/Glanz | `#8A8AA0` |
| Dorn Basis | `#2E2E3A` |
| Wasser hell | `#4D8CFF` (Oberfläche) |
| Wasser dunkel | `#1F52C2` |
| Gefahr-Warnpuls | `#FF2E4D` (α-Pulse) |

> Hinweis: Wasser `~` nutzt die Saphir-Blautöne (freundliche Graswelt, keine Lava). Die Lava/Säure-Töne der Art-Facette (`#FF7A2E`/`#D83A1E`/`#8CE04A`) sind als optionale Alternativ-Hazard-Skins reserviert, im Kampagnen-Set nicht verwendet.

**HUD / UI**
| Rolle | Hex |
|---|---|
| Panel-Hintergrund | `#2B2438` (α 0.72) |
| Panel-Rand | `#FFFFFF` (α 0.15) |
| Text primär / sekundär | `#FFFFFF` / `#C9BFE0` |
| Akzent (Button aktiv) | `#FFC94D` |
| Erfolg/Sieg | `#3EE07A` |
| Timer normal / knapp | `#8FD0FF` / `#FF7A2E` |
| Tode-Zähler | `#FF5E7E` |
| Touch-Button Füllung / aktiv | `#FFFFFF` (α 0.18) / `#FFC94D` (α 0.35) |

**Partikel**
| Anlass | Farben |
|---|---|
| Landung (Staub) | `#EAFBE4`, `#B07A47` |
| Sammeln | Edelstein-Grundton + `#FFFFFF` |
| Sprung (Puff) | `#FFFFFF`, `#DFF3FF` |
| Tod (Burst) | `#FF5E7E`, `#3A2233`, `#FFC94D` |
| Ambiente-Pollen | `#FFF6C8` (α 0.25) |

### 8.2 Rendering-Konventionen

- **Outline:** VG-Objekte mit `#3A2233`, `lineWidth` 2–4, `lineJoin='round'`. BG (Parallax, Wolken) ohne Outline.
- **Rim-Light** oben (linearer Vertikal-Verlauf hell→satt). **Ground-Shadow** unter jedem Objekt: flache Ellipse `rgba(0,0,0,0.15)`.
- **Helper** `roundRect(ctx,x,y,w,h,r)`. Globale `t` (Sek.) treibt Wiegen/Blinzeln/Pulse via `Math.sin`; gemeinsame `windPhase` synchronisiert Halme/Bäume.

### 8.3 Zeichen-Rezepte (Kurzform, verbindlich)

- **Br-di:** Kapsel (roundRect r=½ Breite), Verlauf `#FF9DB0→#FF5E7E→#E23E60`. Squash&Stretch `sx=1+vy*0.0015`, `sy=1-vy*0.0015`, geklemmt 0.75–1.3, um Fußpunkt; Landungs-Squash `sy=0.7` über ~8 Frames ease-out. Bauchfleck `#FFE3DE`; zwei Augen `#2B2B3A` + Glanz, Blick-Offset in Laufrichtung, Blinzeln alle 3–5 s ~6 Frames; Wangen `#FF9DB0` α0.7; Lauf-Wackeln `±0.06 rad` per `sin(t*12)` nur bei `|vx|>0`.
- **Bäume:** Stamm-roundRect `#B07A47→#7E5230`; Krone = 3–5 überlappende Kreise (dunkler Ton hinten, hell vorne) + Rim-Kreis oben-links α0.4; Wiegen `sin(t*1.5+seed)*0.05` um Stammbasis; ferne Bäume ohne Outline.
- **Hügel/Berge:** überlappende Bögen, Schichtung `#479235→#63BE49→#8AD86E`, Gipfelkappe `#EAFBE4`, Fels `#C9C2A8`, Gras-Halme entlang Top-Kurve.
- **Wolken:** 4–6 weiße Kreise, Unterkante `#C2D6EE/#D6E4F5`, Oberkante `#FFFFFF`; Eigenbewegung per Wind, unabhängig vom Scroll.
- **Sonne:** radialer Glow `#FFE79A`→transparent; 12 Strahlen-Keile `#FFDE6B` α0.35, Rotation `t*0.05`, Länge pulsiert `sin(t*2)`; Scheibe `#FFF6C8→#FFD447`; Scroll-Faktor ~0.05.
- **Gras:** Deckel `#7ED957` mit welliger Oberkante (`quadraticCurveTo`), Halme alternierend `#57C33E/#A6F07A`, Neigung `sin(t*2+x*0.3)*3px`; darunter `#3E9E33`, dann Erde mit `#5E3D22`-Sprenkeln (Seed-statisch).
- **Edelsteine:** Facetten-Diamant (6 Punkte), Verlauf Grund→dunkel, Highlight-Trapez oben α0.8; Bob `y+=sin(t*2)*3`, `scaleX=sin(t*1.5)` (Pseudo-Rotation); Funkel-4-Zack alle ~1.2 s; schwacher Aura-Glow.
- **Plattformen:** Körper `#C79A63→#9A6E3E`, Outline `#6B4A28`, Gras-Deckel `#7ED957` mit Halm-Überhängen; bewegliche mit `#FFB84D`-Rand + Pfeil-Indikator, ease-in-out (`sin`-Interpolation), Ground-Shadow.
- **Dornen:** Dreieck-Reihe `#8A8AA0→#4A4A5A`, Basis `#2E2E3A`, Warnpuls `#FF2E4D` α `0.2+0.15*sin(t*6)`.
- **Wasser:** Becken, wellige `sin`-Oberfläche `#4D8CFF`, Tiefe `#1F52C2`, aufsteigende α-Blasen.

### 8.4 Parallax (Scroll-Faktoren)

| Ebene | Inhalt | Faktor |
|---|---|---|
| 0 | Himmel + Sonne | 0.00–0.05 |
| 1 | Lavendel-Berge, große Wolken | 0.15 |
| 2 | Pastellblaue Berge, mittlere Wolken | 0.30 |
| 3 | Pastellgrüne Hügelfüße, ferne Baumreihe | 0.55 |
| 4 | Spielebene (Tiles, Bäume, Br-di, Objekte) | 1.00 |

---

## 9. HUD, Screens & Juice

### 9.1 HUD (In-Game Top-Leiste, Panel `#2B2438` α0.72, Rundung 12px)

- **Links:** Levelname (`#FFFFFF` fett) + Modus-Badge (`#FFC94D`-Pille: „Kampagne" / „Rätsel des Tages" / „Endlos").
- **Mitte:** Edelstein-Zähler — drei Mini-Diamanten (rot/grün/blau) mit `x/N`, Sammel-Pop.
- **Rechts:** Timer (`#8FD0FF`; < 10 s → `#FF7A2E` + Pulse). Darunter Tode-Zähler mit kleinem Br-di-Icon (`#FF5E7E`).

### 9.2 Screens

- **Start:** Großer Titel „Br-di" (Pink `#FF5E7E`, `#3A2233`-Outline, leichtes Bob), drei große `#FFC94D`-Pillen (Kampagne / Rätsel des Tages / Endlos), animierter Parallax-Hintergrund.
- **Pause:** Overlay `#2B2438` α0.6, Panel „Pause", Buttons Weiter / Neustart / Menü.
- **Sieg (Level Complete):** Panel mit `#3EE07A`-Rand, „Geschafft!", Zeit + Tode + Edelsteine, Bestzeit-Badge (`#FFC94D`) bei Rekord, Konfetti.
- **Game Over:** Retry-Screen (`audio.sfx('die')`), Buttons Retry / Menü — im Casual-Sinn nahtlos, da Respawn instant.

### 9.3 Juice

- **Partikel-Pool** (gemeinsame update/draw): Landung 6–10 Staub (Intensität ∝ Fallspeed); Sammeln 8 Splitter + 3 Funken + HUD-Zähler-Pop; Sprung weißer Puff; Tod 16-Partikel-Burst; Ambiente-Pollen langsam driftend.
- **Screenshake bei Tod:** `mag=8px`, exponentiell auf 0 über ~0.4 s.
- **Eases:** `easeOutBack` / `easeInOutSine` für Squash&Stretch, Edelstein-Bob, Plattform, HUD-Pop.
- **Coyote-/Landungs-Feedback:** weißer Boden-Ring bei sattem Aufkommen.
- **Sieg:** Konfetti in Edelstein-/Sonnenfarben, Zeitlupen-Pop.
- **Touch-Buttons:** `#FFFFFF` α0.18, aktiv `#FFC94D` α0.35, Outline `#FFFFFF` α0.3, Druck-Scale 0.92→1.

---

## 10. Architektur: Dateien, Module, Schnittstellen, State-Maschine, Game-Loop

Vanilla JS, ES-Module, kein Build. `index.html` lädt `js/main.js` als `type="module"`. Kein Framework, keine externen Abhängigkeiten.

### 10.1 Datei-/Ordnerstruktur

```
Br-di/
├── index.html                 # <canvas> + <script type="module" src="js/main.js">
├── css/
│   └── style.css              # Layout, Canvas-Skalierung, Touch-Overlay, Menü-DOM
├── assets/
│   └── levels/
│       ├── campaign.json      # 10 Kampagnen-Level (Format §5.2)
│       └── tiles.json         # Glyph → Typ/Farbe/Verhalten (Legende §5.1)
└── js/
    ├── main.js                # Bootstrap, Verdrahtung, Session
    ├── engine.js              # Fixed-timestep Loop, Accumulator, Interpolation
    ├── state.js               # State-Machine + Übergänge
    ├── input.js               # Keyboard + Touch → InputState
    ├── physics.js             # AABB, Sweep, Auflösung Tilemap + Movers/Boxes
    ├── entities.js            # Player + interaktive Objekte
    ├── level.js               # ASCII → Level, Tilemap-Zugriff
    ├── generator.js           # mulberry32 + Endless/Daily
    ├── render.js              # Kamera, Parallax, Layer-Zeichnen
    ├── audio.js               # WebAudio, prozedurale SFX
    ├── ui.js                  # Menü, HUD, Overlays
    ├── save.js                # localStorage (brdi_save)
    └── constants.js           # Tile-Größe, Physik, Paletten, Enums
```

**Abhängigkeitsfluss (keine Zyklen):**
```
main → { engine, state, input, save, audio, ui, render, level, generator, entities, physics }
render → level, entities, constants
physics → level, constants
entities → physics, constants
generator → level, constants
level → constants
Alle Blätter → constants
```
`constants.js` importiert nichts. Kein Modul importiert `main`.

### 10.2 `constants.js` (reconciled — verbindlich)

```js
export const TILE = 32;                  // px
export const DT = 1 / 120;               // fester Physik-Schritt (s)
export const MAX_FRAME = 0.25;           // Clamp gegen "spiral of death"

// --- Physik (px/s, px/s²) — aus Mechanik-Facette abgeleitet ---
export const MAX_RUN_SPEED   = 270;
export const RUN_ACCEL       = 3240;
export const RUN_DECEL       = 4680;
export const TURN_ACCEL      = 5760;
export const AIR_ACCEL       = 1980;
export const AIR_DECEL       = 1260;
export const GRAVITY         = 2700;
export const GRAVITY_APEX    = 1620;     // aktiv wenn |vy| < 72
export const GRAVITY_RELEASE = 6840;     // Aufstieg + Taste losgelassen
export const APEX_THRESHOLD  = 72;       // px/s
export const JUMP_VELOCITY   = -756;
export const TERMINAL        = 900;
export const COYOTE_TIME     = 0.10;     // s
export const JUMP_BUFFER     = 0.116;    // s

export const WALL_SLIDE_SPEED = 132;
export const WALL_JUMP_VX     = 288;
export const WALL_JUMP_VY     = -690;
export const WALL_JUMP_LOCK   = 0.133;
export const WALL_COYOTE      = 0.083;

export const DASH_SPEED    = 540;
export const DASH_TIME     = 0.133;
export const DASH_COOLDOWN = 0.5;
export const DOUBLE_JUMP_V = -630;

export const BOUNCE_V       = -1020;     // Pilz; gehalten -1122
export const PUSH_SPEED     = 120;
export const WIND_UP        = -1800;     // px/s² Aufwind
export const TELEPORT_CD    = 0.333;
export const CRUMBLE_DELAY  = 0.4;
export const CRUMBLE_RESPAWN= 3.0;

export const PLAYER_W = 28, PLAYER_H = 36;   // Kollisions-Hitbox

export const TileType = Object.freeze({
  EMPTY:0, SOLID:1, ONEWAY:2, HAZARD:3, SPAWN:4, GOAL:5
});
// Alle beweglichen/interaktiven Elemente (Mover, Box, Plate, Barrier,
// Key, Door, Mushroom, Teleporter, WindZone, Gem) sind ENTITIES, keine Tiles.

export const Color = Object.freeze({ RED:'red', GREEN:'green', BLUE:'blue' });
export const GameState = Object.freeze({
  MENU:'menu', PLAYING:'playing', PAUSED:'paused',
  LEVEL_COMPLETE:'level_complete', GAME_OVER:'game_over'
});
export const Mode = Object.freeze({ CAMPAIGN:'campaign', DAILY:'daily', ENDLESS:'endless' });
export const PALETTES = { /* §8.1 Hex-Tabellen */ };
```

### 10.3 Modulverträge (Export-Schnittstellen)

**`engine.js`**
```js
export class Engine {
  constructor({ update, render, dt = DT, maxFrame = MAX_FRAME });
  start();  // requestAnimationFrame-Schleife
  stop();
  get fps();
}
// update(DT): 0..n-mal pro Frame. render(alpha): genau 1×, alpha ∈ [0,1).
```

**`state.js`**
```js
export class StateMachine {
  constructor(initial = GameState.MENU);
  get current();
  can(to);
  transition(to, payload = {});   // wirft bei ungültigem Übergang
  on(state, { enter, exit });
  onAny(fn);                      // für UI-Sync
}
```

**`input.js`**
```js
export class Input {
  constructor(canvas, { touchZones });
  sample();               // -> InputState (am Frame-Anfang)
  consumeJumpPressed();   // Edge-Trigger
  destroy();
}
// InputState: { left, right, jump, jumpPressed, jumpReleased,
//               down, action, actionPressed, pause, restart, pointer:{x,y,down} }
```

**`physics.js`**
```js
export function aabbOverlap(a, b);
export function sweepAABB(box, vx, vy, dt, solids); // { x,y, hitX, hitY, onGround }
export function resolveEntity(entity, level, movers, dt);
//   mutiert x/y/vx/vy; setzt onGround, touching{l,r,u,d}. X-Achse dann Y-Achse.
export function tileAt(level, tx, ty);
export function pointInTile(level, px, py);
// ONEWAY nur von oben; MOVER/BOX als bewegliche Solids getrennt.
```

**`entities.js`**
```js
export class Entity { constructor({x,y,w,h,type}); x;y;w;h;vx;vy;onGround;touching;alive;
  savePrev(); update(dt, ctx); get aabb(); }  // ctx = {input, level, movers, audio, events}
export class Player extends Entity {
  hasKey; gems; canDash; canDoubleJump;
  update(dt, ctx);   // Coyote/Buffer, variabler Sprung, Wall-Slide/-Jump, Hazard-Tod
  reset(spawn);
}
export class Gem extends Entity {}          // onTouch → collected, sfx('coin')
export class Door extends Entity {}         // öffnet bei player.hasKey
export class KeyItem extends Entity {}
export class Plate extends Entity {}        // color; emit('plate', {color,on})
export class Barrier extends Entity {}      // color; solide wenn Platte inaktiv
export class Mover extends Entity {}        // path, mode, speed (H/V)
export class Box extends Entity {}          // schiebbar, fällt, hält Platten
export class Mushroom extends Entity {}     // Bounce
export class Teleporter extends Entity {}   // pair, color, cooldown
export class WindZone extends Entity {}     // Aufwind-Spalte
export function spawnFromLevel(level);      // -> { player, objects[], movers[] }
```
Objekte kommunizieren über **Event-Bus** (`ctx.events.emit('plate', {...})`), nicht über Direktreferenzen.

**`level.js`**
```js
export function parseLevel(rows, meta = {});    // -> Level (§5)
export function loadLevelSet(url);              // fetch JSON -> {version,tileSize,levels}
export class Level {
  width; height;              // Tiles
  tiles;                      // Uint8Array (width*height), TileType
  spawn; goal;                // {x,y} Welt-px
  objects;                    // Rohdaten für spawnFromLevel
  meta;                       // { id,name,par,seed,mode,difficulty,winCondition }
  tile(tx,ty); setTile(tx,ty,v); inBounds(tx,ty);
  get pixelWidth(); get pixelHeight();
}
```

**`generator.js`**
```js
export function makeRng(seed);              // mulberry32
export function seedFromString(str);
export function dailySeed(dateStr);         // 'YYYY-MM-DD' -> uint32 (UTC)
export function generateLevel(rng, opts);   // opts: {length,difficulty,guaranteeOneOf,hazardDensity} -> Level
export function generateEndless(runSeed, length); // -> Level
// Determinismus: gleicher seed+opts ⇒ identisch. BFS-Solvability vor Rückgabe (§7.3).
```

**`render.js`**
```js
export class Renderer {
  constructor(canvas);
  resize();                                  // DPR-aware, feste Weltauflösung
  clear();
  drawParallax(camera);                      // Berge, Wolken, Sonne
  drawWorld(level, camera, alpha);           // Gras, Bäume, Berge, Tiles
  drawEntities(entities, camera, alpha);     // interpoliert via prevX/prevY
  drawHUD(hudModel);
}
export class Camera {
  constructor(viewW, viewH); x; y;
  follow(target, level, dt);                 // Lerp + Clamp an Levelgrenzen
  worldToScreen(x,y); screenToWorld(x,y);
}
// Interpolation: render zeichnet lerp(prev, cur, alpha).
```

**`audio.js`**
```js
export class Audio {
  constructor();                             // AudioContext lazy
  unlock();                                  // erster Input
  sfx(name);   // 'jump'|'coin'|'die'|'goal'|'key'|'plate'|'bounce'|'menu'
  setMuted(bool); get muted();
}
// Alle SFX prozedural (Oscillator + Gain-Hüllkurve).
```

**`ui.js`**
```js
export class UI {
  constructor({ root, state, save, onAction });
  // onAction(kind, payload): 'startMode'|'resume'|'restart'|'menu'|'toggleMute'
  showMenu(saveData); showModePicker();
  showPause(); hidePause();
  showLevelComplete({ time, par, best, isNew, gems, deaths, stars });
  showGameOver();
  buildHUD(session);   // -> hudModel { name, mode, time, gems, deaths }
  sync(state);         // via state.onAny
}
// DOM-Overlays für Menüs/Touch; Canvas nur für In-Game-HUD.
```

**`save.js`** (Namespace `brdi_`, ein Objekt)
```js
export function loadSave();                        // -> SaveData (Defaults + Migration)
export function persist(saveData);
export function recordBest(mode, id, timeMs);      // -> { best, isNew }
export function setSetting(key, value);
export function getProgress(mode);
export function unlockNext(mode, id);
// localStorage-Schlüssel: 'brdi_save'
// SaveData:
// { version:1, settings:{ muted, touch },
//   campaign:{ unlocked:[ids], bests:{ '<id>': {timeMs, deaths, stars} } },
//   daily:{ 'YYYY-MM-DD': {done, timeMs, deaths}, streak, lastDay },
//   endless:{ bestLength, bestTimeMs } }
// Alle Zugriffe try/catch-gekapselt (Private-Mode / voller Storage).
```

**`main.js`** (kein Export) verdrahtet alles und hält die Session:
```js
session = { mode, levelIndex, runSeed, level, entities, camera, startTime, elapsed, deaths };
// onAction('startMode',{mode}) baut session, sm.transition(PLAYING,{session}).
```

**Modi-Einhängung (identischer PLAYING-Handler, nur Level-Quelle differiert):**

| Modus | Level-Quelle | Nach Complete | Save |
|---|---|---|---|
| Campaign | `loadLevelSet('assets/levels/campaign.json')`, Index++ | nächstes Level, `unlockNext` | Bestzeit je `id` |
| Daily | `generateLevel(makeRng(dailySeed(today)), {…,difficulty:3})` | zurück ins Menü (1/Tag) | `daily[date]` |
| Endless | `generateEndless(runSeed, length)` | nächster Run-Abschnitt, Diff steigt | `bestLength`, `bestTimeMs` |

### 10.4 State-Maschine

```
        ┌──────────────── MENU ◄─────────────────────────┐
        │  startMode          ▲                           │
        ▼                     │ menu                      │ menu
     PLAYING ──pause──► PAUSED┘                           │
        │  ▲   ◄─resume─                                  │
        │  └──restart──┐                                  │
   reach goal    player dies                              │
        ▼              ▼                                  │
  LEVEL_COMPLETE   GAME_OVER ──────────────────────────────┘
        │  next/menu       │  retry → PLAYING
        ▼
   (next level) → PLAYING  oder  MENU
```

**Übergangstabelle (`TRANSITIONS`):**
```
MENU:            → PLAYING
PLAYING:         → PAUSED, LEVEL_COMPLETE, GAME_OVER, MENU
PAUSED:          → PLAYING, MENU
LEVEL_COMPLETE:  → PLAYING, MENU
GAME_OVER:       → PLAYING, MENU
```

**Enter/Exit-Hooks:**
- `PLAYING.enter`: `session.startTime` beim ersten Betreten setzen (nach Pause **nicht** neu).
- `PAUSED.enter`: HUD-Overlay zeigen; Simulation pausiert.
- `LEVEL_COMPLETE.enter`: `recordBest(mode,id,elapsed)`, Sterne berechnen, `unlockNext`, Sieg-Screen.
- `GAME_OVER.enter`: `audio.sfx('die')` — bei Casual-Respawn i.d.R. übersprungen (Instant-Respawn am Checkpoint innerhalb PLAYING); GAME_OVER nur als expliziter Screen/Retry-Pfad.

**Pause-Semantik:** Loop läuft immer; nur bei `PLAYING` werden Physik/Entities getickt, sonst No-op. Bei `MENU` optional `engine.stop()` zur CPU-Schonung.

### 10.5 Fixed-timestep Game-Loop (Kern)

```js
// engine.js
start() {
  let last = performance.now(), acc = 0;
  const frame = (now) => {
    this._raf = requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000; last = now;
    if (elapsed > this.maxFrame) elapsed = this.maxFrame;   // spiral-of-death Clamp
    acc += elapsed;
    while (acc >= this.dt) { this.update(this.dt); acc -= this.dt; }   // immer exakt DT
    this.render(acc / this.dt);                              // alpha ∈ [0,1)
  };
  this._raf = requestAnimationFrame(frame);
}
```

**Verträge:**
1. `DT = 1/120 s` fest → identisches Verhalten bei 30/60/144 Hz.
2. Accumulator sammelt reale Frame-Zeit, verarbeitet ganze DT-Schritte.
3. `maxFrame`-Clamp (0.25 s) verhindert Nachhol-Flut nach Tab-Wechsel.
4. Interpolation: jede Entity `savePrev()` vor `update`; `render(alpha)` zeichnet `lerp(prev, cur, alpha)`.
5. `input.sample()` einmal pro Frame vor der while-Schleife; `consumeJumpPressed` im ersten Tick konsumiert, Jump-Buffer fängt Sub-DT-Frames.

### 10.6 Update/Render-Pipeline pro Frame (PLAYING)

```
update(DT):
  in = input.sample()
  if state != PLAYING: return
  player.savePrev(); movers.savePrev()
  for m of movers/boxes: m.update(DT, ctx)      // bewegliche Solids ZUERST
  player.update(DT, ctx)                         // Coyote/Buffer/variabler Sprung/Wall
  physics.resolveEntity(player, level, movers, DT)
  handleTriggers(player, objects)                // Gem/Key/Door/Plate/Teleport/Wind/Mushroom
  deathCheck(player, level)                       // Dorn/Wasser/Untergrenze → Respawn
  session.elapsed += DT
  if player touched GOAL   → sm.transition(LEVEL_COMPLETE)

render(alpha):
  renderer.clear()
  renderer.drawParallax(camera)
  camera.follow(player, level, alpha)
  renderer.drawWorld(level, camera, alpha)
  renderer.drawEntities([...objects, player], camera, alpha)
  renderer.drawHUD(ui.buildHUD(session))
  if state != PLAYING: ui-Overlay (DOM)
```

### 10.7 Determinismus (für Daily & Endless)

Fixer Timestep + Accumulator ⇒ identische Läufe. Seed-basierter mulberry32 aus `YYYYMMDD` (UTC) bzw. Endlos-Counter; alle Platzierungen/Timer-Phasen aus dem Seed. Fixe Update-Reihenfolge (§10.6). Respawn setzt veränderte Objekte auf Checkpoint-Snapshot zurück.

### 10.8 Umsetzungs-Reihenfolge

1. `constants` + `engine` + minimal `main`/`render.clear` → stabile Loop.
2. `input` + `level` (Parser) + `render.drawWorld` → statisches Level sichtbar.
3. `physics` + `Player` → laufen/springen/Wall gegen Tilemap.
4. `state` + `ui` (Menü/Pause/Complete) → Kampagnen-Loop spielbar.
5. `save` + Bestzeiten/Sterne + `audio` (Beeps).
6. Interaktive Entities: Gem, Key, Door, Plate/Barrier, Mover, Box, Mushroom, Teleporter, WindZone.
7. `generator` → Daily + Endless über dieselbe Pipeline.
8. Touch-Controls + DPR/Resize + Parallax-/Juice-Politur.

Kein Build; für lokale Entwicklung Dev-Server (wegen `fetch` von `file://`), alternativ Level als JS-Modul (`export default {…}`) einbetten für Doppelklick-Start.