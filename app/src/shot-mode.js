// Deterministic scenes for screenshots. `?shot=editor` shows the full editor and `?shot=cover` only the cover; the
// other params pick the content: photo (hero sample), caption, tagline, layout, grade, size. Nothing is random and no
// interaction is needed. window.__shotReady is set once the first full paint is done.
import { state, sizeById, EXPORT_SIZES } from './cover-state.js';
import { loadImageFromUrl } from './photo-loading.js';
import { clampPanelOffset, placePhoto } from './photo-placement.js';
import { LAYOUTS, panelRects } from './panel-layouts.js';
import { GRADES } from './color-grades.js';

/** Returns the query value only if it is one of the known ids, so a typo in a shot URL keeps the default. */
const known = (query, key, list) => (list.some((item) => item.id === query.get(key)) ? query.get(key) : null);

// Per-panel placements tuned so every face stays whole: top-anchored fills for the face panels, and face-free detail
// panels (a `focus` point in photo coordinates, centred in the panel) wherever the caption lands on top of a panel.
const FACE = { fit: 'fill-top', zoom: 1, ox: 0, oy: 0 };
const SCENES = {
  pier: [
    { photo: 'pier', ...FACE },
    { photo: 'boulevard', ...FACE },
    { photo: 'pier', fit: 'fill-centre', zoom: 2, focus: [0.74, 0.72] },
    { photo: 'boulevard', fit: 'fill-centre', zoom: 1.8, focus: [0.3, 0.8] },
  ],
  boulevard: [
    { photo: 'boulevard', ...FACE },
    { photo: 'pier', ...FACE },
    { photo: 'boulevard', fit: 'fill-centre', zoom: 1.8, focus: [0.3, 0.8] },
    { photo: 'pier', fit: 'fill-centre', zoom: 2, focus: [0.74, 0.72] },
  ],
  'boulevard-tall': [
    { photo: 'boulevard', ...FACE },
    { photo: 'pier', fit: 'fill-centre', zoom: 2, focus: [0.74, 0.72] },
    { photo: 'boulevard', fit: 'fill-centre', zoom: 1.8, focus: [0.3, 0.8] },
    { photo: 'pier', ...FACE },
  ],
};

/** Offsets that bring the photo point (u, v) to the centre of the panel at the panel's current zoom and fit. */
function focusOffsets(panel, rect, [u, v]) {
  const spot = placePhoto(panel.img, rect, { ...panel, ox: 0, oy: 0 });
  return {
    ox: (rect.x + rect.w / 2 - (spot.x + u * spot.w)) / rect.w,
    oy: (rect.y + rect.h / 2 - (spot.y + v * spot.h)) / rect.h,
  };
}

export async function runShot(query, requestPaint) {
  const shot = query.get('shot');
  document.body.classList.add(shot === 'cover' ? 'shot-cover' : 'shot-editor');
  const scene = SCENES[query.get('photo')] ?? SCENES.pier;
  const photos = {};
  for (const name of new Set(scene.map((p) => p.photo))) photos[name] = await loadImageFromUrl(`samples/${name}.jpg`);

  state.caption = query.get('caption') ?? 'Sunset Heist';
  if (query.has('tagline')) state.tagline = query.get('tagline');
  state.layoutId = known(query, 'layout', LAYOUTS) ?? state.layoutId;
  state.gradeId = known(query, 'grade', GRADES) ?? state.gradeId;
  state.sizeId = known(query, 'size', EXPORT_SIZES) ?? state.sizeId;
  if (['top', 'middle', 'bottom'].includes(query.get('position'))) state.captionPosition = query.get('position');
  const size = sizeById(state.sizeId);
  const rects = panelRects(state.layoutId, size.w, size.h);
  scene.forEach((spec, i) => {
    const panel = state.panels[i];
    Object.assign(panel, { img: photos[spec.photo], name: `${spec.photo}.jpg`, fit: spec.fit, zoom: spec.zoom, ox: spec.ox ?? 0, oy: spec.oy ?? 0 });
    if (rects[i] && spec.focus) Object.assign(panel, focusOffsets(panel, rects[i], spec.focus));
    if (rects[i]) clampPanelOffset(panel, rects[i]);
  });
  state.selected = 0;
  requestPaint();
  if (document.fonts) await document.fonts.ready;
  requestPaint();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
