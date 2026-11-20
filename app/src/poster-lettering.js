// Bold poster lettering: wrapped capitals with a dark outline, a coloured extrusion, a drop shadow and a
// light-to-dark fill gradient, plus a small letter-spaced tagline and a scrim that keeps the words readable.
export const LETTERING_FONT = 'Anton, Impact, "Arial Black", sans-serif';
const OUTLINE_INK = '#16081f';
/** fitCaption stops shrinking below this many pixels, so a very long caption stays legible instead of vanishing. */
const MIN_CAPTION_PX = 14;

function parseHex(hex) {
  const v = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? 'ffffff';
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}

/** Mixes a hex colour toward white (amount > 0) or black (amount < 0). */
export function shade(hex, amount) {
  const target = amount >= 0 ? 255 : 0;
  const k = Math.abs(amount);
  const [r, g, b] = parseHex(hex).map((c) => Math.round(c + (target - c) * k));
  return `rgb(${r},${g},${b})`;
}

function wrapWords(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const trial = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(trial).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Chooses the font size and the lines: start from the requested size and shrink until the block fits. */
function fitCaption(ctx, text, startPx, maxWidth) {
  let px = startPx;
  for (let guard = 0; guard < 40; guard++) {
    ctx.font = `${px}px ${LETTERING_FONT}`;
    const lines = wrapWords(ctx, text, maxWidth);
    const widest = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
    if ((lines.length <= 3 && widest <= maxWidth) || px < MIN_CAPTION_PX) return { px, lines };
    px *= 0.93;
  }
  return { px, lines: [text] };
}

function drawScrim(ctx, w, h, position, top, bottom) {
  const ink = (a) => `rgba(14,3,30,${a})`;
  let grad;
  if (position === 'top') {
    grad = ctx.createLinearGradient(0, 0, 0, bottom + (bottom - top) * 0.7);
    grad.addColorStop(0, ink(0.7));
    grad.addColorStop(1, ink(0));
  } else if (position === 'middle') {
    const mid = (top + bottom) / 2;
    const reach = (bottom - top) * 0.9;
    grad = ctx.createLinearGradient(0, mid - reach, 0, mid + reach);
    grad.addColorStop(0, ink(0));
    grad.addColorStop(0.5, ink(0.5));
    grad.addColorStop(1, ink(0));
  } else {
    grad = ctx.createLinearGradient(0, top - (bottom - top) * 0.8, 0, h);
    grad.addColorStop(0, ink(0));
    grad.addColorStop(1, ink(0.78));
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawCaptionLine(ctx, text, cx, baseline, px, colours) {
  const outline = px * 0.1;
  const depth = px * 0.075;
  const steps = Math.max(1, Math.min(18, Math.round(depth)));
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.font = `${px}px ${LETTERING_FONT}`;

  // drop shadow under the deepest extrusion step
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = px * 0.12;
  ctx.shadowOffsetX = px * 0.05;
  ctx.shadowOffsetY = px * 0.09;
  ctx.strokeStyle = OUTLINE_INK;
  ctx.lineWidth = outline + px * 0.035;
  ctx.strokeText(text, cx + depth * 0.7, baseline + depth);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // coloured extrusion, deepest step first, darker toward the back
  for (let i = steps; i >= 1; i--) {
    const f = i / steps;
    const ox = depth * f * 0.7;
    const oy = depth * f;
    ctx.strokeStyle = shade(colours.extrusion, -0.35 * f);
    ctx.lineWidth = outline;
    ctx.strokeText(text, cx + ox, baseline + oy);
    ctx.fillStyle = shade(colours.extrusion, -0.35 * f);
    ctx.fillText(text, cx + ox, baseline + oy);
  }

  // dark outline around the face, then the gradient face and a thin highlight
  ctx.strokeStyle = OUTLINE_INK;
  ctx.lineWidth = outline;
  ctx.strokeText(text, cx, baseline);
  const face = ctx.createLinearGradient(0, baseline - px * 0.75, 0, baseline);
  face.addColorStop(0, shade(colours.fill, 0.45));
  face.addColorStop(0.5, colours.fill);
  face.addColorStop(1, shade(colours.fill, -0.22));
  ctx.fillStyle = face;
  ctx.fillText(text, cx, baseline);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(1, px * 0.012);
  ctx.strokeText(text, cx, baseline);
  ctx.restore();
}

function drawTagline(ctx, text, cx, baseline, px) {
  ctx.save();
  ctx.font = `${px}px ${LETTERING_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  const spacing = px * 0.22;
  const widths = Array.from(text).map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (widths.length - 1);
  let x = cx - total / 2;
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = px * 0.3;
  ctx.shadowOffsetY = px * 0.1;
  ctx.strokeStyle = OUTLINE_INK;
  ctx.lineWidth = px * 0.18;
  ctx.fillStyle = '#fff1d6';
  Array.from(text).forEach((ch, i) => {
    ctx.strokeText(ch, x, baseline);
    ctx.fillText(ch, x, baseline);
    x += widths[i] + spacing;
  });
  ctx.restore();
}

/** Draws caption and tagline over the finished (graded) cover. */
export function drawLettering(ctx, w, h, opts) {
  const caption = (opts.caption ?? '').trim().toUpperCase();
  const tagline = (opts.tagline ?? '').trim().toUpperCase();
  if (!caption && !tagline) return;
  const maxWidth = w * 0.86;
  const { px, lines } = caption ? fitCaption(ctx, caption, Math.min(w, h) * 0.19 * opts.size, maxWidth) : { px: 0, lines: [] };
  ctx.font = `${px || 40}px ${LETTERING_FONT}`; // tagline-only cover: px is 0, so measure with any sane size
  const capHeight = px ? ctx.measureText('H').actualBoundingBoxAscent : 0;
  const step = capHeight * 1.2;
  const tagPx = Math.max(Math.min(w, h) * 0.026, px * 0.17);
  const gap = lines.length ? capHeight * 0.3 : 0;
  const captionBlock = lines.length ? capHeight + (lines.length - 1) * step : 0;
  const total = captionBlock + (tagline ? gap + tagPx : 0);

  const margin = h * 0.07;
  let top;
  if (opts.position === 'top') top = margin;
  else if (opts.position === 'middle') top = (h - total) / 2;
  else top = h - margin - total;

  drawScrim(ctx, w, h, opts.position, top, top + total);
  const cx = w / 2;
  lines.forEach((line, i) => {
    drawCaptionLine(ctx, line, cx, top + capHeight + i * step, px, { fill: opts.fill, extrusion: opts.extrusion });
  });
  if (tagline) drawTagline(ctx, tagline, cx, top + captionBlock + gap + tagPx * 0.9, tagPx);
}
