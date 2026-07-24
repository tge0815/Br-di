# Br-di 🌱

Ein farbenfroher **Rätsel-Platformer** in einer bunten Graswelt mit begehbaren
Hügeln, bunten Bäumen und anspruchsvollem Jump'n'Run. Reines HTML5 + Vanilla
JavaScript – **keine Installation, kein Build**. Einfach `index.html` öffnen und
losspielen.

![Br-di](https://img.shields.io/badge/HTML5-Canvas-blue) ![No build](https://img.shields.io/badge/Build-keiner-brightgreen)

## Spielen

- **Im Browser:** `index.html` per Doppelklick öffnen – fertig.
- **Alternativ** (empfohlen für saubere Darstellung), lokalen Server starten:
  ```bash
  python3 -m http.server 8000
  # dann http://localhost:8000 öffnen
  ```
- **Mit Docker** 🐳 (portabel auf jedem Rechner/Server, schlanker nginx-Container):
  ```bash
  # Variante A: Docker Compose (empfohlen)
  docker compose up -d          # -> http://localhost:8080

  # Variante B: pur mit Docker
  docker build -t brdi .
  docker run -d -p 8080:80 --name brdi brdi
  ```
  Stoppen: `docker compose down` bzw. `docker rm -f brdi`.

## Modi

| Modus | Beschreibung |
|-------|--------------|
| 🌱 **Kampagne** | 10 handgebaute Level mit steigender Schwierigkeit – jedes verbindet eine Rätsel-Idee mit einer Geschicklichkeits-Herausforderung. |
| 📅 **Rätsel des Tages** | Jeden Tag ein neues, für alle identisches Level (Seed = Datum). Mit Serien-Zähler. |
| ♾️ **Endlos** | Unendlich verkettete, mit der Distanz härter werdende Level – für regelmäßigen Nachschub. |

## Steuerung

| Aktion | Tastatur | Touch |
|--------|----------|-------|
| Laufen | ← → / A D | ◀ ▶ |
| Springen (halten = höher) | Leertaste / W / ↑ | ⬆ Button |
| Durch Blätter fallen | ↓ + Sprung | — |
| Aktion (Dash/greifen) | J / Shift / E | ✦ Button |
| Neustart | R | — |
| Pause | P / Esc | — |

Feinheiten für faires, griffiges Movement: **Coyote-Time**, **Jump-Buffer**,
**variable Sprunghöhe**, **Wandsprung**.

## Mechaniken

Schlüssel & Tore, farbige Druckplatten & Barrieren (rot/grün/blau),
schiebbare Kisten, bewegliche Plattformen, Sprungpilze, Einweg-Blätter,
Aufwind-Zonen, Teleporter, Dornen, Wasser und sammelbare Edelsteine
(3-Sterne-Wertung pro Level: geschafft · schnell/ohne Tod · alle Edelsteine).

## Technik

- **Vanilla JS** (klassische Skripte im `BR`-Namespace), Canvas-2D, keine externen Abhängigkeiten.
- **Fixed-Timestep-Physik** (1/120 s) mit Interpolation → identisches Verhalten bei 30/60/144 Hz.
- **Fortschritt & Bestzeiten** in `localStorage`.
- Voll **prozedurale Grafik & Sound** (keine Asset-Dateien) – bunte „Knuddel-Vektor"-Optik.

## Projektstruktur

```
index.html            # Einstiegspunkt, lädt alle Skripte
css/style.css         # UI, Menüs, Touch-Overlay
js/
  constants.js        # Kachelgröße, Physik, Farbpalette, Enums
  utils.js            # Mathe, Easing, PRNG, Event-Bus
  input.js            # Tastatur + Touch → InputState
  level.js            # ASCII-Grid → Level (Tilemap + Objekte)
  entities.js         # Spieler + interaktive Objekte
  physics.js          # AABB-Kollision (Tiles + bewegliche Solids)
  campaign.js         # Die 10 Kampagnen-Level (Daten)
  generator.js        # Seeded Endlos-/Tages-Generator
  particles.js        # Partikel-Effekte
  render.js           # Kamera, Parallax, Welt, Entities, HUD
  ui.js               # Menüs, Overlays, Touch-Buttons
  audio.js            # Prozedurale WebAudio-SFX
  engine.js           # Fixed-Timestep Game-Loop
  main.js             # Verdrahtung, Spiellogik, Zustandsmaschine
GAME_DESIGN.md        # Vollständige Design-Spezifikation
```

## Design-Dokument

Die komplette, verbindliche Spezifikation (Mechaniken, Physik-Konstanten,
Level-Format, Farbpalette, Architektur) liegt in [`GAME_DESIGN.md`](GAME_DESIGN.md).

---

Viel Spaß beim Knobeln und Springen! 🎉
