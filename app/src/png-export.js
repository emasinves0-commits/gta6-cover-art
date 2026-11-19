// One-click export: renders the cover to an offscreen canvas at the exact size and downloads it as a PNG.
import { renderCover } from './cover-renderer.js';
import { sizeById } from './cover-state.js';

export async function renderToBlob(st, sizeId) {
  const size = sizeById(sizeId);
  if (document.fonts) await document.fonts.load('100px Anton');
  const canvas = document.createElement('canvas');
  renderCover(canvas, size.w, size.h, st);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return { blob, width: canvas.width, height: canvas.height, name: `cover-${size.id}.png` };
}

export async function exportCover(st, sizeId) {
  const result = await renderToBlob(st, sizeId);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(result.blob);
  link.download = result.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  return result;
}
