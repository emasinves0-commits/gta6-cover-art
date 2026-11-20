// Poster layouts: each one turns an output size into pixel rectangles, one per panel.
const round = (r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) });

// Aspect thresholds shared by the layouts: 1920x1080 is "wide", 1080x1350 is "tall", 1080x1080 is neither.
const WIDE_RATIO = 1.2;
const TALL_RATIO = 1.1;
const isWide = (w, h) => w >= h * WIDE_RATIO;
const isTall = (w, h) => h > w * TALL_RATIO;

/** Outer margin and gutter between panels, in pixels, scaled from the short side. */
export function gutters(w, h) {
  const short = Math.min(w, h);
  return { m: short * 0.022, g: short * 0.014 };
}

/** Splits a span into parts proportional to `weights`, leaving `gap` between them. */
function splitSpan(start, length, weights, gap) {
  const total = weights.reduce((a, b) => a + b, 0);
  const free = length - gap * (weights.length - 1);
  let pos = start;
  return weights.map((wt) => {
    const part = { start: pos, size: (free * wt) / total };
    pos += part.size + gap;
    return part;
  });
}

function heroPlusTwo(w, h) {
  const { m, g } = gutters(w, h);
  const iw = w - 2 * m;
  const ih = h - 2 * m;
  if (isWide(w, h)) {
    const [a, b] = splitSpan(m, iw, [62, 38], g);
    const [t, u] = splitSpan(m, ih, [1, 1], g);
    return [
      { x: a.start, y: m, w: a.size, h: ih },
      { x: b.start, y: t.start, w: b.size, h: t.size },
      { x: b.start, y: u.start, w: b.size, h: u.size },
    ];
  }
  const [top, bottom] = splitSpan(m, ih, [64, 36], g);
  const [l, r] = splitSpan(m, iw, [1, 1], g);
  return [
    { x: m, y: top.start, w: iw, h: top.size },
    { x: l.start, y: bottom.start, w: l.size, h: bottom.size },
    { x: r.start, y: bottom.start, w: r.size, h: bottom.size },
  ];
}

function twoByTwo(w, h) {
  const { m, g } = gutters(w, h);
  const cols = splitSpan(m, w - 2 * m, [1, 1], g);
  const rows = splitSpan(m, h - 2 * m, [1, 1], g);
  return rows.flatMap((row) => cols.map((col) => ({ x: col.start, y: row.start, w: col.size, h: row.size })));
}

function triptych(w, h) {
  const { m, g } = gutters(w, h);
  if (isTall(w, h)) {
    const rows = splitSpan(m, h - 2 * m, [30, 40, 30], g);
    return rows.map((row) => ({ x: m, y: row.start, w: w - 2 * m, h: row.size }));
  }
  const cols = splitSpan(m, w - 2 * m, [30, 40, 30], g);
  return cols.map((col) => ({ x: col.start, y: m, w: col.size, h: h - 2 * m }));
}

function bannerPlusThree(w, h) {
  const { m, g } = gutters(w, h);
  const [banner, strip] = splitSpan(m, h - 2 * m, [56, 44], g);
  const cols = splitSpan(m, w - 2 * m, [1, 1, 1], g);
  return [
    { x: m, y: banner.start, w: w - 2 * m, h: banner.size },
    ...cols.map((col) => ({ x: col.start, y: strip.start, w: col.size, h: strip.size })),
  ];
}

function splitScreen(w, h) {
  const { m, g } = gutters(w, h);
  if (isWide(w, h)) {
    return splitSpan(m, w - 2 * m, [1, 1], g).map((c) => ({ x: c.start, y: m, w: c.size, h: h - 2 * m }));
  }
  return splitSpan(m, h - 2 * m, [1, 1], g).map((r) => ({ x: m, y: r.start, w: w - 2 * m, h: r.size }));
}

export const LAYOUTS = [
  { id: 'hero-side', label: 'Hero + 2', count: 3, build: heroPlusTwo },
  { id: 'grid-2x2', label: '2 x 2 grid', count: 4, build: twoByTwo },
  { id: 'triptych', label: 'Triptych', count: 3, build: triptych },
  { id: 'banner-3', label: 'Banner + 3', count: 4, build: bannerPlusThree },
  { id: 'split-screen', label: 'Split', count: 2, build: splitScreen },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

/** Pixel rectangles of the panels of a layout at a given output size (rounded to whole pixels, unknown ids fall back to the first layout). */
export function panelRects(layoutId, w, h) {
  return layoutById(layoutId).build(w, h).map(round);
}
