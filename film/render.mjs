// Headless frame renderer.  node render.mjs <outdir> [workers] [fps]
// Each worker renders a contiguous frame range in Chromium and pipes PNGs into its own
// near-lossless ffmpeg segment; segments are concatenated in the final mux (see build.sh).
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');

const out = path.resolve(process.argv[2] || 'build');
const workers = parseInt(process.argv[3] || '4', 10);
const FF = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
fs.mkdirSync(out, { recursive: true });
const page0 = 'file://' + path.resolve('index.html') + '?render=1';

async function openPage(browser) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.error('[pageerror]', e.message));
  await p.goto(page0);
  await p.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
  return p;
}

const browser0 = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-gpu'] });
const probe = await openPage(browser0);
const film = await probe.evaluate(() => ({ DUR: FILM.DUR, FPS: FILM.FPS, T: FILM.T, SFX: FILM.SFX }));
fs.writeFileSync(path.join(out, 'sfx.json'), JSON.stringify(film, null, 1));
await browser0.close();
const fps = parseInt(process.argv[4] || String(film.FPS), 10);
const total = Math.round(film.DUR * fps);
console.log(`frames ${total} @ ${fps}fps, ${workers} workers, ${film.SFX.length} sound events`);

const t0 = Date.now();
let done = 0;
async function worker(w) {
  const a = Math.floor(total * w / workers), b = Math.floor(total * (w + 1) / workers);
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-gpu'] });
  const p = await openPage(browser);
  const seg = path.join(out, `seg_${w}.mkv`);
  const ff = spawn(FF, ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '8', '-pix_fmt', 'yuv444p', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = a; f < b; f++) {
    const d = await p.evaluate(t => { renderFrame(t); return document.getElementById('c').toDataURL('image/png'); }, f / fps);
    const buf = Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    done++;
    if (done % 60 === 0) { const el = (Date.now() - t0) / 1000; console.log(`${done}/${total}  ${el.toFixed(0)}s  eta ${(el / done * (total - done)).toFixed(0)}s`); }
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  return seg;
}
const segs = await Promise.all([...Array(workers).keys()].map(worker));
fs.writeFileSync(path.join(out, 'segments.txt'), segs.map(s => `file '${s}'`).join('\n') + '\n');
console.log('done in', ((Date.now() - t0) / 1000).toFixed(0), 's');
