// Reading photos: the user's files are read on their own machine with FileReader and never leave it.
const LONG_SIDE_LIMIT = 2600;
/** Files above this size are refused up front: decoding them can stall or crash a phone browser tab. */
export const MAX_FILE_BYTES = 40 * 1024 * 1024;

export function loadImageFromUrl(url, label = 'the image') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    // `label` keeps the message readable: a data: URL for a photo can be megabytes long.
    img.onerror = () => reject(new Error(`could not load ${label}`));
    img.src = url;
  });
}

/** Very large photos are scaled down once so every redraw stays fast. */
function shrinkIfHuge(img) {
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  if (long <= LONG_SIDE_LIMIT) return img;
  const k = LONG_SIDE_LIMIT / long;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * k);
  canvas.height = Math.round(img.naturalHeight * k);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Reads one file into a drawable image (downscaled if huge). Rejects with an Error whose message names the file and
 * the problem (empty, too large, unreadable or undecodable), ready to show in the status line.
 */
export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.size) return reject(new Error(`${file.name} is empty`));
    if (file.size > MAX_FILE_BYTES) {
      return reject(new Error(`${file.name} is too large (${Math.round(file.size / 1048576)} MB, limit ${MAX_FILE_BYTES / 1048576} MB)`));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`could not read ${file.name}`));
    reader.onload = () => loadImageFromUrl(reader.result, file.name).then((img) => resolve(shrinkIfHuge(img)), reject);
    reader.readAsDataURL(file);
  });
}

export function onlyImageFiles(fileList) {
  return Array.from(fileList ?? []).filter((f) => f.type.startsWith('image/'));
}
