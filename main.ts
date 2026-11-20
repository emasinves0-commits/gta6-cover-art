// Hand-in program (Node 22, standard library only): copies the static app and the screenshots beside this file into
// the output directory, then writes dossier.json with the vendored make.fun library.
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const sourceRoot = fileURLToPath(new URL('.', import.meta.url));
const outputRoot = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

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
writeFileSync(join(outputRoot, 'dossier.json'), buildDossier(outputRoot, caps));
console.log(`hand-in written to ${resolvedOutput} (dossier.json, app/, screenshots/)`);
