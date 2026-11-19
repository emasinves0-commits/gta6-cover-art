// Reading photos: the user's files are read on their own machine with FileReader and never leave it.
const LONG_SIDE_LIMIT = 2600;

export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
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

export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`could not read ${file.name}`));
    reader.onload = () => loadImageFromUrl(reader.result).then((img) => resolve(shrinkIfHuge(img)), reject);
    reader.readAsDataURL(file);
  });
}

export function onlyImageFiles(fileList) {
  return Array.from(fileList ?? []).filter((f) => f.type.startsWith('image/'));
}
