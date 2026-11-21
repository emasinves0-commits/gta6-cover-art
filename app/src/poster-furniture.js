// Poster furniture: everything that makes the cover read as a movie poster rather than a photo collage. Review strip
// (stars, quote, gazette, VOL. badge), role tags on the panels, a gold seal, the script subtitle, and the credits
// footer (billing, decorative barcode, COMING SOON). All of it is drawn on canvas after the lettering, so it sits on
// top of the grade, and every shape is clamped to the canvas. Nothing here is random: the barcode comes from a fixed
// seed, so exports are byte-identical from run to run.
import { LETTERING_FONT } from './poster-lettering.js';
import { gutters } from './panel-layouts.js';

export const SCRIPT_FONT = 'Pacifico, "Brush Script MT", "Segoe Script", cursive';
const GOLD = '#f5b82e';
const GOLD_LIGHT = '#ffe08a';
const INK = '#0e0618';
const CREAM = '#fff1d6';

/** Role tags handed out by panel index until the user types their own. */
export const ROLE_DEFAULTS = ['THE DRIVER', 'THE BOSS', 'THE FIXER', 'THE LOOKOUT', 'THE RIDER', 'THE MECHANIC', 'THE CAPTAIN'];

/** The tag text for panel `index`: the user's own text, the automatic tag when empty, nothing for a lone "-". */
export function roleFor(panel, index) {
  const own = (panel?.role ?? '').trim();
  if (own === '-') return '';
  return (own || ROLE_DEFAULTS[index % ROLE_DEFAULTS.length]).toUpperCase();
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Width of text drawn character by character with `spacing` extra pixels, at the current font. */
function spacedWidth(ctx, text, spacing) {
  const chars = Array.from(text);
  return chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) + spacing * Math.max(0, chars.length - 1);
}

/** Draws text left-aligned starting at x, one character at a time so the letter spacing works in every browser. */
function drawSpaced(ctx, text, x, y, spacing) {
  ctx.textAlign = 'left';
  let cursor = x;
  for (const ch of Array.from(text)) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
}

/** Parallelogram path (leaning right) with its lower-left corner at (x, y + h). */
function slantPath(ctx, x, y, w, h, slant) {
  ctx.beginPath();
  ctx.moveTo(x + slant, y);
  ctx.lineTo(x + w + slant, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
}

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// ---- panel frames --------------------------------------------------------------------------------------------
/** A thin warm-gold keyline around every panel (drawn before the lettering so the title covers it). */
export function drawPanelFrames(ctx, rects) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,214,120,0.75)';
  for (const r of rects) {
    ctx.lineWidth = Math.max(1, Math.min(r.w, r.h) * 0.006);
    const half = ctx.lineWidth / 2;
    ctx.strokeRect(r.x + half, r.y + half, r.w - ctx.lineWidth, r.h - ctx.lineWidth);
  }
  ctx.restore();
}

// ---- script subtitle -----------------------------------------------------------------------------------------
function drawScriptSubtitle(ctx, w, text, spot, cx) {
  let px = spot.px;
  ctx.font = `${px}px ${SCRIPT_FONT}`;
  const limit = w * 0.62;
  const measured = ctx.measureText(text).width;
  if (measured > limit) {
    px *= limit / measured;
    ctx.font = `${px}px ${SCRIPT_FONT}`;
  }
  ctx.save();
  ctx.translate(cx, spot.baseline);
  ctx.rotate(-0.045);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#ff2d7a';
  ctx.shadowBlur = px * 0.45;
  ctx.strokeStyle = '#ff4fa3';
  ctx.lineWidth = px * 0.24;
  ctx.strokeText(text, 0, 0);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.strokeStyle = INK;
  ctx.lineWidth = px * 0.12;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = '#fff4fa';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// ---- review strip --------------------------------------------------------------------------------------------
function drawReviewStrip(ctx, w, h, st, frame) {
  const { m } = gutters(w, h);
  const band = frame.top + m; // the strip lives in the band above the panels
  const cy = band / 2;
  const edge = Math.max(m * 1.2, 8);
  const quoteRaw = (st.reviewQuote ?? '').trim().replace(/^["“”]+|["“”]+$/g, '');
  const quote = quoteRaw ? `“${quoteRaw}”` : '';
  const source = (st.reviewSource ?? '').trim() ? `— ${st.reviewSource.trim().toUpperCase()}` : '';
  const badge = (st.badgeText ?? '').trim().toUpperCase();

  // sizes at scale 1, then one scale factor makes everything fit between the edges
  const base = clamp(band * 0.42, 9, 30);
  const starR = base * 0.5;
  const starsW = 5 * starR * 2 + 4 * starR * 0.45;
  ctx.font = `italic 700 ${base}px Georgia, "Times New Roman", serif`;
  const quoteW = quote ? ctx.measureText(quote).width : 0;
  ctx.font = `${base * 0.72}px ${LETTERING_FONT}`;
  const sourceW = source ? spacedWidth(ctx, source, base * 0.1) : 0;
  const badgeSize = base * 0.95;
  ctx.font = `${badgeSize}px ${LETTERING_FONT}`;
  const badgeW = badge ? spacedWidth(ctx, badge, badgeSize * 0.1) + badgeSize * 1.5 : 0;
  const gap = base * 0.8;
  const need = starsW + (quote ? gap + quoteW : 0) + (source ? gap * 0.7 + sourceW : 0) + (badge ? gap + badgeW : 0);
  const k = Math.min(1, (w - 2 * edge) / need);

  ctx.save();
  ctx.translate(edge, cy);
  ctx.scale(k, k);
  let x = 0;
  const r = starR;
  ctx.fillStyle = GOLD;
  ctx.shadowColor = 'rgba(245,184,46,0.6)';
  ctx.shadowBlur = r * 0.6;
  for (let i = 0; i < 5; i++) {
    starPath(ctx, x + r, 0, r);
    ctx.fill();
    x += r * 2.45;
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  x = starsW;
  ctx.textBaseline = 'middle';
  if (quote) {
    x += gap;
    ctx.font = `italic 700 ${base}px Georgia, "Times New Roman", serif`;
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'left';
    ctx.fillText(quote, x, 0);
    x += quoteW;
  }
  if (source) {
    x += gap * 0.7;
    ctx.font = `${base * 0.72}px ${LETTERING_FONT}`;
    ctx.fillStyle = GOLD_LIGHT;
    drawSpaced(ctx, source, x, 0, base * 0.1);
  }
  ctx.restore();

  if (badge) {
    // the badge is right-aligned on its own so it stays pinned to the corner whatever the quote length
    const bh = band * 0.5 * k;
    const bw = badgeW * k;
    const bx = w - edge - bw;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = bh * 0.3;
    slantPath(ctx, bx - bh * 0.2, cy - bh / 2, bw, bh, bh * 0.25);
    const fill = ctx.createLinearGradient(0, cy - bh / 2, 0, cy + bh / 2);
    fill.addColorStop(0, GOLD_LIGHT);
    fill.addColorStop(1, GOLD);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.fillStyle = INK;
    ctx.font = `${badgeSize * k}px ${LETTERING_FONT}`;
    ctx.textBaseline = 'middle';
    const textW = spacedWidth(ctx, badge, badgeSize * k * 0.1);
    drawSpaced(ctx, badge, bx - bh * 0.2 + (bw + bh * 0.25 - textW) / 2, cy + bh * 0.04, badgeSize * k * 0.1);
    ctx.restore();
  }
}

// ---- role tags -----------------------------------------------------------------------------------------------
/** Slanted black chip with a gold left bar; goes bottom-left of the panel, or top-left if the title block is in the way. */
function drawRoleTag(ctx, rect, text, short, avoid) {
  let px = Math.min(short * 0.021, rect.h * 0.11, rect.w * 0.1);
  if (px < 8) return;
  ctx.font = `${px}px ${LETTERING_FONT}`;
  const room = rect.w * 0.92;
  const spacing = () => px * 0.1;
  const widthAt = () => spacedWidth(ctx, text, spacing()) + px * 1.9;
  if (widthAt() > room) {
    px *= room / widthAt();
    ctx.font = `${px}px ${LETTERING_FONT}`;
    if (px < 8) return;
  }
  const tagH = px * 1.75;
  const tagW = widthAt();
  const pad = Math.max(4, short * 0.008);
  const slant = tagH * 0.3;
  const x = rect.x + pad;
  let y = rect.y + rect.h - pad - tagH;
  const box = (yy) => ({ x, y: yy, w: tagW + slant, h: tagH });
  if (avoid.some((a) => overlaps(box(y), a))) {
    const top = rect.y + pad;
    if (!avoid.some((a) => overlaps(box(top), a))) y = top;
  }

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = tagH * 0.35;
  slantPath(ctx, x, y, tagW, tagH, slant);
  ctx.fillStyle = 'rgba(8,3,14,0.93)';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  const bar = Math.max(3, px * 0.3);
  ctx.beginPath(); // gold bar following the chip's slanted left edge
  ctx.moveTo(x + slant, y);
  ctx.lineTo(x + slant + bar, y);
  ctx.lineTo(x + bar, y + tagH);
  ctx.lineTo(x, y + tagH);
  ctx.closePath();
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  drawSpaced(ctx, text, x + bar + px * 0.75 + slant * 0.45, y + tagH * 0.54, spacing());
  ctx.restore();
}

// ---- seal ----------------------------------------------------------------------------------------------------
function sealLines(text) {
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const count = Math.min(3, words.length);
  const lines = [];
  let from = 0;
  for (let i = 0; i < count; i++) {
    const to = from + Math.ceil((words.length - from) / (count - i));
    lines.push(words.slice(from, to).join(' '));
    from = to;
  }
  return lines;
}

function drawSeal(ctx, cx, cy, r, text) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.14);
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = r * 0.18;
  ctx.shadowOffsetY = r * 0.06;
  ctx.beginPath();
  const points = 26;
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.88;
    const a = (Math.PI / points) * i;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  const gold = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  gold.addColorStop(0, '#fff0a8');
  gold.addColorStop(0.55, GOLD);
  gold.addColorStop(1, '#b8780e');
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.strokeStyle = '#8a560a';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = '#14091f';
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.035);
  ctx.strokeStyle = GOLD_LIGHT;
  ctx.stroke();

  const lines = sealLines(text);
  if (lines.length) {
    let px = r * 0.3;
    ctx.font = `${px}px ${LETTERING_FONT}`;
    const widest = Math.max(...lines.map((l) => spacedWidth(ctx, l, px * 0.06)));
    const room = r * 1.2;
    if (widest > room) px *= room / widest;
    ctx.font = `${px}px ${LETTERING_FONT}`;
    const lead = px * 1.12;
    const first = -((lines.length - 1) * lead) / 2 - r * 0.08;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => {
      const lw = spacedWidth(ctx, line, px * 0.06);
      drawSpaced(ctx, line, -lw / 2, first + i * lead, px * 0.06);
    });
    ctx.fillStyle = GOLD;
    for (let i = -1; i <= 1; i++) {
      starPath(ctx, i * r * 0.2, r * 0.5, r * 0.07);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---- footer: billing, barcode, COMING SOON -------------------------------------------------------------------
/** Bars and gaps from a fixed linear-congruential seed: decorative only, never a real product code. */
function barcodeBars(count) {
  let seed = 20261121;
  const bars = [];
  for (let i = 0; i < count; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    bars.push(1 + (seed >>> 24) % 3);
  }
  return bars;
}

function drawBarcode(ctx, x, y, bw, bh) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,248,232,0.94)';
  ctx.fillRect(x, y, bw, bh);
  const bars = barcodeBars(34);
  const units = bars.reduce((a, b) => a + b, 0) * 2;
  const unit = (bw * 0.88) / units;
  let cursor = x + bw * 0.06;
  ctx.fillStyle = INK;
  bars.forEach((n) => {
    ctx.fillRect(cursor, y + bh * 0.1, n * unit, bh * 0.8);
    cursor += n * unit * 2;
  });
  ctx.restore();
}

function drawFooter(ctx, w, h, st, frame) {
  const { m } = gutters(w, h);
  const short = Math.min(w, h);
  const footerH = frame.bottom + m;
  const footerTop = h - footerH;
  const cy = footerTop + footerH * 0.5 + m * 0.1;
  const edge = Math.max(m * 1.2, 8);
  ctx.save();
  ctx.textBaseline = 'middle';

  // barcode on the right, COMING SOON on the left
  const barH = footerH * 0.52;
  const barW = Math.min(footerH * 1.15, w * 0.14);
  const barX = w - edge - barW;
  drawBarcode(ctx, barX, cy - barH / 2, barW, barH);

  const soonPx = Math.min(footerH * 0.36, short * 0.034);
  ctx.font = `${soonPx}px ${LETTERING_FONT}`;
  const soonText = 'COMING SOON';
  const soonW = spacedWidth(ctx, soonText, soonPx * 0.14);
  ctx.shadowColor = '#ff2d7a';
  ctx.shadowBlur = soonPx * 0.7;
  ctx.fillStyle = '#ffd1ea';
  drawSpaced(ctx, soonText, edge, cy, soonPx * 0.14);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // billing block between them, centred in the free span, over a gold hairline
  const left = edge + soonW + footerH * 0.35;
  const right = barX - footerH * 0.35;
  const span = right - left;
  const lines = [(st.billing ?? '').trim().toUpperCase(), 'SHOT ON YOUR OWN CAMERA · GRADED BY HAND'].filter(Boolean);
  if (span > 80 && lines.length) {
    let px = Math.min(footerH * 0.19, short * 0.017);
    ctx.font = `${px}px ${LETTERING_FONT}`;
    const widest = Math.max(...lines.map((l) => spacedWidth(ctx, l, px * 0.12)));
    if (widest > span) px *= span / widest;
    if (px >= 6) {
      ctx.font = `${px}px ${LETTERING_FONT}`;
      const lead = px * 1.5;
      const mid = left + span / 2;
      const top = cy - ((lines.length - 1) * lead) / 2;
      ctx.fillStyle = 'rgba(255,241,214,0.88)';
      lines.forEach((line, i) => {
        const lw = spacedWidth(ctx, line, px * 0.12);
        drawSpaced(ctx, line, mid - lw / 2, top + i * lead, px * 0.12);
      });
      ctx.strokeStyle = 'rgba(245,184,46,0.5)';
      ctx.lineWidth = Math.max(1, px * 0.08);
      const ruleW = Math.min(span, widest * Math.min(1, span / widest) + px * 2);
      ctx.beginPath();
      ctx.moveTo(mid - ruleW / 2, top - lead * 0.9);
      ctx.lineTo(mid + ruleW / 2, top - lead * 0.9);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Draws the poster furniture the state asks for. `rects` are the panel rectangles, `frame` the posterFrame the layout
 * was built in and `lettering` the object drawLettering returned (or null).
 */
export function drawFurniture(ctx, w, h, st, rects, frame, lettering) {
  const short = Math.min(w, h);
  const { m } = gutters(w, h);
  const footerTop = h - frame.bottom - m; // where the panels end (and the footer begins)

  if (st.detailsOn) drawFooter(ctx, w, h, st, frame);
  if (st.reviewOn) drawReviewStrip(ctx, w, h, st, frame);
  if (lettering?.subtitle) drawScriptSubtitle(ctx, w, st.subtitle.trim(), lettering.subtitle, lettering.cx);

  const r = short * 0.075;
  const seal = st.sealOn && (st.sealText ?? '').trim()
    ? { cx: w - m * 1.6 - r, cy: footerTop - r * 0.85, r }
    : null;
  if (st.tagsOn) {
    const avoid = [];
    if (lettering) avoid.push(lettering.block);
    if (seal) avoid.push({ x: seal.cx - r, y: seal.cy - r, w: r * 2, h: r * 2 });
    rects.forEach((rect, i) => {
      const text = roleFor(st.panels[i], i);
      if (text) drawRoleTag(ctx, rect, text, short, avoid);
    });
  }
  if (seal) drawSeal(ctx, seal.cx, seal.cy, seal.r, st.sealText);
}
