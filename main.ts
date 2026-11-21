// Hand-in program (Node 22, standard library only): copies the static app and the screenshots beside this file into
// the output directory, then writes dossier.json with the vendored make.fun library.
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts          (node main.ts --help lists the options)
import { accessSync, constants, cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';
import { LAYOUTS } from './app/src/panel-layouts.js';
import { GRADES } from './app/src/color-grades.js';

const sourceRoot = fileURLToPath(new URL('.', import.meta.url));
const outputRoot = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Optional --layout <id> / --grade <id>: checked against the lists the app itself uses, so the two can never drift.
// They do not change what is written (the hand-in is the static app); they only choose the preview URL that is printed.
const layoutIds: string[] = LAYOUTS.map((l: { id: string }) => l.id);
const gradeIds: string[] = GRADES.map((g: { id: string }) => g.id);

function optionValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const at = args.indexOf(name);
  if (at === -1) return undefined;
  const value = args[at + 1];
  if (value === undefined || value.startsWith('--')) fail(`${name} needs a value`);
  return value;
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(2);
}

const USAGE = `Usage: node main.ts [--layout <id>] [--grade <id>] [--help]

Copies the static app and screenshots into $MAKEFUN_OUTPUT_DIR (default /output) and writes dossier.json.

Options:
  --layout <id>   preview layout to mention in the final message (${layoutIds.join(', ')})
  --grade <id>    preview colour grade to mention in the final message (${gradeIds.join(', ')})
  --help, -h      print this text and exit

Example: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --layout grid-2x2 --grade coral`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

const KNOWN_FLAGS = ['--layout', '--grade', '--help', '-h'];
const flagLike = process.argv.slice(2).filter((a) => a.startsWith('-'));
const unknown = flagLike.find((a) => !KNOWN_FLAGS.includes(a));
if (unknown !== undefined) fail(`unknown option ${unknown}; run with --help for usage`);

const layout = optionValue('--layout');
const grade = optionValue('--grade');
if (layout !== undefined && !layoutIds.includes(layout)) fail(`unknown layout "${layout}"; valid layouts: ${layoutIds.join(', ')}`);
if (grade !== undefined && !gradeIds.includes(grade)) fail(`unknown grade "${grade}"; valid grades: ${gradeIds.join(', ')}`);

// Check the output directory is usable before copying anything: the nearest existing ancestor must be writable.
function assertWritable(dir: string): void {
  let probe = resolve(dir);
  while (!existsSync(probe)) probe = resolve(probe, '..');
  if (!statSync(probe).isDirectory()) fail(`output path is not a directory: ${probe}`);
  try {
    accessSync(probe, constants.W_OK);
  } catch {
    fail(`output directory is not writable: ${probe}`);
  }
}
if (outputRoot.trim() === '') fail('MAKEFUN_OUTPUT_DIR is set but empty; give a directory or unset it');
assertWritable(outputRoot);

// Copying app/ into itself (or over the sources) would corrupt the repo, so refuse those output directories.
const resolvedOutput = resolve(outputRoot);
if (resolvedOutput === resolve(sourceRoot) || resolvedOutput === resolve(sourceRoot, 'app')) {
  throw new Error(`MAKEFUN_OUTPUT_DIR must not be the source directory itself: ${resolvedOutput}`);
}

// Fail early with a clear message instead of a raw ENOENT from cpSync if app/ is missing.
if (!existsSync(join(sourceRoot, 'app', 'index.html'))) throw new Error(`app/index.html not found beside ${sourceRoot}`);

mkdirSync(outputRoot, { recursive: true });
cpSync(join(sourceRoot, 'app'), join(outputRoot, 'app'), { recursive: true });
mkdirSync(join(outputRoot, 'screenshots'), { recursive: true });
const shotsDir = join(sourceRoot, 'screenshots');
if (existsSync(shotsDir)) cpSync(shotsDir, join(outputRoot, 'screenshots'), { recursive: true });

// Same caps as the scorer: text size for the dossier, at most 4 screenshots of 256 KiB, app/ within 993 entries,
// 48 MiB and 1000-byte paths.
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

// Early, readable warnings for the two screenshot rules that are easiest to break by accident (the dossier build
// itself is the authority; this only saves a round trip). Warnings never change what is written.
if (existsSync(shotsDir)) {
  const shots = readdirSync(shotsDir).sort();
  if (shots.length > caps.screenshots.max) console.warn(`warning: ${shots.length} screenshots, at most ${caps.screenshots.max} count`);
  for (const name of shots) {
    const bytes = statSync(join(shotsDir, name)).size;
    if (bytes > caps.screenshots.max_bytes) console.warn(`warning: screenshots/${name} is ${bytes} bytes (cap ${caps.screenshots.max_bytes})`);
  }
}
writeFileSync(join(outputRoot, 'dossier.json'), buildDossier(outputRoot, caps));
console.log(`hand-in written to ${resolvedOutput} (dossier.json, app/, screenshots/)`);
if (layout !== undefined || grade !== undefined) {
  const query = [`shot=cover`, layout && `layout=${layout}`, grade && `grade=${grade}`].filter(Boolean).join('&');
  console.log(`preview that look with: node serve.ts, then open http://localhost:8080/?${query}`);
}
