// Draws the whole cover onto a canvas of any size: gutters, panels, colour grade, panel keylines, lettering, poster
// furniture. The live preview and the PNG export both call renderCover, so what you see is what you export. Also
// draws the small per-panel chips.
import { posterFrame, rectsForState } from './panel-layouts.js';
import { drawPhotoInRect } from './photo-placement.js';
import { applyGrade } from './color-grades.js';
import { drawLettering } from './poster-lettering.js';
import { drawFurniture, drawPanelFrames } from './poster-furniture.js';

const GUTTER_TOP = '#2a0f3f';
const GUTTER_BOTTOM = '#0d0416';
const HIGHLIGHT_INK = '#2de2e6'; // preview-only outline of the selected panel; same cyan as --cyan in style.css

function drawEmptyPanel(ctx, rect, index, showHint) {
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  grad.addColorStop(0, '#3b1b5c');
  grad.addColorStop(1, '#10061c');
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  if (!showHint) return;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const px = Math.min(rect.w, rect.h) * 0.3;
  ctx.font = `${px}px Anton, Impact, sans-serif`;
  ctx.fillText(String(index + 1), rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.font = `${px * 0.2}px sans-serif`;
  ctx.fillText('drop a photo', rect.x + rect.w / 2, rect.y + rect.h / 2 + px * 0.62);
}

/**
 * @param {HTMLCanvasElement} canvas  resized to w x h
 * @param {object} st  the editor state
 * @param {{placeholders?: boolean, highlight?: number}} [opts]  preview-only extras
 */
export function renderCover(canvas, w, h, st, opts = {}) {
  // Assigning canvas.width/height clears the canvas and resets its state, so only do it when the size really changes.
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  const ground = ctx.createLinearGradient(0, 0, 0, h);
  ground.addColorStop(0, GUTTER_TOP);
  ground.addColorStop(1, GUTTER_BOTTOM);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, w, h);

  const frame = posterFrame(w, h, st);
  const rects = rectsForState(st, w, h);
  rects.forEach((rect, i) => {
    const panel = st.panels[i];
    if (panel?.img) drawPhotoInRect(ctx, rect, panel);
    else drawEmptyPanel(ctx, rect, i, opts.placeholders);
  });

  applyGrade(ctx, w, h, st.gradeId, st.gradeStrength);
  drawPanelFrames(ctx, rects);
  const lettering = drawLettering(ctx, w, h, {
    caption: st.caption,
    tagline: st.tagline,
    subtitle: st.subtitle,
    size: st.captionSize,
    fill: st.captionColor,
    extrusion: st.extrusionColor,
    position: st.captionPosition,
    style: st.titleStyle,
    frame,
  });
  drawFurniture(ctx, w, h, st, rects, frame, lettering);

  if (opts.highlight != null && rects[opts.highlight]) {
    const r = rects[opts.highlight];
    ctx.save();
    ctx.strokeStyle = HIGHLIGHT_INK;
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.006);
    ctx.strokeRect(r.x + ctx.lineWidth / 2, r.y + ctx.lineWidth / 2, r.w - ctx.lineWidth, r.h - ctx.lineWidth);
    ctx.restore();
  }
}

/** A chip is a small live canvas showing one panel's photo with its current fit, zoom and offset. */
export function renderPanelChip(canvas, panel) {
  const ctx = canvas.getContext('2d');
  const rect = { x: 0, y: 0, w: canvas.width, h: canvas.height };
  ctx.clearRect(0, 0, rect.w, rect.h);
  if (panel.img) {
    drawPhotoInRect(ctx, rect, panel);
  } else {
    ctx.fillStyle = '#2a1442';
    ctx.fillRect(0, 0, rect.w, rect.h);
  }
}
