// Colour grades written from canvas filters, blended gradient overlays, bloom and a vignette. `strength` (0..1)
// scales every part of a grade, so 0 is the untouched photo and 1 the full look. Eight looks: none, Vice Sunset, Neon
// Nights, Palm Noir, Golden Hour, Teal Chrome, Coral Heat and Twilight Gold. "none" has no `filter`, which applyGrade treats as "leave alone".
const NEUTRAL = { saturate: 1, contrast: 1, brightness: 1, sepia: 0, grayscale: 0, 'hue-rotate': 0 };

export const GRADES = [
  { id: 'none', label: 'No grade', swatch: 'linear-gradient(135deg,#777,#bbb)' },
  {
    id: 'vice',
    label: 'Vice Sunset',
    swatch: 'linear-gradient(180deg,#ffb347,#ff4f9a 60%,#5b2a86)',
    filter: { saturate: 1.3, contrast: 1.1, brightness: 1.02 },
    overlays: [
      { angle: 180, stops: [[0, '#ffb23c'], [0.55, '#ff4f8b'], [1, '#6a2c91']], mode: 'soft-light', alpha: 0.95 },
      { angle: 180, stops: [[0, '#ff9a3c'], [1, '#c2185b']], mode: 'overlay', alpha: 0.28 },
    ],
    bloom: 0.28,
    vignette: 0.5,
  },
  {
    id: 'neon',
    label: 'Neon Nights',
    swatch: 'linear-gradient(90deg,#ff2bd6,#2de2e6)',
    filter: { saturate: 1.35, contrast: 1.18, brightness: 0.95 },
    overlays: [
      { angle: 90, stops: [[0, '#ff1fc8'], [0.5, '#7b2cff'], [1, '#12e3f0']], mode: 'soft-light', alpha: 1 },
      { angle: 90, stops: [[0, '#ff1fc8'], [1, '#12e3f0']], mode: 'overlay', alpha: 0.3 },
      { angle: 180, stops: [[0, 'rgba(10,0,50,0)'], [1, '#1a0540']], mode: 'multiply', alpha: 0.5 },
    ],
    bloom: 0.4,
    vignette: 0.55,
  },
  {
    id: 'noir',
    label: 'Palm Noir',
    swatch: 'linear-gradient(180deg,#f08a3c,#3a1e4d 60%,#0a0612)',
    filter: { saturate: 0.85, contrast: 1.4, brightness: 0.9, grayscale: 0.35 },
    overlays: [
      { angle: 180, stops: [[0, '#ff8a3d'], [0.5, '#a23a6c'], [1, '#1b0b33']], mode: 'soft-light', alpha: 0.9 },
      { angle: 180, stops: [[0, 'rgba(255,140,60,0)'], [1, '#12061f']], mode: 'multiply', alpha: 0.55 },
    ],
    bloom: 0.12,
    vignette: 0.8,
  },
  {
    id: 'golden',
    label: 'Golden Hour',
    swatch: 'linear-gradient(180deg,#ffe08a,#ffa63c 60%,#d9622b)',
    filter: { saturate: 1.25, contrast: 1.06, brightness: 1.06, sepia: 0.22 },
    overlays: [
      { angle: 200, stops: [[0, '#fff0a8'], [0.5, '#ffb347'], [1, '#e0642a']], mode: 'soft-light', alpha: 0.9 },
      { angle: 200, stops: [[0, '#ffd27a'], [1, '#ff8a3c']], mode: 'overlay', alpha: 0.2 },
    ],
    bloom: 0.35,
    vignette: 0.35,
  },
  {
    id: 'chrome',
    label: 'Teal Chrome',
    swatch: 'linear-gradient(180deg,#8ef5ee,#2a7fb8 60%,#0d1f3d)',
    filter: { saturate: 1.05, contrast: 1.25, brightness: 0.98, 'hue-rotate': -25 },
    overlays: [
      { angle: 180, stops: [[0, '#6ff0ec'], [0.5, '#2f86d0'], [1, '#14224a']], mode: 'soft-light', alpha: 1 },
      { angle: 180, stops: [[0, '#19d3d6'], [1, '#1f4fa8']], mode: 'overlay', alpha: 0.55 },
      { angle: 180, stops: [[0, 'rgba(20,200,220,0)'], [1, '#0a1230']], mode: 'multiply', alpha: 0.45 },
    ],
    bloom: 0.25,
    vignette: 0.6,
  },
  {
    id: 'coral',
    label: 'Coral Heat',
    swatch: 'linear-gradient(180deg,#ffd0a0,#ff6a4d 55%,#b81d5a)',
    filter: { saturate: 1.4, contrast: 1.12, brightness: 1.04 },
    overlays: [
      { angle: 160, stops: [[0, '#ffd0a0'], [0.5, '#ff6a4d'], [1, '#b81d5a']], mode: 'soft-light', alpha: 0.95 },
      { angle: 180, stops: [[0, '#ff8a5c'], [1, '#e0245e']], mode: 'overlay', alpha: 0.3 },
    ],
    bloom: 0.3,
    vignette: 0.45,
  },
  {
    id: 'twilight',
    label: 'Twilight Gold',
    swatch: 'linear-gradient(180deg,#3a2a8a,#c46a7a 50%,#ffc15a)',
    filter: { saturate: 1.15, contrast: 1.18, brightness: 0.97, sepia: 0.12 },
    overlays: [
      { angle: 180, stops: [[0, '#3a2a8a'], [0.45, '#c46a7a'], [0.8, '#ffc15a'], [1, '#ffd98a']], mode: 'soft-light', alpha: 1 },
      { angle: 180, stops: [[0, '#2a1a6a'], [1, '#f0a030']], mode: 'overlay', alpha: 0.3 },
    ],
    bloom: 0.3,
    vignette: 0.55,
  },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

function filterText(filter, strength) {
  return Object.entries(filter)
    .map(([name, target]) => {
      const from = NEUTRAL[name];
      const unit = name === 'hue-rotate' ? 'deg' : '';
      const value = Math.round((from + (target - from) * strength) * 1000) / 1000; // no 1.0499999999999998 in the filter string
      return `${name}(${value}${unit})`;
    })
    .join(' ');
}

/** Linear gradient running across the whole canvas at `angle` degrees (180 = top to bottom). */
function angledGradient(ctx, w, h, angle, stops) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const grad = ctx.createLinearGradient(w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half);
  for (const [at, colour] of stops) grad.addColorStop(at, colour);
  return grad;
}

let scratch = null;
function scratchCanvas(w, h) {
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== w || scratch.height !== h) {
    scratch.width = w;
    scratch.height = h;
  }
  return scratch;
}

/** Grades everything already drawn on ctx's canvas (which must be w x h). */
export function applyGrade(ctx, w, h, gradeId, strength) {
  const grade = gradeById(gradeId);
  if (!grade.filter || strength <= 0) return;
  const tmp = scratchCanvas(w, h);
  const tctx = tmp.getContext('2d');
  tctx.clearRect(0, 0, w, h);
  tctx.filter = filterText(grade.filter, strength);
  tctx.drawImage(ctx.canvas, 0, 0, w, h);
  tctx.filter = 'none';
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(tmp, 0, 0);

  for (const overlay of grade.overlays) {
    ctx.globalCompositeOperation = overlay.mode;
    ctx.globalAlpha = overlay.alpha * strength;
    ctx.fillStyle = angledGradient(ctx, w, h, overlay.angle, overlay.stops);
    ctx.fillRect(0, 0, w, h);
  }

  if (grade.bloom) {
    tctx.clearRect(0, 0, w, h);
    tctx.filter = `blur(${Math.max(4, Math.min(w, h) * 0.018)}px) brightness(1.25) saturate(1.2)`;
    tctx.drawImage(ctx.canvas, 0, 0, w, h);
    tctx.filter = 'none';
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = grade.bloom * strength;
    ctx.drawImage(tmp, 0, 0);
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.hypot(w, h) * 0.58);
  vignette.addColorStop(0, 'rgba(10,0,25,0)');
  vignette.addColorStop(1, `rgba(10,0,25,${grade.vignette * strength})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
