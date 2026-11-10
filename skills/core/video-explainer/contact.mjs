#!/usr/bin/env node
// Contact sheet: frame 0, each cue's settled frame (3 frames before it ends), and the last frame,
// from one bundle, tiled 4 across into out/contact.png. Full stills land in out/stills/.
// Tiles are labeled by scene and cue number only, so a muted viewer gets no narration text.
//   node contact.mjs <project>
// CHROME overrides the Chrome path, as in remotion.config.ts.

import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join, resolve} from 'node:path';

const project = resolve(process.argv[2] ?? '.');
const require = createRequire(join(project, 'package.json')); // Remotion resolves from the project
const {bundle} = require('@remotion/bundler');
const {openBrowser, renderStill, selectComposition} = require('@remotion/renderer');
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const timing = JSON.parse(readFileSync(join(project, 'src/timing.json'), 'utf8'));
const shots = [{frame: 0, name: 'start'}];
for (const s of timing.scenes) {
  s.cues.forEach((c, k) => shots.push({frame: s.from + c.to - 3, name: `${s.id} ${k + 1}/${s.cues.length}`}));
}
shots.push({frame: timing.durationInFrames - 1, name: 'last'});

const out = join(project, 'out');
mkdirSync(join(out, 'stills'), {recursive: true});
const serveUrl = await bundle({entryPoint: join(project, 'src/index.ts'), outDir: join(project, 'build/bundle')});
const browser = await openBrowser('chrome', {browserExecutable: chrome, chromeMode: 'chrome-for-testing'});
const composition = await selectComposition({serveUrl, id: 'Explainer', puppeteerInstance: browser, browserExecutable: chrome, chromeMode: 'chrome-for-testing'});
for (const shot of shots) {
  shot.file = `stills/${String(shot.frame).padStart(5, '0')}.png`;
  await renderStill({composition, serveUrl, frame: shot.frame, output: join(out, shot.file), scale: 0.5, puppeteerInstance: browser, overwrite: true});
  console.error(`contact: ${shot.frame} ${shot.name}`);
}
await browser.close({silent: true});

const tile = 480;
const rows = Math.ceil(shots.length / 4);
const height = rows * (tile * 9 / 16 + 44) + 16;
const cells = shots.map((s) => `<figure><img src="${s.file}"><figcaption>${(s.frame / timing.fps).toFixed(1)} s  ${s.name}</figcaption></figure>`).join('');
writeFileSync(join(out, 'contact.html'), `<!doctype html><style>
body{margin:0;padding:8px;background:#d9dbe0;display:grid;grid-template-columns:repeat(4,${tile}px);gap:0 8px;font:16px -apple-system,sans-serif}
figure{margin:0 0 8px}img{width:${tile}px;display:block;outline:1px solid #b6bcc5}figcaption{padding:4px 2px 10px}
</style>${cells}`);
const width = 4 * tile + 3 * 8 + 16;
const png = join(out, 'contact.png');
const started = Date.now();
const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${width},${Math.ceil(height)}`,
  `--screenshot=${png}`, `file://${join(out, 'contact.html')}`], {encoding: 'utf8'});
// Headless Chrome sometimes crashes in teardown after writing the file, so trust the file, not the exit code.
if (!existsSync(png) || statSync(png).mtimeMs < started) {
  console.error(r.stderr);
  process.exit(1);
}
console.log(`${shots.length} frames -> ${png}`);
