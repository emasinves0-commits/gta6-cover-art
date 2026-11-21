// Bold poster lettering: wrapped capitals in one of two title styles ("chrome": horizontal sunset stripes clipped to the
// glyphs with a white outline and a deep extrusion; "gradient": a smooth light-to-dark face), a tagline (in a slanted
// chip for chrome) and a scrim that keeps the words readable. drawLettering also reserves room for the script subtitle
// and returns the geometry of the whole block so poster-furniture.js can draw the subtitle and keep tags clear of it.
export const LETTERING_FONT = '"Bebas Neue", Impact, "Arial Black", sans-serif';
const OUTLINE_INK = '#16081f';
const CHIP_INK = 'rgba(10,4,18,0.9)';
const CHIP_GOLD = '#f5b82e';
/** fitCaption stops shrinking below this many pixels, so a very long caption stays legible instead of vanishing. */
const MIN_CAPTION_PX = 14;
/** Horizontal sunset stripes of the chrome face: how many, and how much of each band is the dark seam. */
const STRIPES = 9;
const SEAM = 0.013; // fraction of the whole cap height (one band is 1/STRIPES = 0.11), so about a ninth of each band

function parseHex(hex) {
  const v = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? 'ffffff';
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}

const rgb = (c) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;
const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const toward = (c, target, k) => mixRgb(c, [target, target, target], k);

/** Mixes a hex colour toward white (amount > 0) or black (amount < 0). */
export function shade(hex, amount) {
  return rgb(toward(parseHex(hex), amount >= 0 ? 255 : 0, Math.abs(amount)));
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

/** Darkens the band of the canvas the lettering sits in (frame = the vertical range the panels occupy). */
function drawScrim(ctx, w, frameTop, frameBottom, position, top, bottom) {
  const ink = (a) => `rgba(14,3,30,${a})`;
  let grad;
  if (position === 'top') {
    grad = ctx.createLinearGradient(0, frameTop, 0, bottom + (bottom - top) * 0.7);
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
    grad = ctx.createLinearGradient(0, top - (bottom - top) * 0.8, 0, frameBottom);
    grad.addColorStop(0, ink(0));
    grad.addColorStop(1, ink(0.72));
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, frameTop, w, frameBottom - frameTop);
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

/**
 * The striped face: a hard-stop vertical gradient (so the stripes are clipped to the glyphs by fillText itself, no
 * offscreen canvas). Light cream at the top, the caption colour in the middle, the extrusion colour at the bottom,
 * with a thin dark seam between stripes.
 */
function stripeFace(ctx, baseline, capHeight, colours) {
  const top = toward(parseHex(colours.fill), 255, 0.6);
  const mid = parseHex(colours.fill);
  const low = toward(parseHex(colours.extrusion), 255, 0.12);
  const face = ctx.createLinearGradient(0, baseline - capHeight, 0, baseline);
  for (let i = 0; i < STRIPES; i++) {
    const t = i / (STRIPES - 1);
    const colour = rgb(t < 0.5 ? mixRgb(top, mid, t / 0.5) : mixRgb(mid, low, (t - 0.5) / 0.5));
    const start = i / STRIPES;
    const end = (i + 1) / STRIPES;
    face.addColorStop(start, colour);
    if (i < STRIPES - 1) {
      face.addColorStop(end - SEAM, colour);
      face.addColorStop(end - SEAM, OUTLINE_INK);
      face.addColorStop(end, OUTLINE_INK);
    } else {
      face.addColorStop(1, colour);
    }
  }
  return face;
}

function drawChromeLine(ctx, text, cx, baseline, px, capHeight, colours) {
  const dark = px * 0.2; // dark outer outline (stroke is centred, so half of it shows)
  const white = px * 0.105; // white outline inside it
  const depth = px * 0.11;
  const steps = Math.max(2, Math.min(30, Math.round(depth)));
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.font = `${px}px ${LETTERING_FONT}`;

  // soft drop shadow under the deepest step
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = px * 0.14;
  ctx.shadowOffsetX = px * 0.04;
  ctx.shadowOffsetY = px * 0.1;
  ctx.strokeStyle = OUTLINE_INK;
  ctx.lineWidth = dark;
  ctx.strokeText(text, cx + depth * 0.45, baseline + depth);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // deep extrusion: every step is a dark-edged copy in the extrusion colour, getting darker toward the back
  for (let i = steps; i >= 1; i--) {
    const f = i / steps;
    ctx.strokeStyle = OUTLINE_INK;
    ctx.lineWidth = dark;
    ctx.strokeText(text, cx + depth * f * 0.45, baseline + depth * f);
    ctx.fillStyle = shade(colours.extrusion, -0.5 * f);
    ctx.fillText(text, cx + depth * f * 0.45, baseline + depth * f);
  }

  // dark outer outline, white outline, then the striped face on top
  ctx.strokeStyle = OUTLINE_INK;
  ctx.lineWidth = dark;
  ctx.strokeText(text, cx, baseline);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = white;
  ctx.strokeText(text, cx, baseline);
  ctx.fillStyle = stripeFace(ctx, baseline, capHeight, colours);
  ctx.fillText(text, cx, baseline);
  ctx.restore();
}

/** A small four-point glint, used once on the chrome title. */
function drawGlint(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = r * 0.8;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r : r * 0.16;
    const a = (Math.PI / 4) * i - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Width of `text` drawn with `spacing` extra pixels between characters at the current font. */
function spacedWidth(ctx, text, spacing) {
  const chars = Array.from(text);
  return chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) + spacing * Math.max(0, chars.length - 1);
}

function drawTagline(ctx, text, cx, chipTop, px, chip) {
  ctx.save();
  ctx.font = `${px}px ${LETTERING_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  const spacing = px * 0.2;
  const total = spacedWidth(ctx, text, spacing);
  const chipH = px * 2.1;
  const baseline = chipTop + chipH * 0.5 + px * 0.34;
  let x = cx - total / 2;
  if (chip) {
    const slant = chipH * 0.28;
    const left = x - px * 1.0;
    const right = x + total + px * 1.0;
    ctx.beginPath();
    ctx.moveTo(left + slant, chipTop);
    ctx.lineTo(right + slant, chipTop);
    ctx.lineTo(right, chipTop + chipH);
    ctx.lineTo(left, chipTop + chipH);
    ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = px * 0.5;
    ctx.fillStyle = CHIP_INK;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.strokeStyle = CHIP_GOLD;
    ctx.lineWidth = Math.max(1.2, px * 0.09);
    ctx.stroke();
    ctx.fillStyle = '#fff1d6';
    for (const ch of Array.from(text)) {
      ctx.fillText(ch, x, baseline);
      x += ctx.measureText(ch).width + spacing;
    }
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = px * 0.3;
    ctx.shadowOffsetY = px * 0.1;
    ctx.strokeStyle = OUTLINE_INK;
    ctx.lineWidth = px * 0.18;
    ctx.fillStyle = '#fff1d6';
    for (const ch of Array.from(text)) {
      ctx.strokeText(ch, x, baseline);
      ctx.fillText(ch, x, baseline);
      x += ctx.measureText(ch).width + spacing;
    }
  }
  ctx.restore();
}

/**
 * Draws caption and tagline over the finished (graded) cover and reserves room for the script subtitle.
 * opts: caption, tagline, subtitle (text only, used to reserve space), size, fill, extrusion, position, style
 * ('chrome' | 'gradient'), frame ({y, h}: the vertical band the panels occupy; defaults to the whole canvas).
 * Returns null when there is nothing to draw, else { cx, block: {x, y, w, h}, subtitle: {baseline, px} | null }.
 */
export function drawLettering(ctx, w, h, opts) {
  const caption = (opts.caption ?? '').trim().toUpperCase();
  const tagline = (opts.tagline ?? '').trim().toUpperCase();
  const hasSubtitle = (opts.subtitle ?? '').trim() !== '';
  if (!caption && !tagline && !hasSubtitle) return null;
  const short = Math.min(w, h);
  const chrome = opts.style !== 'gradient';
  const frameTop = opts.frame?.y ?? 0;
  const frameBottom = frameTop + (opts.frame?.h ?? h);
  const maxWidth = w * 0.86;
  const { px, lines } = caption ? fitCaption(ctx, caption, short * 0.19 * opts.size, maxWidth) : { px: 0, lines: [] };
  ctx.font = `${px || 40}px ${LETTERING_FONT}`; // tagline-only cover: px is 0, so measure with any sane size
  const capHeight = px ? ctx.measureText('H').actualBoundingBoxAscent : 0;
  const step = capHeight * 1.2;
  const widest = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));

  // vertical plan, relative to the top of the block
  const captionBlock = lines.length ? capHeight + (lines.length - 1) * step : 0;
  let cursor = captionBlock + (lines.length ? px * (chrome ? 0.12 : 0.08) : 0); // extrusion hangs below the baseline
  const subPx = hasSubtitle ? Math.max(short * 0.04, px * 0.34) : 0;
  let subBase = null;
  if (hasSubtitle) {
    subBase = cursor + subPx * (lines.length ? 0.62 : 0.8); // tucks under the title so the script overlaps its lower edge
    cursor = subBase + subPx * 0.3;
  }
  let tagPx = Math.max(short * 0.024, px * 0.13);
  let chipTop = null;
  if (tagline) {
    ctx.font = `${tagPx}px ${LETTERING_FONT}`;
    const fit = (w * 0.62) / (spacedWidth(ctx, tagline, tagPx * 0.2) + tagPx * 2.4);
    if (fit < 1) tagPx *= fit; // a long tagline shrinks instead of running into the seal
    chipTop = cursor + (cursor > 0 ? tagPx * 0.55 : 0);
    cursor = chipTop + tagPx * 2.1;
  }
  const total = cursor;

  const margin = short * 0.065;
  let top;
  if (opts.position === 'top') top = frameTop + margin;
  else if (opts.position === 'middle') top = frameTop + (frameBottom - frameTop - total) / 2;
  else top = frameBottom - margin - total;

  drawScrim(ctx, w, frameTop, frameBottom, opts.position, top, top + total);
  const cx = w / 2;
  lines.forEach((line, i) => {
    const baseline = top + capHeight + i * step;
    if (chrome) drawChromeLine(ctx, line, cx, baseline, px, capHeight, { fill: opts.fill, extrusion: opts.extrusion });
    else drawCaptionLine(ctx, line, cx, baseline, px, { fill: opts.fill, extrusion: opts.extrusion });
  });
  if (chrome && lines.length) drawGlint(ctx, cx + widest / 2 - px * 0.05, top + capHeight * 0.12, Math.max(10, px * 0.3));
  if (tagline) drawTagline(ctx, tagline, cx, top + chipTop, tagPx, chrome);

  const half = Math.max(widest, tagline ? w * 0.3 : 0) / 2 + px * 0.2;
  return {
    cx,
    block: { x: cx - half, y: top, w: half * 2, h: total },
    subtitle: hasSubtitle ? { baseline: top + subBase, px: subPx } : null,
  };
}
