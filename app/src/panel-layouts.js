// Poster layouts: each one turns an area of the canvas into pixel rectangles, one per panel. The area is the whole
// canvas, or the "poster frame" that leaves room for the review strip (top) and the credits footer (bottom).
const round = (r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) });

// Aspect thresholds shared by the layouts: 1920x1080 is "wide", 1080x1350 is "tall", 1080x1080 is neither. They look
// at the whole canvas, not the frame, so switching the furniture on never flips a layout from one arrangement to another.
const WIDE_RATIO = 1.2;
const TALL_RATIO = 1.1;
const isWide = (w, h) => w >= h * WIDE_RATIO;
const isTall = (w, h) => h > w * TALL_RATIO;

/** Outer margin and gutter between panels, in pixels, scaled from the short side. */
export function gutters(w, h) {
  const short = Math.min(w, h);
  return { m: short * 0.022, g: short * 0.014 };
}

/**
 * The part of the canvas the panels may use. With the review strip on, `top` pixels are kept free above the panels;
 * with the details footer on, `bottom` pixels are kept free below them (the gutter margin comes on top of both).
 */
export function posterFrame(w, h, opts = {}) {
  const short = Math.min(w, h);
  const top = opts.reviewOn ? short * 0.05 : 0;
  const bottom = opts.detailsOn ? short * 0.095 : 0;
  return { x: 0, y: top, w, h: h - top - bottom, top, bottom };
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

/** The area inset by the outer margin, plus the gutter, all in pixels. */
function inner(a, w, h) {
  const { m, g } = gutters(w, h);
  return { x: a.x + m, y: a.y + m, w: a.w - 2 * m, h: a.h - 2 * m, g };
}

function heroPlusTwo(a, w, h) {
  const { x, y, w: iw, h: ih, g } = inner(a, w, h);
  if (isWide(w, h)) {
    const [l, r] = splitSpan(x, iw, [62, 38], g);
    const [t, u] = splitSpan(y, ih, [1, 1], g);
    return [
      { x: l.start, y, w: l.size, h: ih },
      { x: r.start, y: t.start, w: r.size, h: t.size },
      { x: r.start, y: u.start, w: r.size, h: u.size },
    ];
  }
  const [top, bottom] = splitSpan(y, ih, [64, 36], g);
  const [l, r] = splitSpan(x, iw, [1, 1], g);
  return [
    { x, y: top.start, w: iw, h: top.size },
    { x: l.start, y: bottom.start, w: l.size, h: bottom.size },
    { x: r.start, y: bottom.start, w: r.size, h: bottom.size },
  ];
}

function twoByTwo(a, w, h) {
  const { x, y, w: iw, h: ih, g } = inner(a, w, h);
  const cols = splitSpan(x, iw, [1, 1], g);
  const rows = splitSpan(y, ih, [1, 1], g);
  return rows.flatMap((row) => cols.map((col) => ({ x: col.start, y: row.start, w: col.size, h: row.size })));
}

function triptych(a, w, h) {
  const { x, y, w: iw, h: ih, g } = inner(a, w, h);
  if (isTall(w, h)) {
    const rows = splitSpan(y, ih, [30, 40, 30], g);
    return rows.map((row) => ({ x, y: row.start, w: iw, h: row.size }));
  }
  const cols = splitSpan(x, iw, [30, 40, 30], g);
  return cols.map((col) => ({ x: col.start, y, w: col.size, h: ih }));
}

function bannerPlusThree(a, w, h) {
  const { x, y, w: iw, h: ih, g } = inner(a, w, h);
  const [banner, strip] = splitSpan(y, ih, [56, 44], g);
  const cols = splitSpan(x, iw, [1, 1, 1], g);
  return [
    { x, y: banner.start, w: iw, h: banner.size },
    ...cols.map((col) => ({ x: col.start, y: strip.start, w: col.size, h: strip.size })),
  ];
}

function splitScreen(a, w, h) {
  const { x, y, w: iw, h: ih, g } = inner(a, w, h);
  if (isWide(w, h)) return splitSpan(x, iw, [1, 1], g).map((c) => ({ x: c.start, y, w: c.size, h: ih }));
  return splitSpan(y, ih, [1, 1], g).map((r) => ({ x, y: r.start, w: iw, h: r.size }));
}

/**
 * A big hero panel (index 0) in the middle with `perSide` small panels on each side (wide and square canvases:
 * columns left and right of the hero) or `perSide` small panels above and below it (tall canvases: rows).
 * Panels 1..perSide are the left / top group, the rest the right / bottom group.
 */
function heroWithSurround(perSide, sideWeight, heroWeight) {
  return (a, w, h) => {
    const { x, y, w: iw, h: ih, g } = inner(a, w, h);
    if (isTall(w, h)) {
      const [top, mid, bottom] = splitSpan(y, ih, [sideWeight, heroWeight, sideWeight], g);
      const row = (band) => splitSpan(x, iw, Array(perSide).fill(1), g).map((c) => ({ x: c.start, y: band.start, w: c.size, h: band.size }));
      return [{ x, y: mid.start, w: iw, h: mid.size }, ...row(top), ...row(bottom)];
    }
    const [left, mid, right] = splitSpan(x, iw, [sideWeight, heroWeight, sideWeight], g);
    const column = (band) => splitSpan(y, ih, Array(perSide).fill(1), g).map((r) => ({ x: band.start, y: r.start, w: band.size, h: r.size }));
    return [{ x: mid.start, y, w: mid.size, h: ih }, ...column(left), ...column(right)];
  };
}

export const LAYOUTS = [
  { id: 'cast-mosaic', label: 'Cast mosaic', count: 7, build: heroWithSurround(3, 23, 54) },
  { id: 'hero-closeup', label: 'Hero close-up', count: 5, build: heroWithSurround(2, 22, 56) },
  { id: 'hero-side', label: 'Hero + 2', count: 3, build: heroPlusTwo },
  { id: 'grid-2x2', label: '2 x 2 grid', count: 4, build: twoByTwo },
  { id: 'triptych', label: 'Triptych', count: 3, build: triptych },
  { id: 'banner-3', label: 'Banner + 3', count: 4, build: bannerPlusThree },
  { id: 'split-screen', label: 'Split', count: 2, build: splitScreen },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

/**
 * Pixel rectangles of the panels of a layout at a given output size (rounded to whole pixels, unknown ids fall back
 * to the first layout). `frame` is an optional posterFrame(); without it the layout uses the whole canvas.
 */
export function panelRects(layoutId, w, h, frame) {
  const area = frame ? { x: frame.x, y: frame.y, w: frame.w, h: frame.h } : { x: 0, y: 0, w, h };
  return layoutById(layoutId).build(area, w, h).map(round);
}

/** The panel rectangles for the editor state at w x h: the layout inside the frame the enabled furniture leaves free. */
export function rectsForState(st, w, h) {
  return panelRects(st.layoutId, w, h, posterFrame(w, h, st));
}
