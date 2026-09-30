// Frame renderer: serves the project, drives headless Chromium, writes PNG frames.
// usage: node render.js stills 0.5,3,6            -> out/stills/t_XX.png
//        node render.js frames <workers> [from] [to]
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      fs.readFile(f, (e, d) => { if (e) { rsp.writeHead(404); rsp.end(); return; } rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); rsp.end(d); });
    }).listen(0, () => res(srv));
  });
}
async function page(browser, port) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto(`http://127.0.0.1:${port}/src/index.html`);
  await p.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  return p;
}
(async () => {
  const [mode, a1, a2, a3] = process.argv.slice(2);
  const srv = await serve(); const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--disable-gpu', '--disable-lcd-text', '--force-color-profile=srgb'] });
  if (mode === 'stills') {
    const dir = path.join(ROOT, 'out', 'stills'); fs.mkdirSync(dir, { recursive: true });
    const p = await page(browser, port);
    for (const ts of a1.split(',')) {
      const f = Math.round(parseFloat(ts) * 30);
      const t0 = Date.now();
      await p.evaluate(f => window.renderFrame(f), f);
      await p.screenshot({ path: path.join(dir, `t_${ts}.png`) });
      console.log('still', ts, Date.now() - t0, 'ms');
    }
  } else {
    const workers = parseInt(a1 || '3'); const NF = await (await page(browser, port)).evaluate(() => window.NF);
    const from = parseInt(a2 || '0'), to = parseInt(a3 || NF);
    const dir = path.join(ROOT, 'out', 'frames'); fs.mkdirSync(dir, { recursive: true });
    let next = from, done = 0; const t0 = Date.now();
    await Promise.all(Array.from({ length: workers }, async () => {
      const p = await page(browser, port);
      while (true) {
        const f = next++; if (f >= to) break;
        await p.evaluate(f => window.renderFrame(f), f);
        await p.screenshot({ path: path.join(dir, `f_${String(f).padStart(5, '0')}.png`) });
        done++;
        if (done % 30 === 0) console.log(`${done}/${to - from} frames, ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
      }
    }));
  }
  await browser.close(); srv.close();
})();
