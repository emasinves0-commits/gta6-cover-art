// Screenshot runner (Node 22+ built-ins only: no npm packages, no Python). It serves app/ with serve.ts, drives a
// Chrome / chrome-headless-shell through the DevTools protocol over Node's built-in WebSocket, and for every entry of
// shots.json writes a JPEG into screenshots/:
//   - entries with "export": open the scene, wait for window.__shotReady, click #exportBtn, take the downloaded PNG;
//   - other entries: open the scene (optionally at "viewport": [w, h]) and capture the page.
// ffmpeg then scales the picture to the entry's w x h and encodes a JPEG (quality ~85) that must stay <= 256 KiB.
// It lives outside app/ on purpose, so it never enters the dossier.
//
//   node scripts/shots.mjs                      all shots into screenshots/
//   node scripts/shots.mjs 1-cover.jpg          only the named shots
//   node scripts/shots.mjs --out /some/dir      write elsewhere (screenshots/ is left untouched)
//   CHROME=/path/to/chrome node scripts/shots.mjs
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outDir = resolve(outIndex === -1 ? join(root, 'screenshots') : args[outIndex + 1]);
const outValue = outIndex === -1 ? -1 : outIndex + 1; // index of the --out directory argument, if any
const only = args.filter((a, i) => !a.startsWith('--') && i !== outValue);
const SERVER_PORT = 8765;
const DEBUG_PORT = 9333;
const MAX_BYTES = 256 * 1024;
const JPEG_QUALITIES = [3, 4, 5, 6, 8, 10, 13, 16]; // ffmpeg -q:v, lower is better; the first that fits the cap wins

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[shots]', ...a);

function findChrome() {
  const candidates = [
    process.env.CHROME,
    '/home/hatch/workspace/remotion/node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/meta-chromium/chrome',
  ].filter(Boolean);
  const hit = candidates.find((c) => existsSync(c));
  if (!hit) throw new Error(`no Chrome found; set CHROME=/path/to/chrome (tried ${candidates.join(', ')})`);
  return hit;
}

/** Waits until a child process prints a line containing `needle` on stdout or stderr. */
function waitForOutput(child, needle, label, ms = 20000) {
  return new Promise((resolveLine, reject) => {
    let seen = '';
    const timer = setTimeout(() => reject(new Error(`${label} did not start in ${ms} ms; last output: ${seen.slice(-300)}`)), ms);
    const onData = (chunk) => {
      seen += chunk.toString();
      const hit = seen.split('\n').find((l) => l.includes(needle));
      if (hit) { clearTimeout(timer); resolveLine(hit); }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`${label} exited early (${code}); output: ${seen.slice(-300)}`)); });
  });
}

/** A minimal DevTools protocol client over the built-in WebSocket. */
class Cdp {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.ws = new WebSocket(url);
    this.opened = new Promise((ok, fail) => { this.ws.addEventListener('open', ok); this.ws.addEventListener('error', () => fail(new Error('DevTools websocket failed'))); });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { ok, fail } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) fail(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? '')})`));
        else ok(msg.result);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((ok, fail) => {
      const timer = setTimeout(() => { this.pending.delete(id); fail(new Error(`${method} timed out`)); }, 60000);
      this.pending.set(id, { ok: (v) => { clearTimeout(timer); ok(v); }, fail: (e) => { clearTimeout(timer); fail(e); } });
      this.ws.send(JSON.stringify(payload));
    });
  }

  close() { try { this.ws.close(); } catch { /* already closed */ } }
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file) {
  const head = readFileSync(file).subarray(0, 24);
  if (head.toString('latin1', 1, 4) !== 'PNG') throw new Error(`${file} is not a PNG`);
  return { w: head.readUInt32BE(16), h: head.readUInt32BE(20) };
}

async function waitFor(check, what, ms = 60000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(150);
  }
}

/** Scales `png` to w x h and writes a JPEG at the best quality that fits the byte cap. */
function encodeJpeg(png, jpg, w, h) {
  for (const q of JPEG_QUALITIES) {
    const run = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-vf', `scale=${w}:${h}:flags=lanczos`, '-q:v', String(q), '-pix_fmt', 'yuvj420p', jpg]);
    if (run.status !== 0) throw new Error(`ffmpeg failed: ${run.stderr}`);
    if (statSync(jpg).size <= MAX_BYTES) return q;
  }
  throw new Error(`${jpg} stays above ${MAX_BYTES} bytes even at the lowest quality`);
}

async function main() {
  const plan = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8')).filter((s) => !only.length || only.includes(s.name));
  if (!plan.length) throw new Error(`no shot matches ${only.join(', ')}`);
  if (spawnSync('ffmpeg', ['-version']).status !== 0) throw new Error('ffmpeg is required to scale and encode the JPEGs');
  mkdirSync(outDir, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'cover-shots-'));
  const downloads = join(work, 'downloads');
  mkdirSync(downloads);

  const server = spawn(process.execPath, [join(root, 'serve.ts'), '--port', String(SERVER_PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  const chromePath = findChrome();
  const chromeArgs = [`--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${join(work, 'profile')}`, '--no-sandbox', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--disable-gpu', '--no-first-run', '--mute-audio', 'about:blank'];
  if (!chromePath.includes('headless-shell')) chromeArgs.unshift('--headless=new');
  const chrome = spawn(chromePath, chromeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
  const cleanup = () => { chrome.kill('SIGKILL'); server.kill('SIGKILL'); rmSync(work, { recursive: true, force: true }); };
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  try {
    await waitForOutput(server, 'app/ is on', 'serve.ts');
    const line = await waitForOutput(chrome, 'DevTools listening on', 'Chrome');
    const browserWs = /ws:\/\/\S+/.exec(line)?.[0];
    if (!browserWs) throw new Error(`could not read the DevTools address from: ${line}`);
    const cdp = new Cdp(browserWs);
    await cdp.opened;
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const page = (method, params) => cdp.send(method, params, sessionId);
    const evaluate = async (expression) => (await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
    await page('Page.enable');

    for (const shot of plan) {
      const [vw, vh] = shot.viewport ?? [1280, 720];
      await page('Emulation.setDeviceMetricsOverride', { width: vw, height: vh, deviceScaleFactor: 1, mobile: false });
      await page('Page.navigate', { url: 'about:blank' }); // so a stale __shotReady from the previous scene can never be read
      await page('Page.navigate', { url: `http://localhost:${SERVER_PORT}/${shot.query}` });
      await waitFor(() => evaluate('window.__shotReady === true'), `${shot.name} to finish painting`);
      const raw = join(work, `${shot.name}.png`);
      if (shot.export) {
        for (const f of readdirSync(downloads)) rmSync(join(downloads, f), { force: true });
        await evaluate("document.getElementById('exportBtn').click()"); // a JS click also works when the export bar is hidden
        const file = await waitFor(() => {
          const names = readdirSync(downloads);
          if (!names.length || names.some((n) => n.endsWith('.crdownload'))) return null;
          const full = join(downloads, names[0]);
          return statSync(full).size > 0 ? full : null;
        }, `${shot.name} export download`);
        await sleep(300);
        renameSync(file, raw);
        const size = pngSize(raw);
        if (`${size.w}x${size.h}` !== shot.export) throw new Error(`${shot.name}: export is ${size.w}x${size.h}, shots.json says ${shot.export}`);
        log(shot.name, 'exported', `${size.w}x${size.h}`);
      } else {
        const { data } = await page('Page.captureScreenshot', { format: 'png' });
        writeFileSync(raw, Buffer.from(data, 'base64'));
      }
      const jpg = join(outDir, shot.name);
      const q = encodeJpeg(raw, jpg, shot.w, shot.h);
      log(shot.name, `${shot.w}x${shot.h}`, `${statSync(jpg).size} bytes`, `(ffmpeg q:v ${q})`);
    }
    cdp.close();
  } finally {
    cleanup();
  }
}

main().catch((err) => { console.error('[shots] failed:', err.message); process.exit(1); });
