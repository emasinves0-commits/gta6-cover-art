// The editor UI: builds the pickers, wires every control to the shared state, repaints the live preview and the
// panel chips, handles drag-to-reposition and photo drops, and runs the export.
import { state, subscribe, notify, resetLook, EXPORT_SIZES, sizeById } from './cover-state.js';
import { LAYOUTS, layoutById, panelRects, rectsForState } from './panel-layouts.js';
import { FIT_MODES, clampPanelOffset } from './photo-placement.js';
import { GRADES } from './color-grades.js';
import { renderCover, renderPanelChip } from './cover-renderer.js';
import { loadImageFromFile, onlyImageFiles } from './photo-loading.js';
import { exportCover } from './png-export.js';
import { runShot } from './shot-mode.js';
import { roleFor } from './poster-furniture.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const PREVIEW_LONG_SIDE = 1100;
const POSITIONS = [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']];
const TITLE_STYLES = [['chrome', 'Chrome (striped)'], ['gradient', 'Gradient']];
const FONTS = ['100px Anton', '40px Pacifico'];

const panelCount = () => layoutById(state.layoutId).count;
const previewSize = () => {
  const { w, h } = sizeById(state.sizeId);
  const k = Math.min(1, PREVIEW_LONG_SIDE / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
};
const rectOfPanel = (index, w, h) => rectsForState(state, w, h)[index];

/** Pulls every panel's offset back inside bounds for the current layout, size, zoom and fit. */
function clampAllPanels() {
  const { w, h } = sizeById(state.sizeId);
  rectsForState(state, w, h).forEach((rect, i) => clampPanelOffset(state.panels[i], rect));
}

/** After anything that moves the panel rectangles (layout, size, furniture toggles): re-clamp, rebuild the chips, repaint. */
function layoutChanged() {
  clampAllPanels();
  buildChips();
  notify();
}

function makeButton(text, pressed, onClick, extraClass) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.setAttribute('aria-pressed', String(pressed));
  if (extraClass) b.className = extraClass;
  b.addEventListener('click', onClick);
  return b;
}

// ---- pickers -------------------------------------------------------------------------------------------------
function buildLayoutPicker() {
  const host = $('layoutPicker');
  host.replaceChildren();
  for (const layout of LAYOUTS) {
    const b = makeButton('', layout.id === state.layoutId, () => {
      state.layoutId = layout.id;
      state.selected = Math.min(state.selected, layout.count - 1);
      layoutChanged();
    });
    b.title = `${layout.label} (${layout.count} panels)`;
    b.dataset.layout = layout.id;
    const mini = document.createElement('div');
    mini.className = 'mini';
    for (const r of panelRects(layout.id, 400, 300)) {
      const i = document.createElement('i');
      Object.assign(i.style, { left: `${r.x / 4}%`, top: `${r.y / 3}%`, width: `${r.w / 4}%`, height: `${r.h / 3}%` });
      mini.appendChild(i);
    }
    b.append(mini, layout.label);
    host.appendChild(b);
  }
}

function buildSimplePickers() {
  $('fitPicker').replaceChildren(...FIT_MODES.map((f) => makeButton(f.label, false, () => {
    const panel = state.panels[state.selected];
    panel.fit = f.id;
    panel.zoom = 1; // changing the crop resets the zoom
    clampAllPanels();
    notify();
  })));
  $('fitPicker').childNodes.forEach((b, i) => { b.dataset.fit = FIT_MODES[i].id; });
  $('sizePicker').replaceChildren(...EXPORT_SIZES.map((s) => {
    const b = makeButton(`${s.label} ${s.id.replace('x', '×')}`, false, () => {
      state.sizeId = s.id;
      layoutChanged();
    });
    b.dataset.size = s.id;
    return b;
  }));
  $('gradePicker').replaceChildren(...GRADES.map((g) => {
    const b = makeButton('', false, () => { state.gradeId = g.id; notify(); });
    b.dataset.grade = g.id;
    const sw = document.createElement('span');
    sw.className = 'sw';
    sw.style.background = g.swatch;
    b.append(sw, g.label);
    return b;
  }));
  $('positionPicker').replaceChildren(...POSITIONS.map(([id, label]) => {
    const b = makeButton(label, false, () => { state.captionPosition = id; notify(); });
    b.dataset.position = id;
    return b;
  }));
  $('titleStylePicker').replaceChildren(...TITLE_STYLES.map(([id, label]) => {
    const b = makeButton(label, false, () => { state.titleStyle = id; notify(); });
    b.dataset.style = id;
    return b;
  }));
}

// ---- chips ---------------------------------------------------------------------------------------------------
function buildChips() {
  const host = $('chipStrip');
  host.replaceChildren();
  const { w, h } = sizeById(state.sizeId);
  const rects = rectsForState(state, w, h);
  rects.forEach((rect, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.index = String(i);
    chip.title = `Panel ${i + 1}: click to select, drop a photo to fill`;
    const c = document.createElement('canvas');
    const ratio = rect.w / rect.h;
    c.height = 120;
    c.width = Math.max(60, Math.min(260, Math.round(120 * ratio)));
    c.style.height = '56px';
    c.style.width = `${Math.round((56 * c.width) / c.height)}px`;
    const num = document.createElement('b');
    num.textContent = String(i + 1);
    chip.append(c, num);
    chip.addEventListener('click', () => { state.selected = i; notify(); });
    chip.addEventListener('dragover', (e) => e.preventDefault());
    chip.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      assignPhotos(e.dataTransfer.files, i);
    });
    host.appendChild(chip);
  });
}

// ---- repaint -------------------------------------------------------------------------------------------------
let paintQueued = false;
function requestPaint() {
  if (paintQueued) return;
  paintQueued = true;
  requestAnimationFrame(() => { paintQueued = false; paintNow(); });
}

function paintNow() {
  const { w, h } = previewSize();
  renderCover(canvas, w, h, state, { placeholders: true, highlight: state.selected });
  document.querySelectorAll('.chip').forEach((chip) => {
    const i = Number(chip.dataset.index);
    renderPanelChip(chip.querySelector('canvas'), state.panels[i]);
    chip.setAttribute('aria-pressed', String(i === state.selected));
  });
  syncControls();
}

function syncControls() {
  const panel = state.panels[state.selected];
  $('panelLabel').textContent = String(state.selected + 1);
  $('zoom').value = String(panel.zoom);
  $('zoomOut').textContent = `${panel.zoom.toFixed(2)}x`;
  $('strength').value = String(state.gradeStrength);
  $('strengthOut').textContent = `${Math.round(state.gradeStrength * 100)}%`;
  $('captionSize').value = String(state.captionSize);
  $('captionSizeOut').textContent = `${Math.round(state.captionSize * 100)}%`;
  for (const b of $('layoutPicker').children) b.setAttribute('aria-pressed', String(b.dataset.layout === state.layoutId));
  for (const b of $('fitPicker').children) b.setAttribute('aria-pressed', String(b.dataset.fit === panel.fit));
  for (const b of $('sizePicker').children) b.setAttribute('aria-pressed', String(b.dataset.size === state.sizeId));
  for (const b of $('gradePicker').children) b.setAttribute('aria-pressed', String(b.dataset.grade === state.gradeId));
  for (const b of $('positionPicker').children) b.setAttribute('aria-pressed', String(b.dataset.position === state.captionPosition));
  for (const b of $('titleStylePicker').children) b.setAttribute('aria-pressed', String(b.dataset.style === state.titleStyle));
  for (const id of TEXT_FIELDS) if (document.activeElement !== $(id)) $(id).value = state[id];
  for (const [id, key] of TOGGLES) $(id).checked = state[key];
  $('rolePanel').textContent = String(state.selected + 1);
  $('role').placeholder = roleFor({ role: '' }, state.selected);
  if (document.activeElement !== $('role')) $('role').value = panel.role;
  $('captionColor').value = state.captionColor;
  $('extrusionColor').value = state.extrusionColor;
}

// ---- photos --------------------------------------------------------------------------------------------------
/** Loads files and gives the first to panel `start`, the next to the following panels (wrapping inside the layout). */
async function assignPhotos(fileList, start = state.selected) {
  const files = onlyImageFiles(fileList);
  if (!files.length) { $('status').textContent = 'Those files are not images.'; return; }
  const count = panelCount();
  const failures = [];
  let loaded = 0;
  $('status').textContent = 'Loading…';
  // A file that cannot be decoded is skipped without using up a panel slot, so one bad file never blocks the rest.
  for (const file of files) {
    if (loaded >= count) break;
    try {
      const img = await loadImageFromFile(file);
      Object.assign(state.panels[(start + loaded) % count], { img, name: file.name, fit: 'fill-top', zoom: 1, ox: 0, oy: 0 });
      loaded++;
    } catch (err) {
      failures.push(err.message);
    }
  }
  state.selected = start;
  clampAllPanels();
  const skipped = failures.length ? ` Skipped ${failures.length}: ${failures[0]}.` : '';
  $('status').textContent = loaded ? `Loaded ${loaded} photo(s).${skipped}` : `No photo loaded.${skipped}`;
  notify();
}

$('photoInput').addEventListener('change', async (e) => {
  await assignPhotos(e.target.files);
  e.target.value = '';
});

$('fillAll').addEventListener('click', () => {
  const src = state.panels[state.selected];
  if (!src.img) { $('status').textContent = 'Choose a photo for this panel first.'; return; }
  for (let i = 0; i < panelCount(); i++) {
    if (i !== state.selected) Object.assign(state.panels[i], { img: src.img, name: src.name, fit: src.fit, zoom: src.zoom, ox: src.ox, oy: src.oy });
  }
  clampAllPanels();
  notify();
});

/** Puts the selected panel's photo back to zoom 1, centred (used by the button and the R key). */
function resetSelectedPlacement() {
  Object.assign(state.panels[state.selected], { zoom: 1, ox: 0, oy: 0 });
  notify();
}
$('resetPlacement').addEventListener('click', resetSelectedPlacement);

$('zoom').addEventListener('input', (e) => {
  const panel = state.panels[state.selected];
  panel.zoom = Number(e.target.value);
  const { w, h } = sizeById(state.sizeId);
  clampPanelOffset(panel, rectOfPanel(state.selected, w, h)); // keep the next drag from feeling dead
  notify();
});

// ---- text and colour controls --------------------------------------------------------------------------------
const bindState = (id, key, parse = (v) => v) => $(id).addEventListener('input', (e) => { state[key] = parse(e.target.value); notify(); });
// Text inputs bound one-to-one to a state field (caption, tagline and the poster-details fields).
const TEXT_FIELDS = ['caption', 'tagline', 'subtitle', 'reviewQuote', 'reviewSource', 'badgeText', 'sealText', 'billing'];
for (const id of TEXT_FIELDS) bindState(id, id);
// Checkboxes for the furniture groups: [element id, state key]. They change the free frame, so the layout is rebuilt.
const TOGGLES = [['reviewOn', 'reviewOn'], ['tagsOn', 'tagsOn'], ['sealOn', 'sealOn'], ['detailsOn', 'detailsOn']];
for (const [id, key] of TOGGLES) {
  $(id).addEventListener('change', (e) => { state[key] = e.target.checked; layoutChanged(); });
}
// The role tag of the selected panel; empty means "automatic", a lone "-" hides this panel's tag.
$('role').addEventListener('input', (e) => { state.panels[state.selected].role = e.target.value; notify(); });
bindState('captionSize', 'captionSize', Number);
bindState('captionColor', 'captionColor');
bindState('extrusionColor', 'extrusionColor');
bindState('strength', 'gradeStrength', Number);

// ---- drag to reposition, drop to fill ------------------------------------------------------------------------
let drag = null;
const toCanvasPoint = (e) => {
  const box = canvas.getBoundingClientRect();
  return { x: ((e.clientX - box.left) * canvas.width) / box.width, y: ((e.clientY - box.top) * canvas.height) / box.height };
};
const panelAt = (pt) => rectsForState(state, canvas.width, canvas.height).findIndex((r) => pt.x >= r.x && pt.x < r.x + r.w && pt.y >= r.y && pt.y < r.y + r.h);

canvas.addEventListener('pointerdown', (e) => {
  const pt = toCanvasPoint(e);
  const index = panelAt(pt);
  if (index < 0) return;
  state.selected = index;
  drag = { index, last: pt };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
  notify();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const pt = toCanvasPoint(e);
  const rect = rectOfPanel(drag.index, canvas.width, canvas.height);
  const panel = state.panels[drag.index];
  panel.ox += (pt.x - drag.last.x) / rect.w;
  panel.oy += (pt.y - drag.last.y) / rect.h;
  clampPanelOffset(panel, rect);
  drag.last = pt;
  notify();
});
const endDrag = () => { drag = null; canvas.classList.remove('dragging'); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

const dropZone = $('dropZone');
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragging');
  const index = panelAt(toCanvasPoint(e));
  assignPhotos(e.dataTransfer.files, index >= 0 ? index : state.selected);
});

// ---- export --------------------------------------------------------------------------------------------------
let exporting = false;
async function runExport() {
  if (exporting) return;
  exporting = true;
  $('exportBtn').disabled = true;
  try {
    const result = await exportCover(state, state.sizeId);
    window.__lastExport = { name: result.name, width: result.width, height: result.height, bytes: result.blob.size };
    $('status').textContent = `Saved ${result.name} (${result.width} × ${result.height})`;
  } catch (err) {
    $('status').textContent = `Export failed: ${err.message}`;
  } finally {
    exporting = false;
    $('exportBtn').disabled = false;
  }
}
$('exportBtn').addEventListener('click', runExport);

// ---- reset and keyboard shortcuts ----------------------------------------------------------------------------
$('resetAll').addEventListener('click', () => {
  resetLook();
  $('status').textContent = 'Look reset to the defaults; photos kept.';
  layoutChanged();
});

const NUDGE = 0.01; // fraction of the panel size per arrow press
const ARROWS = { ArrowLeft: [-NUDGE, 0], ArrowRight: [NUDGE, 0], ArrowUp: [0, -NUDGE], ArrowDown: [0, NUDGE] };
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest?.('input, textarea, select')) return; // never steal keys from text fields and sliders
  const key = e.key;
  if (/^[1-7]$/.test(key) && Number(key) <= panelCount()) {
    state.selected = Number(key) - 1;
    notify();
  } else if (key === 'e' || key === 'E') {
    runExport();
  } else if (key === 'r' || key === 'R') {
    resetSelectedPlacement();
  } else if (ARROWS[key]) {
    const panel = state.panels[state.selected];
    panel.ox += ARROWS[key][0];
    panel.oy += ARROWS[key][1];
    const { w, h } = sizeById(state.sizeId);
    clampPanelOffset(panel, rectOfPanel(state.selected, w, h));
    e.preventDefault();
    notify();
  }
});

// ---- start ---------------------------------------------------------------------------------------------------
subscribe(requestPaint);
buildLayoutPicker();
buildSimplePickers();
buildChips();
const query = new URLSearchParams(location.search);
if (document.fonts) Promise.all(FONTS.map((f) => document.fonts.load(f))).then(requestPaint);
if (query.has('shot')) {
  runShot(query, requestPaint).then(() => { buildLayoutPicker(); buildChips(); requestPaint(); });
} else {
  requestPaint();
}
