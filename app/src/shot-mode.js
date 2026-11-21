// Deterministic scenes for screenshots. `?shot=editor` shows the full editor and `?shot=cover` only the cover; the
// other params pick the content: photo (which sample leads the cast), caption, tagline, subtitle, layout, grade, size,
// position, title (chrome|gradient), quote, source, seal, billing, and 0/1 switches for review, tags, sealon and
// details (all furniture is ON by default). `focus=details` scrolls the editor's right column to "6 · Poster details".
// Nothing is random and no interaction is needed. window.__shotReady is set once the first full paint is done.
import { state, sizeById, EXPORT_SIZES } from './cover-state.js';
import { loadImageFromUrl } from './photo-loading.js';
import { clampPanelOffset, placePhoto } from './photo-placement.js';
import { LAYOUTS, rectsForState } from './panel-layouts.js';
import { GRADES } from './color-grades.js';

/** Returns the query value only if it is one of the known ids, so a typo in a shot URL keeps the default. */
const known = (query, key, list) => (list.some((item) => item.id === query.get(key)) ? query.get(key) : null);

// Seven placements built from the two sample photos, so every layout (2 to 7 panels) has something different in each
// panel: smart-anchored faces for the big panels and tight close-ups / detail crops (a `focus` point in photo
// coordinates, brought to the panel centre) for the small ones. WOMAN and MAN are the two photos' face crops.
const WOMAN = { photo: 'boulevard', fit: 'fill-smart', zoom: 1 };
const MAN = { photo: 'pier', fit: 'fill-smart', zoom: 1 };
const DETAILS = [
  { photo: 'boulevard', fit: 'fill-centre', zoom: 2.2, focus: [0.2, 0.1] }, // sunset and palms
  { photo: 'pier', fit: 'fill-centre', zoom: 2, focus: [0.82, 0.7] }, // rod and reel
  { photo: 'pier', fit: 'fill-centre', zoom: 1.9, focus: [0.42, 0.2] }, // close-up of the man
  { photo: 'boulevard', fit: 'fill-centre', zoom: 2.2, focus: [0.55, 0.18] }, // close-up of the woman
  { photo: 'boulevard', fit: 'fill-centre', zoom: 2, focus: [0.2, 0.82] }, // wing mirror
];
const SCENES = {
  boulevard: [WOMAN, MAN, ...DETAILS],
  pier: [MAN, WOMAN, DETAILS[1], DETAILS[0], DETAILS[3], DETAILS[2], DETAILS[4]],
  'boulevard-tall': [WOMAN, DETAILS[2], DETAILS[0], DETAILS[1], MAN, DETAILS[3], DETAILS[4]],
};

/** Offsets that bring the photo point (u, v) to the centre of the panel at the panel's current zoom and fit. */
function focusOffsets(panel, rect, [u, v]) {
  const spot = placePhoto(panel.img, rect, { ...panel, ox: 0, oy: 0 });
  return {
    ox: (rect.x + rect.w / 2 - (spot.x + u * spot.w)) / rect.w,
    oy: (rect.y + rect.h / 2 - (spot.y + v * spot.h)) / rect.h,
  };
}

/** `?key=0` switches a boolean state field off, `?key=1` on; anything else keeps the default. */
function applySwitch(query, key, field) {
  if (query.get(key) === '0') state[field] = false;
  else if (query.get(key) === '1') state[field] = true;
}

export async function runShot(query, requestPaint) {
  const shot = query.get('shot');
  document.body.classList.add(shot === 'cover' ? 'shot-cover' : 'shot-editor');
  const scene = SCENES[query.get('photo')] ?? SCENES.boulevard;
  const photos = {};
  for (const name of new Set(scene.map((p) => p.photo))) photos[name] = await loadImageFromUrl(`samples/${name}.jpg`);

  if (query.has('caption')) state.caption = query.get('caption');
  for (const [param, field] of [['tagline', 'tagline'], ['subtitle', 'subtitle'], ['quote', 'reviewQuote'], ['source', 'reviewSource'], ['seal', 'sealText'], ['billing', 'billing']]) {
    if (query.has(param)) state[field] = query.get(param);
  }
  state.layoutId = known(query, 'layout', LAYOUTS) ?? state.layoutId;
  state.gradeId = known(query, 'grade', GRADES) ?? state.gradeId;
  state.sizeId = known(query, 'size', EXPORT_SIZES) ?? state.sizeId;
  if (['top', 'middle', 'bottom'].includes(query.get('position'))) state.captionPosition = query.get('position');
  if (['chrome', 'gradient'].includes(query.get('title'))) state.titleStyle = query.get('title');
  applySwitch(query, 'review', 'reviewOn');
  applySwitch(query, 'tags', 'tagsOn');
  applySwitch(query, 'sealon', 'sealOn');
  applySwitch(query, 'details', 'detailsOn');

  const size = sizeById(state.sizeId);
  const rects = rectsForState(state, size.w, size.h);
  scene.forEach((spec, i) => {
    const panel = state.panels[i];
    Object.assign(panel, { img: photos[spec.photo], name: `${spec.photo}.jpg`, fit: spec.fit, zoom: spec.zoom, ox: 0, oy: 0 });
    if (rects[i] && spec.focus) Object.assign(panel, focusOffsets(panel, rects[i], spec.focus));
    if (rects[i]) clampPanelOffset(panel, rects[i]);
  });
  state.selected = 0;
  requestPaint();
  if (document.fonts) await Promise.all(['100px Anton', '40px Pacifico'].map((f) => document.fonts.load(f)));
  if (document.fonts) await document.fonts.ready;
  requestPaint();
  if (query.get('focus') === 'details') document.getElementById('posterDetails')?.scrollIntoView({ block: 'start' });
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
