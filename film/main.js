'use strict';
// ─────────────────────────────────────────────────────────────
//  MAIN — camera, compositing, HUD, sound-event registry
// ─────────────────────────────────────────────────────────────
const KEYS_A = [ // map world (0 → 15.2)
  { t: 0, tg: [0, 0, 0], d: 1.08, yaw: 0, pitch: 89.7 },
  { t: 4.2, tg: [0, 0, 0], d: 1.0, yaw: 0, pitch: 89.7, e: E.ios },
  { t: 5.2, tg: [0, 0, 0], d: 1.02, yaw: 0, pitch: 89.7 },
  { t: 6.7, tg: MAP.Mw, d: 1.3, yaw: MAP.rotAng / DEG * -1, pitch: 33, e: E.io4 },
  { t: 8.4, tg: MAP.Mw, d: 1.12, yaw: MAP.rotAng / DEG * -1 + 6, pitch: 29 },
  { t: 9.6, tg: F3, d: 1.3, yaw: 36, pitch: 14, e: E.o3 },
  { t: 12.0, tg: F3, d: 1.05, yaw: 70, pitch: 9 },
  { t: T.point3 + 0.1, tg: F3, d: 0.95, yaw: 112, pitch: 5 },
];
const KEYS_B = [ // spike / sphere world (15.2 → end)
  { t: T.s4, tg: [0, 0, 0], d: 0.8, yaw: 0, pitch: 0 },
  { t: T.bend, tg: [SPK.Xb - 420, 70, 0], d: 1.0, yaw: 0, pitch: 0, e: E.ios },
  { t: 17.6, tg: [SPK.axisX - 120, 500, 0], d: 1.1, yaw: 8, pitch: -2 },
  { t: 19.0, tg: [SPK.axisX, 1200, 0], d: 1.45, yaw: 48, pitch: -9 },
  { t: 20.4, tg: [SPK.axisX, 1700, 0], d: 2.0, yaw: 95, pitch: -4 },
  { t: T.expand, tg: [SPK.axisX, 1350, 0], d: 3.0, yaw: 150, pitch: 9 },
  { t: T.compress, tg: [SPK.axisX, 1300, 0], d: 3.35, yaw: 168, pitch: 12 },
  { t: T.s5, tg: C5, d: 1.45, yaw: 180, pitch: 89.7 },
  { t: 23.9, tg: C5, d: 1.95, yaw: 232, pitch: 22 },
  { t: 26.0, tg: C5, d: 1.6, yaw: 300, pitch: 12 },
  { t: T.peak, tg: C5, d: 1.28, yaw: 342, pitch: 8 },
  { t: T.peak + 3, tg: C5, d: 1.24, yaw: 346, pitch: 8 },
];
function camAt(t) {
  if (t < T.s4) {
    const k = camKeys(KEYS_A, t);
    return makeCam(k.tg, k.d * FL, k.yaw * DEG, k.pitch * DEG);
  }
  const tt = t >= T.s5 ? te5(t) : t;
  const k = camKeys(KEYS_B, tt);
  const tg = k.tg.slice();
  const w = er(t, 17.0, 17.7) * (1 - er(t, 20.9, 21.7));
  if (w > 0) tg[1] = lerp(tg[1], SPK.baseY + 0.72 * headH(t) - 120, w);
  return makeCam(tg, k.d * FL, k.yaw * DEG, k.pitch * DEG);
}
const SHAKES = [[T.collide, 9], [17.2, 4], [T.s5, 10], [T.peak, 13], [T.iris, 4]];
function shake(t) {
  let x = 0, y = 0;
  for (const [t0, a] of SHAKES) { if (t < t0) continue; const d = t - t0, e = a * Math.exp(-d * 9); x += e * Math.sin(d * 83); y += e * Math.cos(d * 71); }
  return [x, y];
}

// ── backgrounds ──────────────────────────────────────────────
let BG = null, VIG = null;
function buildBG() {
  BG = document.createElement('canvas'); BG.width = W; BG.height = H;
  const g = BG.getContext('2d');
  g.fillStyle = col(P.deep); g.fillRect(0, 0, W, H);
  const gr = g.createRadialGradient(CX, CY * 0.9, 0, CX, CY, 1150);
  gr.addColorStop(0, col(P.em, 0.75)); gr.addColorStop(0.6, col(P.em, 0.22)); gr.addColorStop(1, col(P.ink, 0));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = col(P.cream, 0.045);
  for (let y = 24; y < H; y += 48) for (let x = 24; x < W; x += 48) g.fillRect(x - 0.6, y - 0.6, 1.3, 1.3);
  VIG = document.createElement('canvas'); VIG.width = W; VIG.height = H;
  const v = VIG.getContext('2d');
  const vg = v.createRadialGradient(CX, CY, 380, CX, CY, 1180);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, col(P.ink, 0.8));
  v.fillStyle = vg; v.fillRect(0, 0, W, H);
}

// ── HUD (editorial frame furniture) ──────────────────────────
const CHAPTERS = [[0, '01', 'ORIGIN'], [T.s2, '02', 'TWO SYSTEMS'], [T.s3, '03', 'THE NAME'], [T.s4, '04', 'SEARCH INTEREST'], [T.s5, '05', 'MOMENTUM'], [T.s6, '06', 'THE STORY']];
function drawHUD(ctx, t) {
  const a = er(t, 0.9, 1.8);
  if (a <= 0) return;
  const onCream = t > T.iris + 0.35;
  const c = onCream ? P.em : P.cream;
  ctx.save(); ctx.globalAlpha = a;
  ctx.strokeStyle = col(c, 0.4); ctx.lineWidth = 1;
  const m = 40, L = 16;
  ctx.beginPath();
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [W - m, H - m, -1, -1], [m, H - m, 1, -1]]) { ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); }
  ctx.stroke();
  ctx.font = FONT.mono(11, 500); ctx.letterSpacing = '3px';
  ctx.textAlign = 'left'; ctx.fillStyle = col(c, 0.62); ctx.fillText('ATTENTION STUDY', 64, 66);
  ctx.fillStyle = col(c, 0.36); ctx.fillText('PORTUGAL / WALES', 64, 84);
  // chapter
  let ch = CHAPTERS[0];
  for (const cc of CHAPTERS) if (t >= cc[0]) ch = cc;
  const sk = rm(t, ch[0], ch[0] + 0.45);
  ctx.textAlign = 'right'; ctx.fillStyle = col(c, 0.62);
  ctx.fillText(scramble(ch[1] + ' — ' + ch[2], ch[0] === 0 ? 1 : sk, ch[0] * 10), W - 64, 66);
  ctx.fillStyle = col(c, 0.36); ctx.fillText('06', W - 64, 84);
  // timecode
  const f = Math.floor(t * FPS), s = Math.floor(f / FPS), ff = f % FPS;
  ctx.textAlign = 'left'; ctx.fillStyle = col(c, 0.4);
  ctx.fillText('TC 00:00:' + String(s).padStart(2, '0') + ':' + String(ff).padStart(2, '0'), 64, H - 58);
  // right footer: context line
  let foot = 'LAT/LON — SIMPLIFIED GEOMETRY';
  if (t > T.s3) foot = 'SIGNAL — ONE NAME';
  if (t > T.s4) foot = 'SEARCH INTEREST — CONCEPTUAL, NOT TO SCALE';
  if (t > T.s6) foot = 'END';
  ctx.textAlign = 'right'; ctx.fillStyle = col(c, 0.36); ctx.fillText(foot, W - 64, H - 58);
  // progress hairline
  ctx.strokeStyle = col(c, 0.12); ctx.beginPath(); ctx.moveTo(64, H - 84); ctx.lineTo(W - 64, H - 84); ctx.stroke();
  ctx.strokeStyle = col(onCream ? P.em : P.lime, 0.55); ctx.beginPath(); ctx.moveTo(64, H - 84); ctx.lineTo(64 + (W - 128) * clamp(t / DUR), H - 84); ctx.stroke();
  ctx.letterSpacing = '0px';
  ctx.restore();
}

// ── compositor ───────────────────────────────────────────────
let ctx = null, IRIS = null;
function renderFrame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.setLineDash([]);
  ctx.drawImage(BG, 0, 0);
  const cam = camAt(t);
  const [sx, sy] = shake(t);
  ctx.save(); ctx.translate(sx, sy);
  if (t < 9.6) drawMap(ctx, t, cam);
  if (t < 5.8) drawMapFurniture(ctx, t);
  if (t >= T.collide && t < T.s4 + 0.02) drawName(ctx, t, cam);
  if (t >= T.s4 && t < T.s5 + 0.03) drawSpike(ctx, t, cam);
  if (t >= T.s5 && t < T.s6 + 0.1) drawSphere(ctx, t, cam);
  ctx.restore();
  ctx.drawImage(VIG, 0, 0);
  if (t >= T.iris) drawEnd(ctx, t, IRIS);
  drawHUD(ctx, t);
}

// ── sound-event registry (deterministic, from the same data) ─
function registerSFX() {
  SFX.length = 0;
  const px = (t, w) => { const c = camAt(t), p = proj(c, w); return panX(p.x); };
  // S1
  sfx(0.3, 'click', { g: 0.7, pan: panX(MAP.P1[0]) });
  sfx(0.3, 'ping', { g: 0.35, f: 1760, pan: panX(MAP.P1[0]) });
  for (let i = 0; i < 15; i++) sfx(0.65 + i * 0.5 / 15, 'type', { g: 0.22, pan: panX(MAP.P1[0] + 20 + i * 8) });
  sfx(0.9, 'drawtex', { g: 0.35, dur: 1.4, p0: panX(MAP.P1[0]), p1: panX(MAP.routeAt(0.2)[0]) });
  sfx(2.26, 'whoosh', { g: 0.75, dur: 0.75, p0: -0.3, p1: 0.45 });
  NET1.nodes.forEach((n, i) => sfx(n.t, 'tick', { g: 0.32, f: 2200 + i * 90, pan: panX(MAP.routeAt(n.k)[0]) }));
  NET1.scat.forEach((s, i) => { if (i % 2 === 0) sfx(s.t, 'tick', { g: 0.1, f: 3800 + (i % 7) * 300, pan: panX(MAP.routeAt(s.k)[0]) }); });
  sfx(2.55, 'thump', { g: 0.6 }); sfx(2.56, 'metal', { g: 0.25, pan: -0.4 });
  sfx(2.95, 'ping', { g: 0.35, f: 1320, pan: panX(MAP.P2[0]) }); sfx(2.95, 'click', { g: 0.6, pan: panX(MAP.P2[0]) });
  for (let i = 0; i < 15; i++) sfx(3.0 + i * 0.5 / 15, 'type', { g: 0.2, pan: panX(MAP.P2[0] + 20 + i * 8) });
  sfx(3.05, 'thump', { g: 0.55 }); sfx(3.06, 'metal', { g: 0.22, pan: 0.4 });
  sfx(4.2, 'drawtex', { g: 0.35, dur: 1.05, p0: -0.6, p1: -0.3 });
  sfx(4.35, 'drawtex', { g: 0.3, dur: 1.05, p0: 0.4, p1: 0.5 });
  sfx(4.45, 'grain', { g: 0.35, dur: 1.4, density: 90, p0: -0.5, p1: -0.1 });
  sfx(4.6, 'grain', { g: 0.22, dur: 1.4, density: 50, p0: 0.5, p1: 0.2 });
  sfx(5.0, 'glitch', { g: 0.25, pan: -0.3 }); sfx(5.08, 'glitch', { g: 0.22, pan: 0.4 });
  sfx(5.25, 'whoosh', { g: 0.55, dur: 1.5, p0: 0.5, p1: -0.5, low: true });
  sfx(5.3, 'pulse', { g: 0.5 });
  sfx(5.9, 'tick', { g: 0.4, f: 1500, pan: -0.5 });
  sfx(5.92, 'whoosh', { g: 0.35, dur: 2.0, p0: -0.5, p1: 0.0 });
  sfx(6.5, 'swell', { g: 0.4, dur: 1.2 });
  PITCH.paths.forEach((p, i) => sfx(6.9 + i * 0.07, 'tick', { g: 0.14, f: 1200 + i * 110, pan: (i % 2 ? 0.3 : -0.3) }));
  sfx(7.0, 'riser', { g: 0.7, dur: 1.4 });
  [7.2, 7.62, 7.92, 8.12, 8.27].forEach(tt => sfx(tt, 'pulse', { g: 0.55 }));
  sfx(7.9, 'whoosh', { g: 0.3, dur: 0.5, p0: 0, p1: 0 });
  sfx(T.collide, 'impact', { g: 1.0, size: 1.0 }); sfx(T.collide, 'glitch', { g: 0.4, pan: 0 }); sfx(T.collide + 0.01, 'metal', { g: 0.45, pan: 0 });
  sfx(T.collide + 0.03, 'grain', { g: 0.5, dur: 1.2, density: 260, p0: -0.8, p1: 0.8, decay: true });
  // S3
  RINGS3.forEach((r0, i) => sfx(r0, 'ping', { g: 0.18 + 0.02 * i, f: 660 + i * 40, pan: 0 }));
  sfx(9.5, 'click', { g: 0.4, pan: 0 });
  for (let i = 0; i < 7; i++) sfx(9.72 + i * 0.075, 'type', { g: 0.35, pan: (i - 3) * 0.02 });
  for (let i = 0; i < 7; i++) sfx(10.3 + i * 0.035, 'tick', { g: 0.22, f: 2600 + i * 120, pan: (i - 3) * 0.03 });
  sfx(10.55, 'metal', { g: 0.3, pan: 0 });
  for (let i = 2; i < 64; i++) { const n = TREE[i]; sfx(n.t, 'pop', { g: 0.3 / Math.sqrt(n.gen), f: 1900 - n.gen * 160 + (i % 5) * 70, pan: px(n.t, nodePos(n, n.t, 1)) }); }
  sfx(11.0, 'drawtex', { g: 0.3, dur: 0.9, p0: 0.1, p1: -0.1 });
  sfx(11.8, 'riser', { g: 0.55, dur: 1.5 });
  for (let k = 1; k <= 4; k++) sfx(T.rows + k * 0.055, 'whoosh', { g: 0.3, dur: 0.45, p0: k % 2 ? -0.7 : 0.7, p1: k % 2 ? 0.7 : -0.7 });
  sfx(T.rows, 'glitch', { g: 0.35, pan: 0 });
  sfx(T.collapse3, 'suck', { g: 0.8, dur: T.point3 - T.collapse3 });
  sfx(T.point3, 'click', { g: 0.9, pan: 0 }); sfx(T.point3, 'thump', { g: 0.8 });
  // S4
  sfx(T.s4, 'ping', { g: 0.25, f: 1760, pan: 0 });
  for (let x = 90; x < SPK.Xb; x += 90) { let lo = 15.3, hi = T.bend; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (headS(m) < x) lo = m; else hi = m; } sfx(hi, 'tick', { g: 0.2, f: 1400 + x * 0.3, pan: px(hi, [x, 0, 0]) }); }
  sfx(15.5, 'glitch', { g: 0.18, pan: -0.5 });
  sfx(16.3, 'riser', { g: 0.75, dur: T.vert - 16.3 });
  sfx(T.vert, 'impact', { g: 0.55, size: 0.5 }); sfx(T.vert, 'whoosh', { g: 0.8, dur: 1.1, p0: 0.2, p1: 0.2, up: true });
  sfx(17.35, 'metal', { g: 0.35, pan: 0.2 });
  PLATES.forEach((pl, i) => sfx(pl.t, 'tick', { g: 0.2, f: 900 + i * 55, pan: (i % 2 ? 0.25 : -0.25) }));
  TXT_RINGS.forEach(ki => sfx(PLATES[ki].t + 0.1, 'glitch', { g: 0.2, pan: 0.2 }));
  let bt = T.vert + 0.5, per = 0.5; while (bt < T.expand) { sfx(bt, 'pulse', { g: 0.5 }); bt += per; per = Math.max(0.27, per * 0.955); }
  sfx(T.expand, 'swell', { g: 0.45, dur: 0.5 });
  sfx(19.8, 'whoosh', { g: 0.35, dur: 1.8, p0: -0.6, p1: 0.6, low: true });
  sfx(T.compress, 'suck', { g: 0.85, dur: T.s5 - T.compress });
  sfx(T.s5, 'impact', { g: 1.0, size: 1.0 }); sfx(T.s5, 'metal', { g: 0.4, pan: 0 });
  // S5
  sfx(22.75, 'whoosh', { g: 0.45, dur: 1.0, p0: -0.5, p1: 0.5 });
  PULSE5.forEach((p0, i) => { sfx(p0, 'pulse', { g: 0.45 + i * 0.015 }); if (i % 2 === 0) sfx(p0, 'ping', { g: 0.1, f: 440, pan: 0 }); });
  for (let i = 0; i < 18; i++) sfx(23.25 + i * 0.04, 'tick', { g: 0.13, f: 3000 - i * 60, pan: (i % 2 ? 0.4 : -0.4) });
  sfx(23.4, 'stream', { g: 0.55, dur: T.peak - 23.4 });
  sfx(24.2, 'glitch', { g: 0.22, pan: 0.5 });
  FLY.forEach(f => { let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (flyZ(m) > 900) lo = m; else hi = m; } const tp = f.t0 + hi * 1.05; if (tp < T.peak) sfx(tp - 0.25, 'flyby', { g: 0.5, dur: 0.45, pan: clamp(f.X / 500, -1, 1) }); });
  ARCS5.forEach(a => sfx(a.t0, 'tick', { g: 0.1, f: 3400, pan: 0 }));
  sfx(25.95, 'thump', { g: 0.8 }); sfx(25.95, 'whoosh', { g: 0.5, dur: 0.8, p0: 0.8, p1: -0.8 });
  sfx(26.0, 'riser', { g: 0.9, dur: T.peak - 26.0 });
  sfx(T.peak, 'impact', { g: 1.1, size: 1.3 }); sfx(T.peak, 'glitch', { g: 0.5, pan: 0 }); sfx(T.peak, 'metal', { g: 0.5, pan: 0 });
  sfx(T.thaw, 'suck', { g: 0.8, dur: T.iris - T.thaw });
  sfx(T.iris, 'thump', { g: 0.9 }); sfx(T.iris, 'click', { g: 0.8, pan: 0 });
  sfx(T.iris + 0.02, 'swell', { g: 0.35, dur: 0.7, air: true });
  // S6
  sfx(T.s6, 'chord', { g: 0.55, dur: DUR - T.s6 + 0.2 });
  for (let i = 0; i < 12; i++) sfx(29.0 + i * 0.04, 'type', { g: 0.12, pan: (i - 6) * 0.05 });
  for (let i = 0; i < 9; i++) sfx(29.4 + i * 0.045, 'tick', { g: 0.13, f: 800 + i * 30, pan: (i - 4) * 0.12 });
  sfx(30.45, 'drawtex', { g: 0.2, dur: 0.85, p0: -0.5, p1: 0.5 });
  sfx(31.4, 'ping', { g: 0.4, f: 1760, pan: 0.55 }); sfx(31.4, 'click', { g: 0.6, pan: 0.55 });
  return SFX;
}

async function boot() {
  await Promise.all([
    document.fonts.load('800 50px Archivo'), document.fonts.load('900 expanded 50px Archivo'), document.fonts.load('italic 50px "Instrument Serif"'),
    document.fonts.load('400 20px JBM'), document.fonts.load('500 20px JBM'),
  ]);
  const cv = document.getElementById('c');
  ctx = cv.getContext('2d');
  buildBG();
  buildParticles();
  IRIS = (() => { const c = camAt(T.iris), p = proj(c, C5); return [p.x, p.y]; })();
  registerSFX();
  window.renderFrame = renderFrame;
  window.FILM = { DUR, FPS, T, SFX };
  window.READY = true;
}
