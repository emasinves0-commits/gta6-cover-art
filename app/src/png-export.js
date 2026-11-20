// One-click export: renders the cover to an offscreen canvas at the exact size and downloads it as a PNG.
import { renderCover } from './cover-renderer.js';
import { sizeById } from './cover-state.js';

export async function renderToBlob(st, sizeId) {
  const size = sizeById(sizeId);
  if (document.fonts) await document.fonts.load('100px Anton');
  const canvas = document.createElement('canvas');
  renderCover(canvas, size.w, size.h, st);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  // toBlob yields null when the browser cannot allocate or encode a canvas this big (low-memory phones).
  if (!blob) throw new Error(`the browser could not encode a ${size.w} × ${size.h} PNG`);
  return { blob, width: canvas.width, height: canvas.height, name: `cover-${size.id}.png` };
}

/** Renders and downloads the PNG; resolves with the render result and rejects if the render or encode failed. */
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
