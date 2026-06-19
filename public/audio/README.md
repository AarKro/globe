# Entrance music

Drop audio files here and they replace the synth fallback automatically — no
code change, no rebuild config. A missing file just falls back to the quiet
synth, so it's always safe to leave this empty.

Served from the site root (Vite copies `public/` to the build output), loaded
by `src/audio/entranceAudio.js`.

## Filenames (first that exists wins, per theme)

| Theme     | Tried in order                                |
| --------- | --------------------------------------------- |
| Tokyo     | `ambient-tokyo.mp3` → `ambient.mp3`           |
| New York  | `ambient-newyork.mp3` → `ambient.mp3`         |

- Drop a single **`ambient.mp3`** to use one track for every theme.
- Add per-theme files (`ambient-tokyo.mp3`, …) to override just that theme.
- The track is **looped** and its volume is driven by the experience (silent
  on the street, fades in after the tunnel door shuts, swells toward the café,
  steady inside). So provide a seamless loop at a consistent, full level —
  don't pre-bake fades; the engine handles them.
- `.mp3`, `.ogg`, `.wav`, `.m4a` all decode; `.mp3` is the safest cross-browser
  choice. To use a different extension, update `MUSIC_FILES` in
  `src/audio/entranceAudio.js`.

To add more themes, add an entry to `MUSIC_FILES` in that same file.
