// Where a photo lands inside a panel: fit mode, zoom and a drag offset (stored as a fraction of the panel size, so
// the same placement holds at preview size and at export size). Also draws the photo and clamps offsets to bounds.
export const FIT_MODES = [
  { id: 'fill-centre', label: 'Fill centre', anchorY: 0.5, whole: false },
  { id: 'fill-top', label: 'Fill top', anchorY: 0, whole: false },
  { id: 'fit', label: 'Fit whole photo', anchorY: 0.5, whole: true },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Pixel size of an image or of the canvas that shrinkIfHuge may hand back (canvases have width/height only). */
export function imageSize(img) {
  return { iw: img.naturalWidth || img.width, ih: img.naturalHeight || img.height };
}

function fitMode(id) {
  return FIT_MODES.find((f) => f.id === id) ?? FIT_MODES[0];
}

/** Allowed offset range (in pixels) along one axis: the photo edge may never leave a gap inside the panel. */
function axisRange(panelLen, photoLen, anchor) {
  if (photoLen <= panelLen) return { lo: 0, hi: 0 };
  const spare = panelLen - photoLen;
  return { lo: spare * (1 - anchor), hi: -spare * anchor };
}

/** Rectangle the photo is drawn into, plus the legal offset ranges as fractions of the panel size. */
export function placePhoto(img, rect, panel) {
  const { iw, ih } = imageSize(img);
  const mode = fitMode(panel.fit);
  const base = mode.whole ? Math.min(rect.w / iw, rect.h / ih) : Math.max(rect.w / iw, rect.h / ih);
  const scale = base * panel.zoom;
  const w = iw * scale;
  const h = ih * scale;
  const rx = axisRange(rect.w, w, 0.5);
  const ry = axisRange(rect.h, h, mode.anchorY);
  const limits = { minX: rx.lo / rect.w, maxX: rx.hi / rect.w, minY: ry.lo / rect.h, maxY: ry.hi / rect.h };
  const ox = clamp(panel.ox, limits.minX, limits.maxX);
  const oy = clamp(panel.oy, limits.minY, limits.maxY);
  return {
    x: rect.x + (rect.w - w) * 0.5 + ox * rect.w,
    y: rect.y + (rect.h - h) * mode.anchorY + oy * rect.h,
    w,
    h,
    limits,
  };
}

/** Pulls the panel's offset back inside the legal range for its current zoom and fit. */
export function clampPanelOffset(panel, rect) {
  if (!panel.img) {
    panel.ox = 0;
    panel.oy = 0;
    return;
  }
  const { limits } = placePhoto(panel.img, rect, panel);
  panel.ox = clamp(panel.ox, limits.minX, limits.maxX);
  panel.oy = clamp(panel.oy, limits.minY, limits.maxY);
}

/** Draws the panel's photo clipped to `rect`; "Fit whole photo" sits on a blurred, darkened copy of itself. */
export function drawPhotoInRect(ctx, rect, panel) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const spot = placePhoto(panel.img, rect, panel);
  if (fitMode(panel.fit).whole) {
    const { iw, ih } = imageSize(panel.img);
    const cover = Math.max(rect.w / iw, rect.h / ih) * 1.15;
    ctx.filter = `blur(${Math.max(2, rect.w * 0.025)}px) brightness(0.7)`;
    ctx.drawImage(panel.img, rect.x + (rect.w - iw * cover) / 2, rect.y + (rect.h - ih * cover) / 2, iw * cover, ih * cover);
    ctx.filter = 'none';
  }
  ctx.drawImage(panel.img, spot.x, spot.y, spot.w, spot.h);
  ctx.restore();
}
