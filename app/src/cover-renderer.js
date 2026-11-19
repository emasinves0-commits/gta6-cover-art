// Draws the whole cover onto a canvas of any size: gutters, panels, colour grade, lettering. The live preview and the
// PNG export both call renderCover, so what you see is what you export. Also draws the small per-panel chips.
import { panelRects } from './panel-layouts.js';
import { drawPhotoInRect } from './photo-placement.js';
import { applyGrade } from './color-grades.js';
import { drawLettering } from './poster-lettering.js';

const GUTTER_INK = '#14071c';

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
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = GUTTER_INK;
  ctx.fillRect(0, 0, w, h);

  const rects = panelRects(st.layoutId, w, h);
  rects.forEach((rect, i) => {
    const panel = st.panels[i];
    if (panel.img) drawPhotoInRect(ctx, rect, panel);
    else drawEmptyPanel(ctx, rect, i, opts.placeholders);
  });

  applyGrade(ctx, w, h, st.gradeId, st.gradeStrength);
  drawLettering(ctx, w, h, {
    caption: st.caption,
    tagline: st.tagline,
    size: st.captionSize,
    fill: st.captionColor,
    extrusion: st.extrusionColor,
    position: st.captionPosition,
  });

  if (opts.highlight != null && rects[opts.highlight]) {
    const r = rects[opts.highlight];
    ctx.save();
    ctx.strokeStyle = '#2de2e6';
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
