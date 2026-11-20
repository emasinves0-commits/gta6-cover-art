# Sunset Cover Lab

[![make.fun bounty](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
![rank](https://make.fun/badge/gta6-cover-art-01/emasinves0-commits/gta6-cover-art/rank.svg)
![reward](https://make.fun/badge/gta6-cover-art-01/emasinves0-commits/gta6-cover-art/reward.svg)

An offline, static web app for [make.fun's GTA 6 cover art bounty](https://make.fun/bounty/gta6-cover-art-01). It turns
your photos and a caption into a multi-panel, sunset-graded poster cover and exports it as a PNG. Everything is an
original design; the only bundled font is Anton (SIL Open Font License, `app/fonts/OFL.txt`).

## What it does

- **Five layouts**: Hero + 2, 2 x 2 grid, Triptych, Banner + 3 and Split. Each panel takes its own photo.
- **Photos stay on your machine**: pick files, or drop them on the preview or on a chip, and read them with FileReader.
  Several files fill several panels; "Use for all panels" fills them with one photo.
- **Per-panel framing**: drag the photo in the preview, zoom slider, and three crops (Fill centre, Fill top, Fit whole
  photo). Moving the zoom clamps the offset back inside the new bounds, and changing the crop resets zoom to 1.
- **Numbered chips**: one small live canvas per panel showing its current fit, zoom and offset.
- **Six colour grades** written on canvas (filters, blended gradients, bloom, vignette): Vice Sunset, Neon Nights, Palm
  Noir, Golden Hour, Teal Chrome (a cool teal and steel-blue look) and No grade, with a strength slider.
- **Reset look** restores the default layout, size, grade, caption and panel framing but keeps your loaded photos.
- **Keyboard** (outside text fields): `1`-`4` pick a panel, arrows nudge the photo, `R` resets its position, `E` exports.
- **Safe uploads**: files over 40 MB, empty files and undecodable images are skipped with a message; the rest still load.
- **Poster lettering**: caption and tagline with size and colour controls, dark outline, coloured extrusion, drop shadow.
- **One-click export** at 1080x1080, 1080x1350 and 1920x1080. Preview and export use the same renderer.

## Run it

    node serve.ts            # http://localhost:8080 (pick another port with: node serve.ts --port 8123)
    mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # the hand-in: app/, screenshots/, dossier.json

Screenshot scenes (no interaction needed): `?shot=editor&photo=boulevard&caption=Boulevard%20Queen`,
`?shot=cover&photo=pier&caption=Sunset%20Heist`; optional `layout`, `grade`, `size`, `tagline`, `position`.

## Source map

`app/src/`: `cover-state.js` (state), `panel-layouts.js`, `photo-placement.js`, `photo-loading.js`, `color-grades.js`,
`poster-lettering.js`, `cover-renderer.js`, `png-export.js`, `shot-mode.js`, `main.js` (UI).
Sample photos in `app/samples/` were made for make.fun with an image model and are free to use.
