// The single source of truth for the editor: size, layout, grade, caption and one record per panel.
export const MAX_PANELS = 4;

export const EXPORT_SIZES = [
  { id: '1080x1080', w: 1080, h: 1080, label: 'Square' },
  { id: '1080x1350', w: 1080, h: 1350, label: 'Portrait' },
  { id: '1920x1080', w: 1920, h: 1080, label: 'Landscape' },
];

export function createPanel() {
  return { img: null, name: '', fit: 'fill-centre', zoom: 1, ox: 0, oy: 0 };
}

export const state = {
  sizeId: '1920x1080',
  layoutId: 'hero-side',
  gradeId: 'vice',
  gradeStrength: 0.85,
  caption: 'Sunset Heist',
  tagline: 'Two weeks. One boulevard. No witnesses.',
  captionSize: 1,
  captionColor: '#ffe45c',
  extrusionColor: '#ff2d7a',
  captionPosition: 'bottom',
  selected: 0,
  panels: Array.from({ length: MAX_PANELS }, createPanel),
};

const listeners = new Set();

/** Registers a callback run after every state change; returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  for (const fn of listeners) fn(state);
}

export function sizeById(id) {
  return EXPORT_SIZES.find((s) => s.id === id) ?? EXPORT_SIZES[2];
}
