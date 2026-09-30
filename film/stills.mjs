// Render selected timestamps to PNG for review:  node stills.mjs out_dir t1 t2 ...
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const [out, ...ts] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-gpu'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('console', m => console.log('[page]', m.text())); p.on('pageerror', e => console.log('[err]', e.message));
await p.goto('file://' + path.resolve('index.html') + '?render=1');
await p.waitForFunction(() => window.READY === true, null, { timeout: 30000 });
for (const t of ts) {
  const t0 = Date.now();
  const d = await p.evaluate(t => { renderFrame(t); return document.getElementById('c').toDataURL('image/png'); }, parseFloat(t));
  fs.writeFileSync(path.join(out, `f_${parseFloat(t).toFixed(2).padStart(6, '0')}.png`), Buffer.from(d.split(',')[1], 'base64'));
  console.log(t, Date.now() - t0, 'ms');
}
await b.close();
