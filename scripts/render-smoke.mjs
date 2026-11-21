// Browser-free smoke test of the whole render path (Node only): runs renderCover against a recording mock of the
// canvas 2D context and fails on NaN/Infinity arguments, gradient stops out of order, and drawing far outside the
// canvas. It cannot judge looks, only catch arithmetic and state mistakes.
//   node scripts/render-smoke.mjs
import { fileURLToPath } from 'node:url';

const src = (name) => fileURLToPath(new URL(`../app/src/${name}`, import.meta.url));
const problems = [];
let current = '';
const flag = (msg) => problems.push(`${current}: ${msg}`);

/** A context that remembers its transform and font size, validates numbers, and draws nothing. */
function makeCtx(w, h) {
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let fontPx = 10;
  const abs = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const finite = (name, args) => args.forEach((a) => { if (typeof a === 'number' && !Number.isFinite(a)) flag(`${name} got ${a}`); });
  const inside = (name, x, y) => {
    const [ax, ay] = abs(x, y);
    if (ax < -40 || ay < -40 || ax > w + 40 || ay > h + 40) flag(`${name} at (${ax.toFixed(1)}, ${ay.toFixed(1)}) is outside ${w}x${h}`);
  };
  const gradient = (name) => (...args) => {
    finite(name, args);
    let last = -1;
    return { addColorStop(at, colour) { if (at < last || at < 0 || at > 1 || typeof colour !== 'string') flag(`bad colour stop ${at} ${colour}`); last = at; } };
  };
  const target = {
    canvas: { width: w, height: h },
    save() { stack.push([...m]); },
    restore() { m = stack.pop() ?? m; },
    translate(x, y) { finite('translate', [x, y]); m = [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; },
    scale(x, y) { finite('scale', [x, y]); m = [m[0] * x, m[1] * x, m[2] * y, m[3] * y, m[4], m[5]]; },
    rotate(a) {
      finite('rotate', [a]);
      const c = Math.cos(a); const s = Math.sin(a);
      m = [m[0] * c + m[2] * s, m[1] * c + m[3] * s, m[2] * c - m[0] * s, m[3] * c - m[1] * s, m[4], m[5]];
    },
    setTransform(...a) { finite('setTransform', a); m = a.length === 6 ? a : [1, 0, 0, 1, 0, 0]; },
    measureText(text) {
      const width = String(text).length * fontPx * 0.5;
      return { width, actualBoundingBoxAscent: fontPx * 0.72 };
    },
    createLinearGradient: gradient('linearGradient'),
    createRadialGradient: gradient('radialGradient'),
    drawImage() {},
  };
  for (const name of ['fillRect', 'strokeRect', 'clearRect', 'rect']) {
    target[name] = (x, y, rw, rh) => { finite(name, [x, y, rw, rh]); if (name !== 'rect' && name !== 'clearRect') { inside(name, x, y); inside(name, x + rw, y + rh); } };
  }
  for (const name of ['fillText', 'strokeText']) {
    target[name] = (text, x, y) => { finite(name, [x, y]); inside(name, x, y); };
  }
  for (const name of ['moveTo', 'lineTo']) target[name] = (x, y) => { finite(name, [x, y]); inside(name, x, y); };
  target.arc = (x, y, r, a, b) => { finite('arc', [x, y, r, a, b]); if (r < 0) flag('negative arc radius'); inside('arc', x, y); };
  for (const name of ['beginPath', 'closePath', 'fill', 'stroke', 'clip']) target[name] = () => {};
  return new Proxy(target, {
    get(t, key) { return key in t ? t[key] : undefined; },
    set(t, key, value) {
      if (key === 'font') { const hit = /(\d+(?:\.\d+)?)px/.exec(value); if (hit) fontPx = Number(hit[1]); else flag(`font without px: ${value}`); }
      if (typeof value === 'number' && !Number.isFinite(value)) flag(`${String(key)} = ${value}`);
      t[key] = value;
      return true;
    },
  });
}

globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx(1, 1) }), fonts: { load: async () => [] } };

const { renderCover } = await import(src('cover-renderer.js'));
const { state, DEFAULT_LOOK, MAX_PANELS } = await import(src('cover-state.js'));
const { LAYOUTS } = await import(src('panel-layouts.js'));
const { GRADES } = await import(src('color-grades.js'));
const { FIT_MODES } = await import(src('photo-placement.js'));

const fakePhoto = { naturalWidth: 720, naturalHeight: 540, width: 720, height: 540 };
const sizes = [[1920, 1080], [1080, 1350], [1080, 1080]];
let renders = 0;

for (const [w, h] of sizes) {
  const canvas = { width: w, height: h, ctx: makeCtx(w, h), getContext() { return this.ctx; } };
  for (const layout of LAYOUTS) {
    for (const flags of [{}, { reviewOn: false, detailsOn: false, sealOn: false, tagsOn: false }, { titleStyle: 'gradient', captionPosition: 'top' }, { captionPosition: 'middle', subtitle: '' }, { caption: 'A very long caption that wraps onto several lines of the poster', tagline: 'x'.repeat(64), reviewQuote: 'q'.repeat(70) }, { caption: '', tagline: '', subtitle: 'only a script line' }]) {
      Object.assign(state, DEFAULT_LOOK, { layoutId: layout.id, sizeId: `${w}x${h}`, selected: 0 }, flags);
      state.panels.forEach((p, i) => Object.assign(p, { img: i % 3 === 2 ? null : fakePhoto, fit: FIT_MODES[i % FIT_MODES.length].id, zoom: 1 + (i % 2), ox: 0, oy: 0, role: i === 3 ? '-' : i === 4 ? 'THE ONE WITH A VERY LONG ROLE TAG' : '' }));
      current = `${w}x${h} ${layout.id} ${JSON.stringify(flags).slice(0, 50)}`;
      renderCover(canvas, w, h, state, { placeholders: true, highlight: 1 });
      renders++;
    }
  }
  for (const grade of GRADES) {
    Object.assign(state, DEFAULT_LOOK, { gradeId: grade.id });
    current = `${w}x${h} grade ${grade.id}`;
    renderCover(canvas, w, h, state);
    renders++;
  }
}

if (state.panels.length !== MAX_PANELS) problems.push(`state has ${state.panels.length} panels, MAX_PANELS is ${MAX_PANELS}`);
console.log(`${renders} renders, ${problems.length} problem(s)`);
for (const p of [...new Set(problems)].slice(0, 40)) console.log(' -', p);
process.exit(problems.length ? 1 : 0);
