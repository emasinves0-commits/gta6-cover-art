// The single source of truth for the editor: size, layout, grade, caption, poster furniture and one record per panel.
// MAX_PANELS is the largest layout (cast-mosaic has seven panels); every layout uses the first `count` records.
export const MAX_PANELS = 7;

export const EXPORT_SIZES = [
  { id: '1080x1080', w: 1080, h: 1080, label: 'Square' },
  { id: '1080x1350', w: 1080, h: 1350, label: 'Portrait' },
  { id: '1920x1080', w: 1920, h: 1080, label: 'Landscape' },
];

/** `role` is the panel's role tag; an empty string means "use the automatic tag for this panel index". */
export function createPanel() {
  return { img: null, name: '', fit: 'fill-centre', zoom: 1, ox: 0, oy: 0, role: '' };
}

/** Everything except the photos: what "Reset look" restores. */
export const DEFAULT_LOOK = {
  sizeId: '1920x1080',
  layoutId: 'cast-mosaic',
  gradeId: 'vice',
  gradeStrength: 0.85,
  caption: 'Boulevard Kings',
  tagline: 'Five friends. One boulevard. No witnesses.',
  captionSize: 1,
  captionColor: '#ffe45c',
  extrusionColor: '#ff2d7a',
  captionPosition: 'bottom',
  // poster furniture (poster-furniture.js)
  titleStyle: 'chrome', // 'chrome' (striped) or 'gradient'
  subtitle: 'a coast of our own',
  reviewOn: true,
  reviewQuote: 'A neon-soaked joyride you will replay twice',
  reviewSource: 'The Marina Telegraph',
  badgeText: 'VOL. 1',
  tagsOn: true,
  sealOn: true,
  sealText: 'Original cover art',
  detailsOn: true, // billing block + barcode + COMING SOON footer, one group
  billing: 'A Sunset Pictures production · Starring you',
};

export const state = {
  ...DEFAULT_LOOK,
  selected: 0,
  panels: Array.from({ length: MAX_PANELS }, createPanel),
};

/** Restores the default look, role tags and every panel's placement, but keeps the loaded photos. */
export function resetLook() {
  Object.assign(state, DEFAULT_LOOK, { selected: 0 });
  for (const panel of state.panels) Object.assign(panel, { fit: 'fill-centre', zoom: 1, ox: 0, oy: 0, role: '' });
}

const listeners = new Set();

/** Registers a callback run after every state change; returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Tells every subscriber that the state changed (callers mutate `state` directly, then call this). */
export function notify() {
  for (const fn of listeners) fn(state);
}

export function sizeById(id) {
  return EXPORT_SIZES.find((s) => s.id === id) ?? EXPORT_SIZES[2];
}
