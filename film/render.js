// usage: node render.js stills 0,60,120 outdir   |   node render.js video start end out.mp4
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const root = __dirname;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
});
(async () => {
  await new Promise(res => server.listen(0, res));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[err]', e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  const info = await page.evaluate(() => window.init());
  console.log(JSON.stringify(info));
  const mode = process.argv[2];
  const el = await page.$('#out');
  if (mode === 'stills') {
    const frames = process.argv[3].split(',').map(Number), dir = process.argv[4] || 'stills';
    fs.mkdirSync(dir, { recursive: true });
    for (const f of frames) {
      const t0 = Date.now(); await page.evaluate(f => window.renderFrame(f), f);
      await el.screenshot({ path: `${dir}/f${String(f).padStart(4, '0')}.png` });
      console.log('frame', f, Date.now() - t0, 'ms');
    }
  } else if (mode === 'frames') {
    const a = +process.argv[3], b = +process.argv[4], dir = process.argv[5];
    fs.mkdirSync(dir, { recursive: true }); const t0 = Date.now();
    for (let f = a; f < b; f++) {
      const p = `${dir}/f${String(f).padStart(4, '0')}.png`;
      if (fs.existsSync(p)) continue;
      await page.evaluate(f => window.renderFrame(f), f);
      await el.screenshot({ path: p + '.tmp.png' }); fs.renameSync(p + '.tmp.png', p);
      if (f % 30 === 0) console.log('frame', f, ((Date.now() - t0) / 1000).toFixed(0), 's');
    }
  } else {
    const a = +process.argv[3], b = +process.argv[4], outf = process.argv[5];
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv444p', outf], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = a; f < b; f++) {
      await page.evaluate(f => window.renderFrame(f), f);
      const buf = await el.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 30 === 0) console.log('frame', f, ((Date.now() - t0) / (f - a + 1)).toFixed(0), 'ms/f');
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  await browser.close(); server.close();
})();
