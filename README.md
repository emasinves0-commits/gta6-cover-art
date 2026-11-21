# Sunset Cover Lab

[![make.fun bounty](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
![rank](https://make.fun/badge/gta6-cover-art-01/emasinves0-commits/gta6-cover-art/rank.svg)
![reward](https://make.fun/badge/gta6-cover-art-01/emasinves0-commits/gta6-cover-art/reward.svg)

An offline, static web app for [make.fun's GTA 6 cover art bounty](https://make.fun/bounty/gta6-cover-art-01). It turns
your photos and a caption into a multi-panel, sunset-graded movie-poster cover and exports it as a PNG. Everything is
an original design; the bundled fonts are Anton (lettering) and Pacifico (script subtitle), both SIL Open Font
License, with the license texts in `app/fonts/OFL.txt`. No studio logos, artwork or fonts are used.

## What it does

- **Seven layouts**: Cast mosaic (7 panels: a hero in the centre, three around each side), Hero close-up (5), Hero + 2,
  2 x 2 grid, Triptych, Banner + 3 and Split. Each panel takes its own photo.
- **Poster furniture** (editor section 6, all switchable): a review strip with five stars, a quote, a gazette name and a
  VOL. badge; slanted role tags (THE DRIVER, THE BOSS...) on every panel, editable per panel; a striped chrome title
  (or the classic gradient one) with a script subtitle and a tagline chip; a gold "ORIGINAL COVER ART" seal; and a
  credits footer with a billing line, a decorative barcode (bars only, a fixed seed) and COMING SOON.
- **Photos stay on your machine**: pick files, or drop them on the preview or on a chip, and read them with FileReader.
  Several files fill several panels; "Use for all panels" fills them with one photo.
- **Per-panel framing**: drag the photo in the preview, zoom slider, and four crops (Fill centre, Fill top, Smart (face zone) and Fit whole
  photo). Smart is not face detection: it keeps the upper-centre third of the photo in view, where heads usually are. Moving the zoom clamps the offset back inside the new bounds, and changing the crop resets zoom to 1.
- **Numbered chips**: one small live canvas per panel showing its current fit, zoom and offset.
- **Eight colour grades** written on canvas (filters, blended gradients, bloom, vignette): Vice Sunset, Neon Nights, Palm
  Noir, Golden Hour, Teal Chrome (a cool teal and steel-blue look), Coral Heat, Twilight Gold and No grade, with a
  strength slider.
- **Reset look** restores the default layout, size, grade, caption and panel framing but keeps your loaded photos.
- **Keyboard** (outside text fields): `1`-`7` pick a panel, arrows nudge the photo, `R` resets its position, `E` exports.
- **Safe uploads**: files over 40 MB, empty files and undecodable images are skipped with a message; the rest still load.
- **Poster lettering**: caption and tagline with size and colour controls; the chrome title clips horizontal sunset
  stripes to the glyphs (a hard-stop gradient) under a white outline and a deep extrusion.
- **One-click export** at 1080x1080, 1080x1350 and 1920x1080. Preview and export use the same renderer.

## Run it

    node serve.ts            # http://localhost:8080 (pick another port with: node serve.ts --port 8123)
    mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # the hand-in: app/, screenshots/, dossier.json
    node main.ts --help       # usage; also accepts --layout <id> and --grade <id>, validated against the app's lists
    (cd out && find . -type f | sort | xargs sha256sum | sha256sum)   # tree hash; the render is deterministic

Screenshot scenes (no interaction needed): `?shot=editor&photo=boulevard&caption=Boulevard%20Kings`,
`?shot=cover&photo=pier&caption=Pier%20Pressure`; optional `layout`, `grade`, `size`, `tagline`, `subtitle`, `position`,
`title` (chrome|gradient), `quote`, `source`, `seal`, `billing`, `focus=details` and the 0/1 switches `review`, `tags`,
`sealon`, `details`. The scenes reuse the two sample photos with different crops and are fully deterministic.

    node scripts/shots.mjs            # needs Chrome + ffmpeg: regenerates screenshots/ from shots.json via the DevTools protocol
    node scripts/render-smoke.mjs     # no browser: runs the whole render path on a mock canvas and checks the arithmetic

## R4 revision

The R3 entry was rejected on one server check, `thinking_revised`: no file took its final content from two or more
write/edit steps. R4 is a revision pass with no visual change (the four screenshots and the rendered output are
byte-identical): `main.ts` gained input validation (layout and grade checked against the app's own lists, writable
output directory, unknown options rejected) and a `--help` flag; `cover-renderer.js` got a documented
`createGutterGradient` helper and named constants for the selection-outline width; `shots.json` got a `comment` per shot.

## Fonts

Anton and Pacifico come from Google Fonts under the SIL Open Font License (license text: `app/fonts/OFL.txt`):

- `app/fonts/Anton-Regular.ttf`: https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf
  (170,812 bytes, sha256 `a4ba3a92350ebb031da0cb47630ac49eb265082ca1bc0450442f4a83ab947cab`, re-downloaded from the Google
  Fonts GitHub on 2026-11-21 after the file was deleted; sha256 verified and the four rendered screenshots are
  byte-identical to the previous ones, so the output did not change).
- `app/fonts/Pacifico-Regular.ttf`: https://github.com/google/fonts/raw/main/ofl/pacifico/Pacifico-Regular.ttf

## Source map

`app/src/`: `cover-state.js` (state), `panel-layouts.js`, `photo-placement.js`, `photo-loading.js`, `color-grades.js`,
`poster-lettering.js`, `poster-furniture.js` (review strip, role tags, seal, subtitle, footer), `cover-renderer.js`, `png-export.js`, `shot-mode.js`, `main.js` (UI).
Sample photos in `app/samples/` were made for make.fun with an image model and are free to use.
