// ---------------------------------------------------------------------------
// HORMUZ — timeline, scenes and render loop.
// One continuous visual system: every layer lives in one azimuthal-equidistant
// plane centred on the Strait (km). The camera travels from ~7 km to the planet.
// ---------------------------------------------------------------------------
'use strict';

const DUR = 36.5;
const NF = Math.round(DUR * FPS);

// ---------------------------------------------------------------- beats (s)
const B = {
  line: 0.3, q1: 0.8, q2: 1.7, pinch: 2.3, qOut: 3.9,
  reveal0: 3.6, reveal1: 9.8,
  lanes0: 0.0, dim0: 5.3, dim1: 8.4,
  hz0: 7.2, hz1: 10.8,
  gate: 10.6, big0: 12.4, accel: 16.2, STOP: 17.8,
  status: 18.3, queue0: 19.2, queue1: 22.4,
  bn0: 21.2, bn1: 23.9,
  price0: 23.9, lathe0: 25.9, lathe1: 27.3, ripple0: 27.1, ripple1: 31.0,
  final0: 31.2, foot: 32.6,
};
window.BEATS = B;

// ---------------------------------------------------------------- projection (JS twin of prep)
const R_E = 6371.0088, LON0 = 56.35, LAT0 = 26.55;
function proj(lon, lat) {
  const l = lon * DEG, p = lat * DEG, l0 = LON0 * DEG, p0 = LAT0 * DEG;
  const cosc = clamp(Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l - l0), -1, 1);
  const c = Math.acos(cosc);
  const k = c < 1e-9 ? 1 : c / Math.sin(c);
  return [R_E * k * Math.cos(p) * Math.sin(l - l0),
          R_E * k * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l - l0))];
}

// ---------------------------------------------------------------- data
let GEO, RT, QUEUE, BRENT;
let routes = [], trunk, parts = [], laneLines = [];
const CITIES = [
  ['SINGAPORE', 103.82, 1.35, 1], ['SHANGHAI', 121.47, 31.23, -1],
  ['TOKYO', 139.69, 35.69, 1], ['ROTTERDAM', 4.48, 51.92, -1],
].map(([n, lo, la, side]) => { const [x, y] = proj(lo, la); return { n, x, y, d: Math.hypot(x, y), side }; });

async function loadData() {
  const j = u => fetch(u + '?v=' + Date.now(), { cache: 'no-store' }).then(r => r.json());
  [GEO, RT, QUEUE, BRENT] = await Promise.all([
    j('../data/geo.json'), j('../data/routes.json'), j('../data/queue.json'), j('../data/brent_eia.json')]);
  BRENT.v = BRENT.weeks.flatMap(w => w[1]);
  trunk = makePath(RT.trunk.x, RT.trunk.y);
  // arc length of the trunk vertex nearest the narrows
  let best = 1e9; trunk.s0 = 0;
  for (let i = 0; i < trunk.n; i++) { const d = Math.hypot(trunk.x[i], trunk.y[i]); if (d < best) { best = d; trunk.s0 = trunk.L[i]; } }
  // traffic-separation scheme: two 2-mile lanes (3.2 km) either side of a 2-mile buffer
  for (const off of [-4.8, -1.6, 1.6, 4.8]) {
    const xs = [], ys = [], q = [0, 0, 0, 0];
    for (let s = trunk.s0 - 140; s <= trunk.s0 + 150; s += 1.2) {
      sampleP(trunk, s, q);
      xs.push(q[0] + q[3] * off); ys.push(q[1] - q[2] * off);
    }
    laneLines.push({ x: xs, y: ys, off });
  }
  routes = RT.routes.map(r => Object.assign(makePath(r.x, r.y), { from: r.from, to: r.to }));
}

// ---------------------------------------------------------------- flow clock
// Ship speed scales with camera altitude (a time-lapse that keeps screen speed
// steady); speedMul accelerates before the stop and is 0 after it.
function speedMul(t) {
  if (t >= B.STOP) return 0;
  return track([[0, 1], [B.accel, 1], [B.STOP - 0.05, 3.2, E.inQuad]], t);
}
let FLOW = null;
function buildFlow() {
  const dt = 1 / 600, n = Math.ceil((DUR + 1) / dt);
  FLOW = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) {
    const t = i * dt;
    FLOW[i] = FLOW[i - 1] + speedMul(t) * track([[0, 0.42], [3.0, 0.5], [5.5, 1]], t) * camKeys(t).viewH * 0.3 * dt;
  }
}
const flowAt = t => FLOW[clamp(Math.round(t * 600), 0, FLOW.length - 1)];

// ---------------------------------------------------------------- particles
const SRC_W = { 'Ras Tanura': 16, 'Juaymah': 6, 'Basrah': 12, 'Kuwait': 8, 'Kharg': 7, 'Ras Laffan': 12,
  'Das Island': 6, 'Ruwais': 7, 'Jebel Ali': 10, 'Mesaieed': 5, 'Bahrain': 3, 'Bandar Abbas': 8 };
const DST_W = { 'Asia': 45, 'India': 25, 'Red Sea': 18, 'Cape': 12 };
function buildParticles() {
  const rnd = mulberry32(7);
  const pick = (w) => { const tot = Object.values(w).reduce((a, b) => a + b, 0); let r = rnd() * tot; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return Object.keys(w)[0]; };
  const N = 1500;
  for (let i = 0; i < N; i++) {
    const f = pick(SRC_W), d = pick(DST_W);
    const r = routes.find(q => q.from === f && q.to === d);
    parts.push({ r, dir: rnd() < 0.72 ? 1 : -1, ph: rnd() * 6000, v: 0.8 + rnd() * 0.45,
      j: (rnd() * 2 - 1), gap: 300 + rnd() * 1200, sz: 0.8 + rnd() * 0.6, ord: 0 });
  }
  // heroes: the opening lines (outbound + inbound through the narrows)
  const hr = routes.find(q => q.from === 'Ras Tanura' && q.to === 'Asia');
  const sN = hr.L[nearestIdx(hr)];
  parts[0] = { r: hr, dir: 1, ph: 0, v: 1, j: 0.1, gap: 0, sz: 1.2, hero: true };
  parts[1] = { r: routes.find(q => q.from === 'Jebel Ali' && q.to === 'India'), dir: -1, ph: 0, v: 1, j: -0.2, gap: 0, sz: 1.1, hero: true };
  parts[2] = { r: routes.find(q => q.from === 'Ras Laffan' && q.to === 'Asia'), dir: 1, ph: 0, v: 1, j: -0.35, gap: 0, sz: 1, hero: true };
  // solve phases so heroes sit near the narrows early in the film
  const f2 = flowAt(2.2), f3 = flowAt(3.2), f35 = flowAt(3.4);
  parts[0].ph = sN - f2 + 1;
  parts[0].gap = 1e7;
  const r1 = parts[1].r; parts[1].ph = (r1.len - r1.L[nearestIdx(r1)]) - f3 - 6; parts[1].gap = 1e7;
  const r2 = parts[2].r; parts[2].ph = r2.L[nearestIdx(r2)] - f35 - 14; parts[2].gap = 1e7;
  // reveal order: by distance from the narrows at t = 4.5 s
  const q = [0, 0, 0, 0], tmp = [];
  parts.forEach((p, i) => { const ok = partPos(p, 4.6, q); tmp.push([ok ? Math.hypot(q[0], q[1]) : 1e9, i]); });
  tmp.sort((a, b) => a[0] - b[0]).forEach(([, i], k) => parts[i].ord = parts[i].hero ? -1 : k);
}
function nearestIdx(pth) {
  let b = 1e9, bi = 0;
  for (let i = 0; i < pth.n; i++) { const d = Math.hypot(pth.x[i], pth.y[i]); if (d < b) { b = d; bi = i; } }
  return bi;
}
// position of particle at time t (with lateral lane offset); returns visibility alpha
function partPos(p, t, out, back = 0) {
  const pth = p.r;
  const cyc = pth.len + p.gap;
  let s = ((p.ph + p.v * flowAt(t)) % cyc + cyc) % cyc - back;
  if (s < 0 || s > pth.len) return 0;
  const sp = p.dir > 0 ? s : pth.len - s;
  sampleP(pth, sp, out);
  const tx = out[2] * p.dir, ty = out[3] * p.dir;
  const dist = Math.hypot(out[0], out[1]);
  const spread = Math.min(36, 0.9 + Math.max(0, dist - 22) * 0.1);
  const off = 3.2 + p.j * spread;
  out[0] += ty * off; out[1] += -tx * off;                   // right of travel
  const a = Math.min(1, s / 40, (pth.len - s) / 40);
  return Math.max(0, a);
}

// ---------------------------------------------------------------- camera
function camKeys(t) {
  const tx = track([[0, 2], [4.4, 2], [9.8, 150, E.inOutCubic], [17.8, 175, E.inOutSine], [18.6, 175], [23.9, -30, E.inOutCubic],
                    [26.2, 215, E.inOutCubic], [31.0, 0, E.inOutCubic]], t);
  const ty = track([[0, -2], [4.4, 7], [9.8, -130, E.inOutCubic], [17.8, -150, E.inOutSine], [18.6, -150], [23.9, 40, E.inOutCubic],
                    [26.2, 30, E.inOutCubic], [31.0, 0, E.inOutCubic]], t);
  const viewH = track([[0, 6.5], [2.4, 8.5, E.inOutSine], [4.4, 72, E.inOutCubic], [9.8, 760, E.inOutCubic],
                       [17.8, 600, E.inOutSine], [18.6, 600], [23.9, 470, E.inOutCubic], [26.2, 700, E.inOutCubic],
                       [31.0, 21000, E.inOutCubic], [DUR, 22500, E.outQuad]], t, true);
  const pitch = track([[0, 0], [2.4, 0], [4.4, 10, E.inOutSine], [9.8, 44, E.inOutCubic], [17.8, 53, E.inOutSine],
                       [18.6, 53], [23.9, 53, E.inOutCubic], [26.2, 60, E.inOutCubic], [31.0, 26, E.inOutCubic], [DUR, 20, E.outQuad]], t);
  const yaw = track([[0, -24], [4.4, -20, E.inOutSine], [9.8, -9, E.inOutCubic], [17.8, 10, E.inOutSine], [18.6, 10],
                     [23.9, 3, E.inOutCubic], [26.2, 6, E.inOutCubic], [31.0, 12, E.inOutCubic], [DUR, 15, E.outQuad]], t);
  const ox = track([[0, 0], [28.5, 0], [31.0, 440, E.inOutCubic]], t);
  const oy = track([[0, 0], [28.5, 0], [31.0, 10, E.inOutCubic]], t);
  return { tx, ty, viewH, pitch, yaw, ox, oy };
}

// ---------------------------------------------------------------- canvases
const out = document.getElementById('out');
const octx = out.getContext('2d');
const main = mkCanvas(W * SS, H * SS), ctx = main.getContext('2d');
const emit = mkCanvas(W / 2, H / 2), ectx = emit.getContext('2d');
const blurA = mkCanvas(W / 2, H / 2), bactx = blurA.getContext('2d');
const blurB = mkCanvas(W / 4, H / 4), bbctx = blurB.getContext('2d');
const grain = [];
function buildGrain() {
  const rnd = mulberry32(99);
  for (let k = 0; k < 6; k++) {
    const c = mkCanvas(W, H), g = c.getContext('2d');
    const im = g.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      const v = (rnd() + rnd() + rnd()) / 3 * 255;
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0); grain.push(c);
  }
}

// state shared by a frame
let cam, t, accK, stopK;

// accent colour: lime while flowing, stone once the flow stops
function acc(a = 1) { return rgba(mixc(C.lime, C.stone, stopK), a); }

// ---------------------------------------------------------------- layers
function drawBackground(c) {
  const g = c.createRadialGradient(W * 0.55, H * 0.42, 0, W * 0.55, H * 0.42, W * 0.75);
  g.addColorStop(0, rgba(C.bg1)); g.addColorStop(1, rgba(C.bg0));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

function topoLayer(c, lines, alpha, ex, exSea, lw = 0.6) {
  if (alpha <= 0.01) return;
  // group by level so each level is one stroke
  const groups = new Map();
  for (const ln of lines) { if (!groups.has(ln.e)) groups.set(ln.e, []); groups.get(ln.e).push(ln); }
  const levels = [...groups.keys()].sort((a, b) => a - b);
  for (const e of levels) {
    let col, a;
    if (e < 0) {
      const k = clamp(-e / 3000);
      col = mixc(C.teal, C.tealHi, 1 - k * 0.6); a = (e > -100 ? 0.36 : 0.42) * alpha;
    } else {
      const k = clamp(e / 3500);
      col = mixc(C.emer, [150, 190, 160], k * 0.8);
      a = (e % 500 === 0 ? 0.42 : 0.22) * (0.55 + 0.45 * k) * alpha;
    }
    c.strokeStyle = rgba(col, a);
    c.lineWidth = lw;
    c.beginPath();
    const z = e < 0 ? e / 1000 * exSea : e / 1000 * ex;
    for (const ln of groups.get(e)) path3(c, cam, ln.x, ln.y, z);
    c.stroke();
  }
}

function landFill(c, worldFade, aS) {
  // radial fade so the far side of the planet dissolves at world scale
  const q = [0, 0, 0];
  cam.P(0, 0, 0, q);
  let fill = rgba(C.land);
  if (worldFade > 0) {
    const r1 = 9000 * cam.pxPerKm, r2 = 15000 * cam.pxPerKm;
    const g = c.createRadialGradient(q[0], q[1], r1 * 0.2, q[0], q[1], r2);
    g.addColorStop(0, rgba(C.land)); g.addColorStop(r1 / r2, rgba(mixc(C.land, C.bg0, 0.35)));
    g.addColorStop(1, rgba(C.bg0, 0)); fill = g;
  }
  c.fillStyle = fill;
  const polys = (arr) => { for (const p of arr) { c.beginPath(); path3(c, cam, p.outer.x, p.outer.y, 0, true); for (const h of p.holes) path3(c, cam, h.x, h.y, 0, true); c.fill('evenodd'); } };
  polys(GEO.landLo.concat(GEO.landHi));
  if (aS < 1) { c.globalAlpha = 1 - aS; polys(GEO.landHiIn); }
  if (aS > 0) { c.globalAlpha = aS; polys(GEO.landStrait); }
  c.globalAlpha = 1;
  // coast
  const ca = 0.44 * (1 - 0.35 * worldFade);
  c.lineWidth = 0.6;
  c.strokeStyle = rgba(C.cream, ca);
  c.beginPath();
  for (const p of GEO.landHi) coast3(c, cam, p.outer);
  for (const p of GEO.landLo) coast3(c, cam, p.outer);
  c.stroke();
  for (const [arr, a] of [[GEO.landHiIn, 1 - aS], [GEO.landStrait, aS]]) {
    if (a <= 0) continue;
    c.strokeStyle = rgba(C.cream, ca * a);
    c.beginPath();
    for (const p of arr) { coast3(c, cam, p.outer); for (const h of p.holes) coast3(c, cam, h); }
    c.stroke();
  }
  // borders, dotted
  c.setLineDash([1.2, 3.2]);
  c.strokeStyle = rgba(C.cream, 0.20 * (1 - worldFade));
  c.beginPath();
  for (const b of GEO.borders) path3(c, cam, b.x, b.y, 0);
  c.stroke();
  c.setLineDash([]);
}

// faint network of routes, revealed outward from the narrows
function drawRoutes(c, glow) {
  const rev = track([[B.reveal0 + 0.6, 0], [B.reveal1 - 0.4, 3200, E.inOutCubic]], t);
  if (rev <= 0) return;
  const fade = 1 - seg(t, B.STOP, B.STOP + 1.2) * 0.55 - seg(t, B.price0, B.ripple0) * 0.45;
  const a = (glow ? 0.05 : 0.045) * fade * (1 - seg(t, 27, 30));
  if (a <= 0) return;
  c.strokeStyle = acc(a);
  c.lineWidth = glow ? 1.4 : 0.8;
  c.beginPath();
  for (const r of routes) {
    let pen = false;
    for (let i = 0; i < r.n; i++) {
      if (Math.hypot(r.x[i], r.y[i]) > rev) { pen = false; continue; }
      if (!cam.P(r.x[i], r.y[i], 0, _p)) { pen = false; continue; }
      if (pen) c.lineTo(_p[0], _p[1]); else { c.moveTo(_p[0], _p[1]); pen = true; }
    }
  }
  c.stroke();
}

// traffic-separation-scheme lane edges: the abstract parallel geometry of the opening
function drawLanes(c) {
  const a = 0.34 * (1 - seg(t, 7.5, 10.2)) * seg(t, 0.2, 1.6);
  if (a <= 0.005) return;
  c.setLineDash([6, 5]);
  c.lineWidth = 0.6;
  for (const ln of laneLines) {
    c.strokeStyle = rgba(C.cream, Math.abs(ln.off) > 3 ? a : a * 0.55);
    c.beginPath(); path3(c, cam, ln.x, ln.y, 0); c.stroke();
  }
  c.setLineDash([]);
}

// ships
const q4 = [0, 0, 0, 0], q4b = [0, 0, 0, 0];
function drawParticles(c, glow) {
  const vis = track([[0, 1], [1.3, 1], [3.9, 14, E.inQuad], [5.0, 60, E.inQuad], [9.4, parts.length, E.inOutQuad]], t);
  const pxkm = cam.pxPerKm;
  const heroLen = 46;
  const trailK = seg(t, 3.6, 7.0);
  const baseTrail = 18 * (1 + 1.4 * seg(t, B.accel, B.STOP, E.inQuad)) / pxkm;
  const fadeQ = (x, y) => {                                     // particles give way to the queue lattice
    if (t < B.queue0) return 1;
    const inGulf = x < 10;
    const wave = track([[B.queue0, 0], [B.queue1, 700, E.inOutCubic]], t);
    if (!inGulf) return 1 - seg(t, B.STOP + 0.8, B.STOP + 3.4);
    return Math.hypot(x + 20, y + 5) < wave ? 0 : 1;
  };
  const end = seg(t, B.bn1 - 0.6, B.price0 + 1.0);
  const trails = [new Path2D(), new Path2D(), new Path2D()];
  const heads = new Path2D();
  const ext = glow ? 1 : 0;
  for (const p of parts) {
    if (!p.hero && p.ord > vis) continue;
    const a0 = partPos(p, t, q4);
    if (a0 <= 0) continue;
    const fq = fadeQ(q4[0], q4[1]) * (1 - end);
    if (fq <= 0.01) continue;
    if (!cam.P(q4[0], q4[1], 0, _p)) continue;
    const hx = _p[0], hy = _p[1];
    if (hx < -60 || hx > W + 60 || hy < -60 || hy > H + 60) continue;
    const len = p.hero ? lerp(heroLen * seg(t, B.line, 2.8, E.outCubic), baseTrail, trailK) : lerp(heroLen * 0.7, baseTrail, trailK);
    // trail: 3 segments of decreasing alpha
    let px = hx, py = hy;
    for (let k = 0; k < 3; k++) {
      const bk = len * (k + 1) / 3;
      const a1 = partPos(p, t, q4b, bk * p.v);
      if (a1 <= 0 || !cam.P(q4b[0], q4b[1], 0, _p)) break;
      const pth = trails[k];
      // sub-steps for long (curved) hero trails
      const steps = len * pxkm > 120 ? 6 : 1;
      pth.moveTo(px, py);
      for (let s = 1; s <= steps; s++) {
        const bb = len * (k + s / steps) / 3;
        if (partPos(p, t, q4b, bb * p.v) > 0 && cam.P(q4b[0], q4b[1], 0, _p)) pth.lineTo(_p[0], _p[1]);
      }
      px = _p[0]; py = _p[1];
    }
    const r = (p.hero ? 1.5 : 1.15) * p.sz * (1 + ext * 1.5);
    heads.moveTo(hx + r, hy); heads.arc(hx, hy, r, 0, TAU);
  }
  const A = 1 - end;
  const hollow = seg(t, B.STOP, B.STOP + 0.7);
  c.lineCap = 'round';
  const tw = glow ? 1.8 : 0.9;
  [0.75, 0.38, 0.12].forEach((a, k) => { c.strokeStyle = acc(a * A); c.lineWidth = tw; c.stroke(trails[k]); });
  c.globalAlpha = A;
  if (hollow < 1) { c.fillStyle = acc(1 - hollow); c.fill(heads); }
  if (hollow > 0 && !glow) { c.strokeStyle = rgba(C.stone, 0.8 * hollow); c.lineWidth = 0.7; c.stroke(heads); }
  c.globalAlpha = 1;
  c.lineCap = 'butt';
}

// screen point of a lon/lat (or km) at elevation
function sp(x, y, z = 0) { const q = [0, 0, 0]; return cam.P(x, y, z, q) ? q : null; }

// ---------------------------------------------------------------- annotations
const NARROW_A = proj(56.49, 26.43), NARROW_B = proj(56.40, 26.84);   // Musandam ↔ Larak side
function drawDimension(c) {
  const a = env(t, B.dim0, B.dim0 + 0.8, B.dim1, B.dim1 + 0.8);
  const g = env(t, B.gate, B.gate + 0.5, B.STOP, B.STOP + 0.01) ;
  const shut = seg(t, B.STOP, B.STOP + 0.9, E.outExpo) * (1 - seg(t, B.bn0, B.bn0 + 0.6));
  if (a + g + shut <= 0.01) return;
  const A = sp(NARROW_A[0], NARROW_A[1]), Bp = sp(NARROW_B[0], NARROW_B[1]);
  if (!A || !Bp) return;
  const dx = Bp[0] - A[0], dy = Bp[1] - A[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  const draw = seg(t, B.dim0, B.dim0 + 1.0, E.outCubic);
  if (a > 0.01) {
    c.strokeStyle = rgba(C.cream, 0.85 * a); c.lineWidth = 0.8;
    const ex = A[0] + dx * draw, ey = A[1] + dy * draw;
    c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(ex, ey);
    for (const P of [A, [ex, ey]]) { c.moveTo(P[0] - nx * 6, P[1] - ny * 6); c.lineTo(P[0] + nx * 6, P[1] + ny * 6); }
    c.stroke();
    const ux = dx / L, uy = dy / L, mx = Bp[0] + ux * 26 + 30, my = Bp[1] + uy * 26 + 18;
    c.save(); c.globalAlpha = a * seg(t, B.dim0 + 0.5, B.dim0 + 1.2);
    label(c, '21 MI', mx, my, { px: 14, wg: 500, track: 0.16, fill: rgba(C.cream, 0.95) });
    label(c, 'AT ITS NARROWEST', mx, my + 17, { px: 10, track: 0.22, fill: rgba(C.cream, 0.6) });
    label(c, 'SHIPPING LANES: 2 MI EACH WAY', mx, my + 31, { px: 10, track: 0.22, fill: rgba(C.cream, 0.6) });
    c.restore();
  }
  if (g > 0.01) {                       // the gate: where flow is counted
    c.strokeStyle = acc(0.9 * g); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(Bp[0], Bp[1]); c.stroke();
  }
  if (shut > 0.01) {                   // the closure
    c.strokeStyle = rgba(C.cream, 0.95 * shut); c.lineWidth = 2.2;
    const k = shut;
    c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(A[0] + dx * k, A[1] + dy * k); c.stroke();
    c.beginPath();
    for (const P of [A, Bp]) { c.moveTo(P[0] - nx * 9, P[1] - ny * 9); c.lineTo(P[0] + nx * 9, P[1] + ny * 9); }
    c.stroke();
  }
}

const LABELS = [
  { s: 'IRAN', ll: [55.2, 28.6], big: true },
  { s: 'OMAN', ll: [57.4, 22.6], big: true },
  { s: 'UAE', ll: [54.2, 23.7], big: true, small: true },
  { s: 'SAUDI ARABIA', ll: [49.6, 25.2], big: true, small: true },
  { s: 'PERSIAN GULF', ll: [51.9, 27.05] },
  { s: 'GULF OF OMAN', ll: [58.3, 24.6] },
  { s: 'ARABIAN SEA', ll: [62.0, 20.3] },
  { s: 'MUSANDAM', ll: [56.22, 25.95], tiny: true, early: true },
  { s: 'LARAK', ll: [56.37, 26.93], tiny: true, early: true },
].map(o => Object.assign(o, { xy: proj(o.ll[0], o.ll[1]) }));
function drawLabels(c) {
  const on = seg(t, 6.2, 8.2) * (1 - seg(t, B.STOP + 0.2, B.STOP + 1.0));
  const early = env(t, 3.4, 4.4, 6.6, 7.6);
  for (const L of LABELS) {
    const a = L.early ? early : on;
    if (a < 0.01) continue;
    const P = sp(L.xy[0], L.xy[1]);
    if (!P) continue;
    c.save(); c.globalAlpha = a;
    if (L.tiny) label(c, L.s, P[0], P[1], { px: 10, track: 0.3, fill: rgba(C.cream, 0.55), align: 'center' });
    else if (L.big) {
      c.textBaseline = 'middle';
      typeset(c, L.s, P[0], P[1], { px: L.small ? 15 : 24, wd: 125, wg: 450, track: L.small ? 7 : 13, align: 'center', fill: rgba(C.cream, L.small ? 0.42 : 0.62) });
      c.textBaseline = 'alphabetic';
    } else label(c, L.s, P[0], P[1], { px: 11, track: 0.34, fill: rgba([150, 200, 190], 0.62), align: 'center' });
    c.restore();
  }
  // strait callout with a leader
  const a = env(t, 7.4, 8.4, B.STOP + 0.6, B.STOP + 1.4);
  if (a > 0.01) {
    const P = sp(0, 0);
    if (P) {
      const lx = P[0] + 70, ly = P[1] - 118;
      c.strokeStyle = rgba(C.cream, 0.6 * a); c.lineWidth = 0.7;
      const d = seg(t, 7.4, 8.2, E.outCubic);
      c.beginPath(); c.moveTo(P[0], P[1] - 8); c.lineTo(lerp(P[0], lx, d), lerp(P[1] - 8, ly, d)); c.lineTo(lerp(P[0], lx, d) + 120 * seg(t, 7.9, 8.5), lerp(P[1] - 8, ly, d)); c.stroke();
      c.save(); c.globalAlpha = a * seg(t, 7.9, 8.6);
      label(c, 'STRAIT OF HORMUZ', lx + 4, ly - 8, { px: 12, wg: 500, track: 0.28, fill: rgba(C.cream, 0.95) });
      c.restore();
    }
  }
}

// ---------------------------------------------------------------- HORMUZ (the word as geography)
function drawHormuzWord(c) {
  const a = env(t, B.hz0, B.hz0 + 0.9, B.hz1 - 1.0, B.hz1, E.outCubic, E.inOutSine);
  if (a < 0.005) return;
  const k = seg(t, B.hz0, B.hz1, E.inOutSine);
  const wd = lerp(75, 125, k);
  c.save();
  c.globalAlpha = a;
  c.textBaseline = 'middle';
  const px = 330;
  const trk = lerp(-8, 70, k);
  typeset(c, 'HORMUZ', W / 2, H * 0.5 + lerp(20, -10, k), {
    px, wd, wg: 850, track: trk, align: 'center', stroke: rgba(C.cream, 0.30), lw: 1.2,
    perLetter: (i, n) => { const d = (i - (n - 1) / 2); return { dx: d * lerp(0, 40, k) }; },
  });
  c.restore();
}

// ---------------------------------------------------------------- the question
function drawQuestion(c) {
  const a = 1 - seg(t, B.qOut - 0.2, B.qOut + 0.6);
  if (a <= 0.005) return;
  const x = 150, y = 790;
  c.save(); c.globalAlpha = a;
  c.textBaseline = 'alphabetic';
  const words1 = ['What', 'happens', 'when', 'the', "world's"];
  let cx = x;
  const px = 50;
  words1.forEach((w, i) => {
    const k = seg(t, B.q1 + i * 0.11, B.q1 + i * 0.11 + 0.7, E.outCubic);
    c.save(); c.globalAlpha *= k;
    cx += typeset(c, w, cx, y + (1 - k) * 12, { px, wd: 100, wg: 300, fill: rgba(C.cream) }) + 14;
    c.restore();
  });
  // line 2: the highway narrows — tracking and width compress with the pinch
  const pinch = seg(t, B.pinch, B.qOut, E.inOutCubic);
  const words2 = ['energy', 'highway'];
  cx = x;
  words2.forEach((w, i) => {
    const k = seg(t, B.q2 + i * 0.12, B.q2 + i * 0.12 + 0.7, E.outCubic);
    c.save(); c.globalAlpha *= k;
    cx += typeset(c, w, cx, y + 64 + (1 - k) * 12, { px, wd: lerp(112, 100, pinch), wg: 300, track: lerp(5, 0, pinch), fill: rgba(C.cream) }) + 14;
    c.restore();
  });
  const k3 = seg(t, B.q2 + 0.3, B.q2 + 1.0, E.outCubic);
  c.save(); c.globalAlpha *= k3;
  cx += typeset(c, 'narrows', cx, y + 64 + (1 - k3) * 12, { px, wd: lerp(125, 75, pinch), wg: 300, track: lerp(14, -2, pinch), fill: rgba(C.cream) }) + 14;
  c.restore();
  const k4 = seg(t, B.q2 + 0.45, B.q2 + 1.1, E.outCubic);
  c.save(); c.globalAlpha *= k4;
  typeset(c, 'to this?', cx, y + 64 + (1 - k4) * 12, { px, wd: 100, wg: 700, fill: acc(1) });
  c.restore();
  c.restore();
}

// ---------------------------------------------------------------- 20% monolith
let MONO = null;
function buildMonolith() {
  const w = 1500, h = 620;
  const sil = mkCanvas(w, h), sc = sil.getContext('2d');
  sc.font = `560px M100_850`; sc.textBaseline = 'alphabetic'; sc.textAlign = 'center';
  sc.letterSpacing = '-18px';
  sc.fillStyle = '#fff'; sc.fillText('20%', w / 2, h - 40);
  const face = mkCanvas(w, h);
  MONO = { w, h, sil, face, base: h - 40 };
}
const MONO_AT = proj(58.9, 24.05);
function monolithAffine(rise, depth = 0) {
  // plane faces the camera: x along screen-right, y up (world z)
  const kmPerPx = 0.36;                      // ~220 km tall glyphs
  const Y = 0.5 * DEG;                        // fixed facing: the camera orbits around it
  const hx = Math.sin(Y), hy = Math.cos(Y);
  const ox = MONO_AT[0] + hx * depth, oy = MONO_AT[1] + hy * depth;
  const rx = Math.cos(Y), ry = -Math.sin(Y);
  const p0 = sp(ox - rx * MONO.w / 2 * kmPerPx, oy - ry * MONO.w / 2 * kmPerPx, (MONO.base * kmPerPx) - (1 - rise) * MONO.base * kmPerPx);
  const pX = sp(ox + rx * MONO.w / 2 * kmPerPx, oy + ry * MONO.w / 2 * kmPerPx, (MONO.base * kmPerPx) - (1 - rise) * MONO.base * kmPerPx);
  const pY = sp(ox - rx * MONO.w / 2 * kmPerPx, oy - ry * MONO.w / 2 * kmPerPx, -(1 - rise) * MONO.base * kmPerPx);
  if (!p0 || !pX || !pY) return null;
  // local (0,0) = top-left; local y down. base line at local y = MONO.base maps to world z = rise-offset
  // derive: screen = e + a*u + c*v
  const a = (pX[0] - p0[0]) / MONO.w, b = (pX[1] - p0[1]) / MONO.w;
  const cc = (pY[0] - p0[0]) / MONO.base, d = (pY[1] - p0[1]) / MONO.base;
  // pY is local (0, base); p0 is local (0, 0)
  return [a, b, cc, d, p0[0], p0[1]];
}
function drawMonolith(c, glow) {
  const rise = seg(t, B.big0, B.big0 + 1.6, E.outQuint) * (1 - seg(t, B.STOP + 0.4, B.STOP + 2.2, E.inCubic));
  const vis = env(t, B.big0, B.big0 + 0.3, B.STOP + 1.6, B.STOP + 2.4);
  if (vis < 0.01 || rise < 0.001) return;
  // flowing face: streams of light running through the glyphs
  const f = MONO.face, fc = f.getContext('2d');
  if (!glow) {
    fc.globalCompositeOperation = 'source-over';
    fc.clearRect(0, 0, f.width, f.height);
    fc.drawImage(MONO.sil, 0, 0);
    fc.globalCompositeOperation = 'source-in';
    fc.fillStyle = rgba(mixc([6, 26, 20], C.stone, stopK * 0.12)); fc.fillRect(0, 0, f.width, f.height);
    fc.globalCompositeOperation = 'source-atop';
    const rnd = mulberry32(5);
    const flow = flowAt(t) * 0.9;
    for (let i = 0; i < 170; i++) {
      const yy = 40 + rnd() * (f.height - 80);
      const sp_ = 0.6 + rnd() * 0.8, len = 80 + rnd() * 260;
      const x0 = ((rnd() * 4000 + flow * sp_ * 3.2) % (f.width + len)) - len;
      const g = fc.createLinearGradient(x0, 0, x0 + len, 0);
      g.addColorStop(0, acc(0)); g.addColorStop(0.85, acc(0.9 - stopK * 0.5)); g.addColorStop(1, rgba(C.cream, 1 - stopK * 0.6));
      fc.strokeStyle = g; fc.lineWidth = 1.5 + rnd() * 3.5;
      fc.beginPath(); fc.moveTo(x0, yy); fc.lineTo(x0 + len, yy); fc.stroke();
    }
    fc.globalCompositeOperation = 'source-over';
  }
  const clipLocal = (cx_) => { cx_.beginPath(); cx_.rect(-50, -2000, MONO.w + 100, 2000 + MONO.base); cx_.clip(); };
  c.save();
  c.globalAlpha = vis;
  if (!glow) {
    // extrusion: stacked silhouettes from back to front
    const N = 26;
    for (let k = N; k >= 1; k--) {
      const m = monolithAffine(rise, k * 1.5);
      if (!m) continue;
      c.save(); c.setTransform(m[0] * SS, m[1] * SS, m[2] * SS, m[3] * SS, m[4] * SS, m[5] * SS);
      clipLocal(c);
      c.globalAlpha = vis * 0.9;
      c.filter = 'none';
      c.drawImage(tintSil(k / N), 0, 0);
      c.restore();
    }
  }
  const m = monolithAffine(rise, 0);
  if (m) {
    const S = glow ? 0.5 : SS;
    c.setTransform(m[0] * S, m[1] * S, m[2] * S, m[3] * S, m[4] * S, m[5] * S);
    clipLocal(c);
    c.drawImage(f, 0, 0);
    if (!glow) {                                  // crisp edge
      c.globalAlpha = vis * 0.9;
      c.drawImage(tintSil(-1), 0, 0);
    }
  }
  c.restore();
  if (glow) ectx.setTransform(0.5, 0, 0, 0.5, 0, 0); else ctx.setTransform(SS, 0, 0, SS, 0, 0);
}
const _tint = new Map();
function tintSil(k) {
  const key = k < 0 ? 'edge' : Math.round(k * 10);
  if (_tint.has(key)) return _tint.get(key);
  const c = mkCanvas(MONO.w, MONO.h), g = c.getContext('2d');
  if (k < 0) {
    // hairline outline: silhouette minus eroded silhouette
    g.drawImage(MONO.sil, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = rgba(C.cream, 0.55); g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-out';
    g.drawImage(erode(MONO.sil, 3), 0, 0);
  } else {
    g.drawImage(MONO.sil, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = rgba(mixc([16, 58, 46], [5, 20, 16], k)); g.fillRect(0, 0, c.width, c.height);
  }
  _tint.set(key, c);
  return c;
}
function erode(src, r) {
  const c = mkCanvas(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) g.drawImage(src, dx, dy);
  return c;
}

function drawFlowCaptions(c) {
  // counter at the gate
  const a = env(t, B.gate + 0.2, B.gate + 0.8, B.STOP - 0.1, B.STOP + 0.5);
  if (a > 0.01) {
    const P = sp(0, 0);
    if (P) {
      const k = seg(t, B.gate + 0.2, B.gate + 1.8, E.outCubic);
      const val = Math.round(20e6 * k / 1e5) * 1e5;
      const x = P[0] - 380, y = P[1] + 120;
      c.save(); c.globalAlpha = a;
      c.strokeStyle = rgba(C.cream, 0.4); c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(P[0] - 6, P[1] + 8); c.lineTo(x + 330, y - 30); c.lineTo(x, y - 30); c.stroke();
      c.textBaseline = 'alphabetic';
      typeset(c, val.toLocaleString('en-US'), x, y + 22, { px: 52, wd: 90, wg: 450, track: 1, fill: acc(1) });
      label(c, 'BARRELS OF OIL A DAY THROUGH THIS GATE', x, y + 48, { px: 11, track: 0.22, fill: rgba(C.cream, 0.75) });
      label(c, 'EIA · 2024 AVERAGE', x, y + 66, { px: 10, track: 0.22, fill: rgba(C.cream, 0.45) });
      c.restore();
    }
  }
  // captions for the monolith
  const b = env(t, B.big0 + 1.2, B.big0 + 2.0, B.STOP - 0.1, B.STOP + 0.6);
  if (b > 0.01) {
    const P = sp(MONO_AT[0], MONO_AT[1]);
    if (!P) return;
    const x = P[0] - 250, y = P[1] + 64;
    c.save(); c.globalAlpha = b;
    c.strokeStyle = rgba(C.cream, 0.35); c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(x, y - 18); c.lineTo(x + 500 * seg(t, B.big0 + 1.2, B.big0 + 2.2, E.outCubic), y - 18); c.stroke();
    label(c, 'OF THE WORLD’S OIL CONSUMPTION', x, y + 4, { px: 15, wg: 500, track: 0.2, fill: rgba(C.cream, 0.95) });
    c.globalAlpha = b * seg(t, B.big0 + 1.8, B.big0 + 2.6);
    label(c, '+ ~ONE-FIFTH OF GLOBAL LNG TRADE', x, y + 28, { px: 12, track: 0.2, fill: acc(0.9) });
    label(c, 'EIA 2024 · IEA 2025', x, y + 48, { px: 10, track: 0.22, fill: rgba(C.cream, 0.45) });
    c.restore();
  }
}

// ---------------------------------------------------------------- disruption
function drawStatus(c) {
  const a = env(t, B.status, B.status + 0.6, B.bn0 - 0.5, B.bn0 + 0.1);
  if (a < 0.01) return;
  const x = 120, y = 150;
  c.save(); c.globalAlpha = a;
  const k0 = seg(t, B.status, B.status + 0.7, E.outCubic);
  label(c, '28 · 02 · 2026', x, y, { px: 15, wg: 500, track: 0.3, fill: rgba(C.cream, 0.95 * k0) });
  c.strokeStyle = rgba(C.cream, 0.35); c.lineWidth = 0.7;
  c.beginPath(); c.moveTo(x, y + 14); c.lineTo(x + 420 * k0, y + 14); c.stroke();
  const lines = [
    ['U.S. and Israeli strikes on Iran begin.', 0.25],
    ['Iranian forces declare the strait closed.', 0.65],
    ['Cross-strait traffic largely halts.', 1.15],
  ];
  lines.forEach(([s, d], i) => {
    const k = seg(t, B.status + d, B.status + d + 0.7, E.outCubic);
    c.save(); c.globalAlpha *= k;
    typeset(c, s, x, y + 52 + i * 34 + (1 - k) * 8, { px: 25, wd: 100, wg: i === 2 ? 700 : 300, fill: rgba(C.cream, i === 2 ? 1 : 0.85) });
    c.restore();
  });
  c.globalAlpha = a * seg(t, B.status + 1.4, B.status + 2.0);
  label(c, 'CONGRESSIONAL RESEARCH SERVICE · R45281, AUG 2026', x, y + 52 + 3 * 34 - 4, { px: 10, track: 0.22, fill: rgba(C.cream, 0.45) });
  c.restore();
}

function drawQueue(c) {
  const wave = track([[B.queue0, 0], [B.queue1, 700, E.inOutCubic]], t);
  const out_ = 1 - seg(t, B.bn1 - 0.8, B.price0 + 0.8);
  if (wave <= 0 || out_ <= 0) return;
  const qx = QUEUE.x, qy = QUEUE.y;
  const dots = new Path2D();
  const pxkm = cam.pxPerKm;
  const r = Math.max(0.9, Math.min(2.2, 2.4 * pxkm));
  let n = 0;
  for (let i = 0; i < qx.length; i++) {
    const d = Math.hypot(qx[i] + 20, qy[i] + 5);
    if (d > wave) break;
    const k = clamp((wave - d) / 40);
    if (!cam.P(qx[i], qy[i], 0, _p)) continue;
    const rr = r * (0.4 + 0.6 * E.outBack(k));
    dots.moveTo(_p[0] + rr, _p[1]); dots.arc(_p[0], _p[1], rr, 0, TAU);
    n++;
  }
  c.globalAlpha = out_;
  c.strokeStyle = rgba(C.cream, 0.75); c.lineWidth = 0.6; c.stroke(dots);
  c.globalAlpha = 1;
  // count
  const a = env(t, B.queue0 + 0.3, B.queue0 + 0.9, B.bn0 - 0.3, B.bn0 + 0.2);
  if (a > 0.01) {
    const x = 120, y = 860;
    const cnt = Math.min(2000, Math.round(n / 10) * 10 + (n >= 1990 ? 2000 - n : 0));
    c.save(); c.globalAlpha = a;
    typeset(c, '≈ ' + cnt.toLocaleString('en-US'), x, y, { px: 64, wd: 95, wg: 450, fill: rgba(C.cream) });
    label(c, 'SHIPS HELD INSIDE THE GULF', x + 4, y + 30, { px: 12, wg: 500, track: 0.24, fill: rgba(C.cream, 0.85) });
    label(c, '~20,000 SEAFARERS ON BOARD · IMO / UN, MARCH 2026', x + 4, y + 50, { px: 10, track: 0.22, fill: rgba(C.cream, 0.5) });
    label(c, '1 CIRCLE = 1 SHIP', x + 4, y + 68, { px: 10, track: 0.22, fill: rgba(C.cream, 0.5) });
    c.restore();
  }
}

// BOTTLENECK: the word is physically compressed by two closing walls
function drawBottleneck(c) {
  const a = env(t, B.bn0, B.bn0 + 0.35, B.bn1 - 0.15, B.bn1 + 0.25, E.outCubic, E.inQuad);
  if (a < 0.01) return null;
  const P = sp(0, 0);
  const cxs = P ? P[0] : W / 2;
  const k = seg(t, B.bn0 + 0.2, B.bn1 - 0.25, E.inOutCubic);
  const gapL = lerp(cxs - 30, 1, k), gapR = lerp(W - cxs - 30, 1, k);
  const xl = cxs - gapL, xr = cxs + gapR;
  c.save();
  c.globalAlpha = a;
  // walls
  c.strokeStyle = rgba(C.cream, 0.9); c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(xl, 0); c.lineTo(xl, H); c.moveTo(xr, 0); c.lineTo(xr, H); c.stroke();
  // word
  c.beginPath(); c.rect(xl, 0, xr - xl, H); c.clip();
  const avail = Math.max(2, xr - xl - 40);
  const wd = lerp(125, 75, seg(k, 0, 0.55));
  c.textBaseline = 'middle';
  const [font, sx] = monaFont(c, 250, wd, 850, 'BOTTLENECK');
  c.font = font; c.letterSpacing = `${lerp(18, -30, k)}px`;
  const wNat = c.measureText('BOTTLENECK').width * sx;
  const squash = Math.min(1, avail / wNat);
  c.translate(cxs + (xr - cxs - (cxs - xl)) / 2, H / 2 + 10);
  c.scale(sx * squash, 1 + (1 - squash) * 0.15);
  c.textAlign = 'center';
  c.fillStyle = rgba(C.cream, 0.94);
  c.fillText('BOTTLENECK', 0, 0);
  c.letterSpacing = '0px';
  c.restore();
  return cxs;
}

// ---------------------------------------------------------------- price structure → ripple
const PR_R0 = 30, PR_R1 = 440;                  // km, radius of first / last observation
const prZ = v => (v - 58) * 5.2;                 // km per $ (exaggerated)
function prR(i) { return lerp(PR_R0, PR_R1, i / (BRENT.v.length - 1)); }
const WAR_I = 62;                                // first observation after 28 Feb 2026

function drawPrice(c, glow) {
  const vis = env(t, B.price0, B.price0 + 0.3, B.ripple0 + 0.4, B.ripple0 + 1.6, E.outCubic, E.inOutSine);
  if (vis < 0.01) return;
  const v = BRENT.v, n = v.length;
  const zs = 1 - seg(t, B.ripple0 + 0.1, B.ripple0 + 1.5, E.inOutCubic);   // flatten
  const th0 = Math.atan2(cam.ry, cam.rx);      // screen-right direction
  const draw = seg(t, B.price0 + 0.15, B.price0 + 1.6, E.inOutCubic);
  const sweep = seg(t, B.lathe0, B.lathe1, E.inOutCubic) * TAU;
  const axisUp = seg(t, B.price0 - 0.2, B.price0 + 0.4, E.outCubic);
  const zTop = prZ(112);
  c.save(); c.globalAlpha = vis;
  if (!glow) {
    // axis (the compressed word becomes the vertical axis)
    c.strokeStyle = rgba(C.cream, 0.85 * (1 - seg(t, B.lathe0, B.lathe1)));
    c.lineWidth = 1.1;
    c.beginPath(); path3(c, cam, [0, 0], [0, 0], i => i ? zTop * axisUp * zs : 0); c.stroke();
    // gridlines at $70 and $100 on the chart plane
    const gA = (1 - seg(t, B.lathe0, B.lathe0 + 0.6)) * seg(t, B.price0 + 0.2, B.price0 + 0.8);
    if (gA > 0.01) {
      for (const lv of [70, 100]) {
        c.strokeStyle = rgba(C.cream, 0.3 * gA); c.lineWidth = 0.6; c.setLineDash([3, 4]);
        const x1 = Math.cos(th0) * (PR_R1 + 20), y1 = Math.sin(th0) * (PR_R1 + 20);
        c.beginPath(); path3(c, cam, [0, x1], [0, y1], prZ(lv) * zs); c.stroke(); c.setLineDash([]);
        const P = sp(0, 0, prZ(lv) * zs);
        if (P) { c.globalAlpha = vis * gA; label(c, '$' + lv, P[0] - 10, P[1] + 4, { px: 11, track: 0.1, fill: rgba(C.cream, 0.7), align: 'right' }); c.globalAlpha = vis; }
      }
      // war marker
      const rw = prR(WAR_I - 0.5);
      const P0 = sp(Math.cos(th0) * rw, Math.sin(th0) * rw, 0), P1 = sp(Math.cos(th0) * rw, Math.sin(th0) * rw, prZ(112) * zs);
      if (P0 && P1 && draw > 0.84) {
        c.strokeStyle = rgba(C.cream, 0.45 * gA); c.setLineDash([2, 3]);
        c.beginPath(); c.moveTo(P0[0], P0[1]); c.lineTo(P1[0], P1[1]); c.stroke(); c.setLineDash([]);
        c.globalAlpha = vis * gA * seg(draw, 0.84, 0.95);
        label(c, '28 FEB', P1[0] + 6, P1[1] + 12, { px: 10, track: 0.2, fill: rgba(C.cream, 0.7) });
        c.globalAlpha = vis;
      }
    }
  }
  // meridians (profile copies) swept around the strait
  const nm = 48;
  for (let m = 0; m <= nm; m++) {
    const th = th0 - (m / nm) * TAU;
    const isMain = m === 0;
    if (!isMain && (m / nm) * TAU > sweep + 1e-6) break;
    const upto = isMain ? Math.max(2, Math.floor(draw * (n - 1)) + 1) : n;
    const xs = [], ys = [], zz = [];
    for (let i = 0; i < upto; i++) { const r = prR(i); xs.push(Math.cos(th) * r); ys.push(Math.sin(th) * r); zz.push(prZ(v[i]) * zs); }
    // pre-war part
    const split = Math.min(upto, WAR_I);
    c.lineWidth = glow ? 2.2 : (isMain ? 1.6 : 0.6);
    if (!glow) {
      c.strokeStyle = rgba(C.cream, isMain ? 0.9 : 0.28);
      c.beginPath(); path3(c, cam, xs, ys, i => zz[i], false, 0, split); c.stroke();
    }
    if (upto > WAR_I - 1) {
      c.strokeStyle = acc(isMain ? 1 : 0.5);
      c.beginPath(); path3(c, cam, xs, ys, i => zz[i], false, WAR_I - 1, upto); c.stroke();
    }
    // curtain under the main profile
    if (isMain && !glow && sweep < 0.2) {
      c.strokeStyle = acc(0.10 * (1 - sweep / 0.2));
      c.lineWidth = 0.8;
      c.beginPath();
      for (let i = 0; i < upto; i += 1) {
        if (cam.P(xs[i], ys[i], 0, _p)) { c.moveTo(_p[0], _p[1]); if (cam.P(xs[i], ys[i], zz[i], _p)) c.lineTo(_p[0], _p[1]); }
      }
      c.stroke();
    }
  }
  // parallels for the war-period observations, drawn with the sweep
  if (sweep > 0) {
    for (let i = WAR_I - 1; i < n; i += 1) {
      const r = prR(i), z = prZ(v[i]) * zs;
      const steps = 72, xs = [], ys = [];
      for (let s = 0; s <= steps; s++) { const th = th0 - s / steps * sweep; xs.push(Math.cos(th) * r); ys.push(Math.sin(th) * r); }
      c.strokeStyle = acc(glow ? 0.35 : 0.55); c.lineWidth = glow ? 1.6 : 0.7;
      c.beginPath(); path3(c, cam, xs, ys, z); c.stroke();
    }
  }
  // labels on the chart
  if (!glow) {
    const la = (1 - seg(t, B.lathe0 + 0.2, B.lathe0 + 0.8)) * seg(draw, 0.2, 0.5);
    if (la > 0.01) {
      const P = sp(Math.cos(th0) * PR_R0, Math.sin(th0) * PR_R0, prZ(112) * zs);
      if (P) {
        c.globalAlpha = vis * la;
        label(c, 'BRENT CRUDE · SPOT · USD / BARREL', P[0] + 8, P[1] - 20, { px: 11, wg: 500, track: 0.22, fill: rgba(C.cream, 0.9) });
        label(c, 'DEC 2025 → 13 MAR 2026 · EIA', P[0] + 8, P[1] - 4, { px: 10, track: 0.22, fill: rgba(C.cream, 0.5) });
      }
      const le = seg(draw, 0.92, 1.0);
      const Pe = sp(Math.cos(th0) * prR(n - 1), Math.sin(th0) * prR(n - 1), prZ(v[n - 1]) * zs);
      if (Pe && le > 0) {
        c.globalAlpha = vis * la * le;
        typeset(c, '+45%', Pe[0] + 14, Pe[1] + 8, { px: 40, wd: 90, wg: 700, fill: acc(1) });
        label(c, '$71 → $103 IN TWO WEEKS', Pe[0] + 16, Pe[1] + 30, { px: 10, track: 0.2, fill: rgba(C.cream, 0.75) });
      }
      c.globalAlpha = vis;
    }
  }
  c.restore();
}

const RINGS = [
  { r: 1500, s: 'OIL SUPPLY' }, { r: 3000, s: 'ENERGY PRICES' }, { r: 4800, s: 'SHIPPING' },
  { r: 7000, s: 'INDUSTRY' }, { r: 9600, s: 'GLOBAL ECONOMY' },
];
function ringR(i) {
  const t0 = B.ripple0 + 0.3 + i * 0.42;
  const k = seg(t, t0, t0 + 2.6, E.outExpo);
  return { r: lerp(PR_R1, RINGS[i].r, k), a: seg(t, t0 - 0.05, t0 + 0.25), k };
}
function drawRipple(c, glow) {
  if (t < B.ripple0) return;
  const cc = [];
  for (let i = 0; i < RINGS.length; i++) {
    const { r, a, k } = ringR(i);
    if (a <= 0) continue;
    const steps = 240, xs = [], ys = [];
    for (let s = 0; s <= steps; s++) { const th = s / steps * TAU; xs.push(Math.cos(th) * r); ys.push(Math.sin(th) * r); }
    const fin = seg(t, B.final0, B.final0 + 1.2);
    const al = a * (0.85 - 0.45 * k) * (1 - fin * 0.35);
    c.strokeStyle = i === 0 ? acc(al) : rgba(C.cream, al * 0.8);
    c.lineWidth = glow ? 1.6 : (i === 0 ? 1.1 : 0.8);
    c.beginPath(); path3(c, cam, xs, ys, 0, true); c.stroke();
    cc.push([i, r, a, k]);
  }
  if (glow) return;
  // curved ring labels
  for (const [i, r, a, k] of cc) {
    const la = a * seg(k, 0.35, 0.8) * (1 - seg(t, B.final0 + 0.2, B.final0 + 1.0) * 0.55);
    if (la < 0.01) continue;
    const str = RINGS[i].s;
    c.font = mono(12, 500);
    const th0 = Math.atan2(-cam.hy, -cam.hx) + 0.45 - i * 0.05;       // towards the viewer, slightly right
    const spacing = 12 * 0.96;
    const kmPer = 1 / cam.pxPerKm;
    let arc = 0;
    const chars = [...str];
    const total = chars.length * spacing;
    chars.forEach((ch, j) => {
      const th = th0 + ((arc - total / 2) * kmPer * 1.35) / r;
      arc += spacing;
      const P = sp(Math.cos(th) * r, Math.sin(th) * r, 0);
      const P2 = sp(Math.cos(th + 0.002) * r, Math.sin(th + 0.002) * r, 0);
      if (!P || !P2) return;
      let ang = Math.atan2(P2[1] - P[1], P2[0] - P[0]);
      if (Math.cos(ang) < 0) ang += Math.PI;
      c.save(); c.translate(P[0], P[1]); c.rotate(ang); c.globalAlpha = la;
      c.fillStyle = rgba(C.cream, 0.9); c.textAlign = 'center';
      c.fillText(ch, 0, -6);
      c.restore();
    });
  }
}

// destinations light up as the ripple passes them (true great-circle distance)
function drawCities(c, glow) {
  if (t < B.ripple0 + 0.8) return;
  const reach = Math.max(...RINGS.map((_, i) => ringR(i).r));
  const fin = seg(t, B.final0, B.final0 + 1.0);
  for (const ct of CITIES) {
    const k = clamp((reach - ct.d) / 1200);
    if (k <= 0) continue;
    const P = sp(ct.x, ct.y), O = sp(0, 0);
    if (!P || !O) continue;
    const a = k * (1 - fin * 0.35);
    c.strokeStyle = acc(glow ? 0.25 * a : 0.4 * a); c.lineWidth = glow ? 1.4 : 0.6;
    c.beginPath(); c.moveTo(O[0], O[1]); c.lineTo(lerp(O[0], P[0], E.outCubic(k)), lerp(O[1], P[1], E.outCubic(k))); c.stroke();
    if (glow) continue;
    c.fillStyle = rgba(C.cream, a); c.beginPath(); c.arc(P[0], P[1], 2.2, 0, TAU); c.fill();
    c.strokeStyle = rgba(C.cream, 0.5 * a); c.beginPath(); c.arc(P[0], P[1], 2.2 + 8 * E.outCubic(k), 0, TAU); c.stroke();
    const mi = Math.round(ct.d * 0.621371 / 100) * 100;
    c.save(); c.globalAlpha = a;
    const al = ct.side > 0 ? 'left' : 'right', dx = ct.side > 0 ? 10 : -10;
    label(c, ct.n, P[0] + dx, P[1] - 4, { px: 11, wg: 500, track: 0.22, fill: rgba(C.cream, 0.95), align: al });
    label(c, mi.toLocaleString('en-US') + ' MI', P[0] + dx, P[1] + 11, { px: 10, track: 0.2, fill: rgba(C.cream, 0.55), align: al });
    c.restore();
  }
}

function drawHotspot(c) {
  const a = env(t, 9.4, 11.5, B.STOP, B.STOP + 0.25, E.outCubic, E.outCubic);
  if (a <= 0) return;
  const P = sp(0, 0); if (!P) return;
  const r = 60 + 30 * speedMul(t);
  const g = c.createRadialGradient(P[0], P[1], 0, P[0], P[1], r);
  g.addColorStop(0, acc(0.55 * a)); g.addColorStop(1, acc(0));
  c.fillStyle = g; c.fillRect(P[0] - r, P[1] - r, 2 * r, 2 * r);
}
function drawCore(c, glow) {
  // the strait as a single point of light, once the world is in view
  const a = seg(t, B.ripple0 + 0.4, B.ripple0 + 1.4);
  if (a <= 0) return;
  const P = sp(0, 0);
  if (!P) return;
  const pulse = 1 + 0.25 * Math.sin((t - B.ripple0) * 2.2);
  c.fillStyle = acc(a);
  c.beginPath(); c.arc(P[0], P[1], (glow ? 6 : 3.2) * pulse, 0, TAU); c.fill();
  if (!glow) {
    c.save(); c.globalAlpha = a * seg(t, B.final0 + 0.6, B.final0 + 1.6);
    label(c, 'HORMUZ', P[0] + 10, P[1] + 4, { px: 10, wg: 500, track: 0.3, fill: acc(0.95) });
    c.restore();
  }
}

// ---------------------------------------------------------------- finale
function drawFinal(c) {
  const a = seg(t, B.final0, B.final0 + 0.2);
  if (a <= 0) return;
  // scrim
  const g = c.createLinearGradient(0, 0, W * 0.62, 0);
  g.addColorStop(0, rgba(C.bg0, 0.86)); g.addColorStop(0.7, rgba(C.bg0, 0.55)); g.addColorStop(1, rgba(C.bg0, 0));
  c.save(); c.globalAlpha = seg(t, B.final0, B.final0 + 1.2); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
  const x = 112, y0 = 430, lh = 76;
  const lines = [['THE WORLD ECONOMY', 450], ['CAN FEEL A BOTTLENECK', 450], ['THOUSANDS OF MILES AWAY', 850]];
  lines.forEach(([s, wg], i) => {
    const k = seg(t, B.final0 + 0.1 + i * 0.35, B.final0 + 1.1 + i * 0.35, E.outQuint);
    if (k <= 0) return;
    c.save();
    c.beginPath(); c.rect(x - 10, y0 + i * lh - 70, 1200, 86); c.clip();
    const wdK = seg(t, B.final0 + i * 0.35, B.final0 + 2.2 + i * 0.35, E.outCubic);
    const w = typeset(c, s, x, y0 + i * lh + (1 - k) * 70, { px: 66, wd: lerp(118, 100, wdK), wg, track: lerp(6, 0.5, wdK), fill: rgba(C.cream) });
    if (i === 2) {                                 // the full stop is the strait
      const kd = seg(t, B.final0 + 1.5, B.final0 + 2.1, E.outBack);
      c.fillStyle = acc(1);
      c.beginPath(); c.arc(x + w + 14, y0 + i * lh - 5 + (1 - k) * 70, 7 * kd, 0, TAU); c.fill();
    }
    c.restore();
  });
  const f = seg(t, B.foot, B.foot + 1.0);
  if (f > 0) {
    c.save(); c.globalAlpha = f;
    c.strokeStyle = rgba(C.cream, 0.3); c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(x, 930); c.lineTo(x + 560, 930); c.stroke();
    label(c, 'AS OF 30 SEP 2026, PASSAGE THROUGH THE STRAIT REMAINS RESTRICTED.', x, 954, { px: 10, track: 0.2, fill: rgba(C.cream, 0.62) });
    label(c, 'SOURCES: EIA · IEA · CRS · IMO / UN · REUTERS. ROUTES ILLUSTRATIVE. DISTANCES GREAT-CIRCLE.', x, 972, { px: 10, track: 0.2, fill: rgba(C.cream, 0.42) });
    c.restore();
  }
}

// ---------------------------------------------------------------- frame
function renderFrame(fi) {
  t = fi / FPS;
  stopK = seg(t, B.STOP, B.STOP + 0.6, E.outCubic) * (1 - seg(t, B.price0, B.price0 + 1.0));
  cam = makeCamera(Object.assign(camKeys(t), { fov: 30 }));
  const vh = cam.viewH;
  const ex = track([[0, 0], [4.0, 0], [9.8, 7, E.inOutCubic], [26.2, 8], [30, 0, E.inOutCubic]], t);
  const exSea = ex * 0.9;
  const worldFade = inv(2500, 12000, vh);

  // ---- main
  ctx.setTransform(SS, 0, 0, SS, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  drawBackground(ctx);
  const aStrait = 1 - inv(110, 260, vh);
  const aRegion = inv(60, 170, vh) * (1 - inv(2500, 7000, vh));
  const aWorld = inv(3000, 9000, vh);
  const topoFade = 1 - 0.35 * seg(t, B.STOP, B.STOP + 1.5) * (1 - seg(t, B.price0, B.price0 + 1));
  topoLayer(ctx, GEO.topoRegion.filter(l => l.e < 0), aRegion * topoFade, ex, exSea);
  topoLayer(ctx, GEO.topoStrait.filter(l => l.e < 0), aStrait * topoFade, ex, exSea * 4, 0.6);
  landFill(ctx, worldFade, 1 - inv(170, 330, vh));
  drawHormuzWord(ctx);
  topoLayer(ctx, GEO.topoRegion.filter(l => l.e > 0), aRegion * topoFade, ex, exSea);
  topoLayer(ctx, GEO.topoStrait.filter(l => l.e > 0), aStrait * topoFade, Math.max(ex, 1.2), exSea);
  topoLayer(ctx, GEO.topoWorld, aWorld * 0.45, 0, 0, 0.5);
  drawLanes(ctx);
  drawRoutes(ctx, false);
  drawDimension(ctx);
  drawParticles(ctx, false);
  drawQueue(ctx);
  drawLabels(ctx);
  drawMonolith(ctx, false);
  drawFlowCaptions(ctx);
  drawPrice(ctx, false);
  drawRipple(ctx, false);
  drawCities(ctx, false);
  drawCore(ctx, false);
  drawQuestion(ctx);
  drawStatus(ctx);
  drawBottleneck(ctx);
  drawFinal(ctx);

  // ---- emissive (bloom source)
  ectx.setTransform(0.5, 0, 0, 0.5, 0, 0);
  ectx.globalCompositeOperation = 'source-over';
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, W, H);
  drawRoutes(ectx, true);
  drawParticles(ectx, true);
  drawMonolith(ectx, true);
  drawPrice(ectx, true);
  drawRipple(ectx, true);
  drawCities(ectx, true);
  drawCore(ectx, true);
  drawHotspot(ectx);

  // ---- composite
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalCompositeOperation = 'source-over';
  octx.globalAlpha = 1;
  octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = 'high';
  octx.drawImage(main, 0, 0, W, H);
  bactx.filter = 'blur(5px)'; bactx.clearRect(0, 0, W / 2, H / 2); bactx.drawImage(emit, 0, 0); bactx.filter = 'none';
  bbctx.filter = 'blur(9px)'; bbctx.clearRect(0, 0, W / 4, H / 4); bbctx.drawImage(emit, 0, 0, W / 4, H / 4); bbctx.filter = 'none';
  octx.globalCompositeOperation = 'lighter';
  octx.globalAlpha = 0.55; octx.drawImage(blurA, 0, 0, W, H);
  octx.globalAlpha = 0.45; octx.drawImage(blurB, 0, 0, W, H);
  // vignette
  octx.globalCompositeOperation = 'source-over';
  octx.globalAlpha = 1;
  const vg = octx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,6,4,0.62)');
  octx.fillStyle = vg; octx.fillRect(0, 0, W, H);
  // grain
  octx.globalCompositeOperation = 'overlay';
  octx.globalAlpha = 0.10;
  octx.drawImage(grain[fi % grain.length], 0, 0);
  octx.globalCompositeOperation = 'source-over';
  octx.globalAlpha = 1;
}

// ---------------------------------------------------------------- boot
window.renderFrame = renderFrame;
window.NF = NF; window.DUR = DUR;
(async () => {
  await loadFonts();
  await loadData();
  buildFlow();
  buildParticles();
  buildMonolith();
  buildGrain();
  window.ready = true;
  const u = new URLSearchParams(location.search);
  if (u.has('t')) renderFrame(Math.round(parseFloat(u.get('t')) * FPS));
})();
