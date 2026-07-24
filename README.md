# 🌿 Br-di

Ein farbenfrohes **Puzzle-Platformer**-Browserspiel in einer Graswelt mit bunten Bäumen
und begehbaren Bergen. Knifflige Rätsel treffen auf anspruchsvolles Jump'n'Run.

> ⚙️ Dieses Projekt ist im Aufbau. Die Spiel-Engine, Level und Modi werden gerade
> implementiert.

## Geplante Features

- 🏆 **Kampagne** – handgebaute Level mit steigender Schwierigkeit
- 📅 **Rätsel des Tages** – jeden Tag ein neues, festes Level (per Datum-Seed)
- ♾️ **Endlos-Modus** – ein Generator erzeugt immer wieder neue Level
- 🎨 Bunte Graswelt mit Parallax-Bergen, Wolken und wiegenden Bäumen
- ⌨️ 📱 Steuerung per Tastatur **und** Touch (mobil spielbar)
- 💾 Fortschritt & Bestzeiten via `localStorage`

## Technik

Reines **HTML5 Canvas + Vanilla JavaScript** (ES-Module) – keine externen Libraries,
kein Build-Step. Einfach `index.html` im Browser öffnen.

## Steuerung (geplant)

| Taste | Aktion |
|-------|--------|
| ← → / A D | Bewegen |
| Leertaste / W / ↑ | Springen |
| R | Level neu starten |
| P | Pause |
