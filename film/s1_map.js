'use strict';
// ─────────────────────────────────────────────────────────────
//  SCENES 1–2 · ORIGIN + TWO SYSTEMS  (0 → 9.4s)
//  point → route → trajectory → map fields → pitch halves → collision
// ─────────────────────────────────────────────────────────────
const T = {
  s2: 4.2, lift: 5.3, morph: 6.5, collide: 8.4, s3: 9.2, grow: 11.8, rows: 12.7, collapse3: 13.9, point3: 14.75,
  s4: 15.2, bend: 16.9, vert: 17.2, expand: 21.6, compress: 22.1, s5: 22.6, peak: 27.6, thaw: 27.95, iris: 28.3,
  s6: 28.9, end: DUR,
};

const MAP = (() => {
  // simplified outlines (lon, lat) — editorial abstraction, not survey-grade
  const GEO_PT = [[-8.87, 41.87], [-8.62, 42.05], [-8.17, 42.15], [-8.05, 41.95], [-7.7, 41.9], [-7.2, 41.88], [-6.9, 41.95], [-6.55, 41.96], [-6.19, 41.58], [-6.5, 41.3], [-6.8, 41.05], [-6.93, 40.8], [-6.8, 40.3], [-7.0, 39.9], [-7.02, 39.67], [-7.5, 39.66], [-7.3, 39.45], [-7.2, 39.1], [-7.05, 38.85], [-7.25, 38.6], [-7.3, 38.43], [-6.95, 38.2], [-7.1, 38.05], [-7.25, 37.95], [-7.5, 37.55], [-7.42, 37.18], [-7.9, 37.0], [-8.3, 37.08], [-8.6, 37.12], [-8.99, 37.02], [-8.8, 37.4], [-8.79, 37.9], [-8.9, 38.48], [-9.21, 38.42], [-9.15, 38.62], [-9.42, 38.69], [-9.5, 38.78], [-9.4, 39.1], [-9.36, 39.36], [-9.1, 39.6], [-8.9, 40.15], [-8.65, 40.64], [-8.67, 41.15], [-8.78, 41.5]];
  const GEO_WA = [[-3.08, 53.25], [-3.32, 53.35], [-3.49, 53.32], [-3.86, 53.33], [-4.05, 53.25], [-4.3, 53.42], [-4.57, 53.4], [-4.69, 53.3], [-4.56, 53.2], [-4.33, 53.12], [-4.4, 53.0], [-4.6, 52.9], [-4.77, 52.8], [-4.41, 52.88], [-4.13, 52.91], [-4.06, 52.72], [-4.05, 52.54], [-4.08, 52.41], [-4.36, 52.21], [-4.66, 52.1], [-5.07, 52.03], [-5.3, 51.88], [-5.1, 51.72], [-4.9, 51.64], [-4.7, 51.67], [-4.4, 51.73], [-4.25, 51.68], [-4.3, 51.57], [-3.95, 51.61], [-3.75, 51.52], [-3.55, 51.4], [-3.27, 51.39], [-3.17, 51.46], [-2.98, 51.54], [-2.67, 51.61], [-2.72, 51.81], [-3.0, 51.99], [-3.12, 52.07], [-3.0, 52.2], [-3.05, 52.34], [-3.15, 52.53], [-3.0, 52.63], [-3.12, 52.8], [-2.73, 52.98], [-2.9, 53.1], [-2.98, 53.18]];
  const LIS = [-9.14, 38.72], CDF = [-3.18, 51.49];
  const P1 = [470, 690], P2 = [1340, 410];
  const k45 = Math.cos(45 * DEG);
  const gz = g => [g[0] * k45, -g[1]];
  const z1 = gz(LIS), z2 = gz(CDF);
  const dz = [z2[0] - z1[0], z2[1] - z1[1]], dp = [P2[0] - P1[0], P2[1] - P1[1]];
  const den = dz[0] * dz[0] + dz[1] * dz[1];
  const A = [(dp[0] * dz[0] + dp[1] * dz[1]) / den, (dp[1] * dz[0] - dp[0] * dz[1]) / den];
  const geoS = g => { const z = gz(g), w = [z[0] - z1[0], z[1] - z1[1]]; return [P1[0] + A[0] * w[0] - A[1] * w[1], P1[1] + A[0] * w[1] + A[1] * w[0]]; };
  const pxPerKm = Math.hypot(A[0], A[1]) / 111.2;
  const northAng = Math.atan2(A[0] * -1, -A[1] * -1); // screen angle of geo-north
  // route — quadratic arc bulging "up"
  const chord = Math.hypot(dp[0], dp[1]);
  const dS = [dp[0] / chord, dp[1] / chord];
  const perp = [dS[1], -dS[0]];
  const mid = [(P1[0] + P2[0]) / 2, (P1[1] + P2[1]) / 2];
  const Cc = [mid[0] + perp[0] * 300, mid[1] + perp[1] * 300];
  const LUT = []; let acc = 0, prev = P1;
  for (let i = 0; i <= 600; i++) { const p = quadBez(P1, Cc, P2, i / 600); acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]); LUT.push({ p, l: acc }); prev = p; }
  const total = acc;
  function routeAt(k) {
    const L = clamp(k) * total; let lo = 0, hi = LUT.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (LUT[m].l < L) lo = m; else hi = m; }
    const a = LUT[lo], b = LUT[hi], u = b.l > a.l ? (L - a.l) / (b.l - a.l) : 0;
    return [lerp(a.p[0], b.p[0], u), lerp(a.p[1], b.p[1], u)];
  }
  const Ms = routeAt(0.5);
  const toWorld = s => [s[0] - CX, 0, s[1] - CY];
  const Mw = toWorld(Ms);
  const d = [dS[0], 0, dS[1]], e = [-dS[1], 0, dS[0]];
  const toPlane = s => [(s[0] - Ms[0]) * dS[0] + (s[1] - Ms[1]) * dS[1], -(s[0] - Ms[0]) * dS[1] + (s[1] - Ms[1]) * dS[0]];
  const planeW = (a, b, y = 0) => [Mw[0] + d[0] * a + e[0] * b, y, Mw[2] + d[2] * a + e[2] * b];
  const L = 560, Wp = 363;   // half-pitch length / half-width (105 × 68 proportions)
  const N = 240;
  function prepOutline(geo, rectCorners) {
    let o = resample(geo.map(geoS).map(toPlane), N, true);
    const r = resample(rectCorners, N, true);
    if (Math.sign(signedArea(o)) !== Math.sign(signedArea(r))) o.reverse();
    const cen = o.reduce((s, p) => [s[0] + p[0] / N, s[1] + p[1] / N], [0, 0]);
    const rc = rectCorners.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
    const dir = [rectCorners[0][0] - rc[0], rectCorners[0][1] - rc[1]];
    let best = 0, bv = -1e9;
    o.forEach((p, i) => { const v = (p[0] - cen[0]) * dir[0] + (p[1] - cen[1]) * dir[1]; if (v > bv) { bv = v; best = i; } });
    o = o.slice(best).concat(o.slice(0, best));
    return { o, r, cen };
  }
  const PT = prepOutline(GEO_PT, [[-L, -Wp], [0, -Wp], [0, Wp], [-L, Wp]]);
  const WA = prepOutline(GEO_WA, [[0, -Wp], [L, -Wp], [L, Wp], [0, Wp]]);
  const p1P = toPlane(P1), p2P = toPlane(P2);
  const rotAng = Math.atan2(dS[1], dS[0]);
  return { P1, P2, Ms, Mw, d, e, L, Wp, routeAt, toWorld, toPlane, planeW, PT, WA, p1P, p2P, pxPerKm, northAng, rotAng, A };
})();

// ── S1 timing: head along route ──────────────────────────────
function headK(t) {
  if (t < 0.9) return 0;
  if (t < 2.3) return 0.2 * E.ios(rm(t, 0.9, 2.3));
  return 0.2 + 0.8 * E.o3(rm(t, 2.3, 2.95));
}
function invHead(k) { let lo = 0.9, hi = 2.95; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (headK(m) < k) lo = m; else hi = m; } return hi; }

const HH = 290;                                   // trajectory apex height
const liftK = t => er(t, T.lift, 6.5, E.io3);
const morphK = t => er(t, T.morph, 7.7, E.io4);
const sepK = t => 180 * (1 - E.i4(rm(t, 7.2, T.collide)));
function route3(k, t) { const s = MAP.routeAt(k), w = MAP.toWorld(s); w[1] = HH * 4 * k * (1 - k) * liftK(t); return w; }

// ── S1 network decorations ───────────────────────────────────
const NET1 = (() => {
  const r = rng(11), nodes = [], scat = [], branches = [];
  for (let i = 0; i < 14; i++) { const k = (i + 0.5) / 14; nodes.push({ k, t: Math.max(invHead(k), 2.3) + 0.02 }); }
  for (let i = 0; i < 52; i++) {
    const k = 0.08 + r() * 0.86, off = (r() < 0.5 ? -1 : 1) * (26 + Math.pow(r(), 1.4) * 170), along = (r() - 0.5) * 60;
    scat.push({ k, off, along, t: Math.max(invHead(k), 2.32) + 0.04 + r() * 0.5, sz: 1 + r() * 1.4, lime: r() < 0.18 });
  }
  for (let i = 0; i < 8; i++) {
    const k = 0.18 + r() * 0.7, side = i % 2 ? 1 : -1;
    branches.push({ k, side, len: 260 + r() * 360, bend: (r() - 0.5) * 300, along: (r() - 0.5) * 400, t: Math.max(invHead(k), 2.36) + r() * 0.35 });
  }
  return { nodes, scat, branches };
})();

// ── fields (grid = Portugal "structure", flow = Wales "flow") ─
const FIELD = (() => {
  const grid = [], r = rng(5);
  for (let a = -MAP.L - 420; a <= -6; a += 12) for (let b = -MAP.Wp - 36; b <= MAP.Wp + 36; b += 12) grid.push([a, b, r()]);
  const lines = [];
  for (let j = -44; j <= 44; j++) lines.push(j);
  return { grid, lines };
})();
function flowB(j, a, t) { return j * 8.6 + 6 * Math.sin(a * 0.022 + j * 0.45 + t * 1.4) + 3.5 * Math.sin(a * 0.051 - t * 2.1 + j * 0.23); }

// ── pitch markings in plane coordinates (a, b) ────────────────
const PITCH = (() => {
  const { L, Wp } = MAP, u = L / 52.5, paths = [];
  const circ = (cx, cy, r, a0, a1, n = 48) => { const o = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; };
  paths.push([[-L, -Wp], [L, -Wp], [L, Wp], [-L, Wp], [-L, -Wp]]);
  paths.push([[0, -Wp], [0, Wp]]);
  paths.push(circ(0, 0, 9.15 * u, 0, TAU, 72));
  for (const s of [-1, 1]) {
    const x0 = s * L;
    paths.push([[x0, -20.16 * u], [x0 - s * 16.5 * u, -20.16 * u], [x0 - s * 16.5 * u, 20.16 * u], [x0, 20.16 * u]]);
    paths.push([[x0, -9.16 * u], [x0 - s * 5.5 * u, -9.16 * u], [x0 - s * 5.5 * u, 9.16 * u], [x0, 9.16 * u]]);
    const ph = Math.acos((16.5 - 11) / 9.15);
    paths.push(s < 0 ? circ(x0 + 11 * u, 0, 9.15 * u, -ph, ph, 24) : circ(x0 - 11 * u, 0, 9.15 * u, Math.PI - ph, Math.PI + ph, 24));
    paths.push([[x0, -3.66 * u], [x0 + s * 2.44 * u, -3.66 * u], [x0 + s * 2.44 * u, 3.66 * u], [x0, 3.66 * u]]);
  }
  return { paths, spots: [[0, 0], [-L + 11 * u, 0], [L - 11 * u, 0]] };
})();

// ── text placement (plane) ────────────────────────────────────
const TXT_PT = { font: FONT.sans(800, 104, 'expanded'), px: 104, str: 'PORTUGAL', track: 6 };
const TXT_WA = { font: FONT.serif(170), px: 170, str: 'Wales', track: 2 };
function textFrame(which, t) {
  const m = morphK(t), sep = sepK(t);
  const X = which === 'pt' ? TXT_PT : TXT_WA;
  const w = layout(X.font, X.str, X.track).width;
  const s0 = which === 'pt' ? [330 + w / 2, 872] : [1215 + w / 2, 596];
  const o0 = MAP.toWorld(s0);
  const o1 = which === 'pt' ? MAP.planeW(-MAP.L / 2 - sep, 34) : MAP.planeW(MAP.L / 2 + sep, 44);
  const sc = lerp(1, which === 'pt' ? 74 / 104 : 128 / 170, m);
  const th = lerp(0, MAP.rotAng, m);
  const ax = [Math.cos(th) * sc, 0, Math.sin(th) * sc], ay = [-Math.sin(th) * sc, 0, Math.cos(th) * sc];
  return { o: vlerp(o0, o1, m), ax, ay, X };
}

// ── particles born at the collision (text + fields + pitch) ───
let PARTS = null;
function buildParticles() {
  const r = rng(77), out = [];
  const push = (p0, a, cls) => {
    const sa = a === 0 ? (r() < 0.5 ? -1 : 1) : Math.sign(a), fa = Math.exp(-Math.abs(a) / 260);
    const vA = sa * (1150 * fa * (0.4 + 0.6 * r()) + 140 * r());
    const vY = 160 + 1300 * Math.exp(-Math.abs(a) / 330) * r();
    const vB = (r() - 0.5) * 620;
    const rnd = vmul(vnorm([r() - 0.5, r() - 0.5, r() - 0.5]), 700 * Math.pow(r(), 0.7));
    const v = vadd(vadd(vadd(vmul(MAP.d, vA), [0, vY, 0]), vmul(MAP.e, vB)), rnd);
    out.push({ p0, v, cls, h: r(), r: r(), ph: r() * TAU, pl: Math.floor(r() * 6), sp: 0.5 + r() * 0.9 });
  };
  // text samples at collision configuration
  for (const which of ['pt', 'wa']) {
    const f = textFrame(which, T.collide), X = f.X, Lw = layout(X.font, X.str, X.track);
    const cw = Math.ceil(Lw.width + 40), ch = Math.ceil(X.px * 1.5);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.font = X.font; g.textAlign = 'center';
    const base = X.px * 1.1;
    Lw.glyphs.forEach(q => g.fillText(q.ch, 20 + q.x, base));
    const img = g.getImageData(0, 0, cw, ch).data, step = which === 'pt' ? 3 : 2;
    const axu = vnorm(f.ax), ayu = vnorm(f.ay), sc = vlen(f.ax);
    for (let y = 0; y < ch; y += step) for (let x = 0; x < cw; x += step) {
      if (img[(y * cw + x) * 4 + 3] > 120) {
        const lx = (x - 20 - Lw.width / 2) * sc, ly = (y - base) * sc;
        const p0 = vadd(vadd(f.o, vmul(axu, lx)), vmul(ayu, ly));
        const pl = MAP.toPlane([p0[0] + CX, p0[2] + CY]);
        push(p0, pl[0], 0);
      }
    }
  }
  // grid field (Portugal half)
  for (const g of FIELD.grid) { const a = g[0], b = g[1]; if (a >= -MAP.L && Math.abs(b) <= MAP.Wp && g[2] < 0.55) push(MAP.planeW(a, b), a, g[2] > 0.5 ? 3 : 1); }
  // flow field (Wales half)
  for (const j of FIELD.lines) for (let a = 8; a <= MAP.L; a += 18) { if (r() < 0.55) { const b = flowB(j, a, T.collide); if (Math.abs(b) <= MAP.Wp) push(MAP.planeW(a, b), a, 2); } }
  // pitch markings
  for (const pth of PITCH.paths) { const rs = resample(pth, Math.max(8, Math.floor(pth.length * 3)), false); rs.forEach(q => push(MAP.planeW(q[0], q[1]), q[0], 2)); }
  PARTS = out;
}

// ── draw ──────────────────────────────────────────────────────
function drawMap(ctx, t, cam) {
  const lift = liftK(t), morph = morphK(t), sep = sepK(t);
  const pre = t < T.collide;
  const project = p => proj(cam, p);

  // pitch markings (draw-in 6.9 → 8.3)
  if (pre && t > 6.9) {
    ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    PITCH.paths.forEach((pth, i) => {
      const k = er(t, 6.9 + i * 0.07, 7.6 + i * 0.07, E.io3);
      if (k <= 0) return;
      const pts = resample(pth, Math.max(6, pth.length * 8), false).map(q => project(MAP.planeW(q[0], q[1])));
      ctx.strokeStyle = col(P.cream, 0.28 + 0.5 * er(t, 8.2, 8.4, E.i3));
      pathPts(ctx, partial(pts, k), false); ctx.stroke();
    });
    const ks = er(t, 7.6, 7.9);
    PITCH.spots.forEach(s => { const p = project(MAP.planeW(s[0], s[1])); dot(ctx, p.x, p.y, 2.2 * p.s * ks, P.cream, 0.6); });
  }

  // polygons (outline → pitch-half morph)
  const polyP = (O, sgn) => O.o.map((q, i) => { const rr = O.r[i]; return [lerp(q[0], rr[0] + sgn * sep, morph), lerp(q[1], rr[1], morph)]; });
  const ptPoly = polyP(MAP.PT, -1), waPoly = polyP(MAP.WA, 1);
  const ptProj = ptPoly.map(q => project(MAP.planeW(q[0], q[1]))), waProj = waPoly.map(q => project(MAP.planeW(q[0], q[1])));

  if (pre) {
    // PORTUGAL · structured grid field
    const rev = er(t, 4.45, 5.9, E.o3);
    if (rev > 0) {
      ctx.save(); pathPts(ctx, ptProj, true); ctx.clip();
      const c1 = project(MAP.planeW(MAP.p1P[0], MAP.p1P[1]));
      const R = rev * 1400 * c1.s;
      const act = Math.floor(t * 7);
      const base = col(P.em3, 0.9), lime = col(P.lime, 0.95);
      ctx.fillStyle = base;
      const limeList = [];
      for (const g of FIELD.grid) {
        const p = project(MAP.planeW(g[0] - sep, g[1]));
        const dd = Math.hypot(p.x - c1.x, p.y - c1.y);
        if (dd > R) continue;
        const sz = 2.3 * p.s * clamp((R - dd) / 60);
        if (hash1(g[2] * 999 + act) > 0.955) limeList.push([p.x, p.y, sz * 1.2]);
        else ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
      ctx.fillStyle = lime; limeList.forEach(q => ctx.fillRect(q[0] - q[2] / 2, q[1] - q[2] / 2, q[2], q[2]));
      ctx.restore();
    }
    // WALES · flowing line field
    const rev2 = er(t, 4.6, 6.0, E.o3);
    if (rev2 > 0) {
      ctx.save(); pathPts(ctx, waProj, true); ctx.clip();
      const c2 = project(MAP.planeW(MAP.p2P[0], MAP.p2P[1]));
      ctx.beginPath(); ctx.arc(c2.x, c2.y, rev2 * 1500 * c2.s, 0, TAU); ctx.clip();
      ctx.strokeStyle = col(P.cream, 0.5); ctx.lineWidth = 1;
      ctx.beginPath();
      for (const j of FIELD.lines) {
        let first = true;
        for (let a = 4; a <= MAP.L + 420; a += 11) {
          const p = project(MAP.planeW(a + sep, flowB(j, a, t)));
          if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke(); ctx.restore();
    }
    // outlines
    const kP = er(t, 4.2, 5.25, E.io3), kW = er(t, 4.35, 5.4, E.io3);
    ctx.lineWidth = 1.3; ctx.lineJoin = 'round';
    ctx.strokeStyle = col(P.cream, 0.9);
    if (kP > 0) { pathPts(ctx, partial(ptProj.concat([ptProj[0]]), kP), false); ctx.stroke(); }
    if (kW > 0) { pathPts(ctx, partial(waProj.concat([waProj[0]]), kW), false); ctx.stroke(); }
    // system labels (plane anchored)
    const la = er(t, 5.0, 5.5) * (1 - er(t, 6.4, 6.8));
    if (la > 0) {
      ctx.font = FONT.mono(11); ctx.textAlign = 'left'; ctx.fillStyle = col(P.cream, 0.55 * la);
      const a1 = project(MAP.planeW(MAP.PT.cen[0] - 60, MAP.PT.cen[1] - 150));
      const a2 = project(MAP.planeW(MAP.WA.cen[0] + 40, MAP.WA.cen[1] - 150));
      ctx.letterSpacing = '2px';
      ctx.fillText(scramble('SYSTEM A — STRUCTURE', la, 3), a1.x, a1.y);
      ctx.fillText(scramble('SYSTEM B — FLOW', la, 9), a2.x, a2.y);
      ctx.letterSpacing = '0px';
    }
  }

  // S1 network: scatter points + branches (absorbed into the countries 4.3 → 5.3)
  const absorb = er(t, 4.3, 5.4, E.i3);
  if (pre && absorb < 1) {
    const perpAt = (k, off, along) => {
      const s = MAP.routeAt(k), s2 = MAP.routeAt(Math.min(1, k + 0.002));
      const tx = s2[0] - s[0], ty = s2[1] - s[1], l = Math.hypot(tx, ty) || 1;
      return [s[0] - ty / l * off + tx / l * along, s[1] + tx / l * off + ty / l * along];
    };
    ctx.lineWidth = 0.7;
    for (const b of NET1.branches) {
      const k = er(t, b.t, b.t + 0.45, E.o3) * (1 - absorb);
      if (k <= 0) continue;
      const s0 = MAP.routeAt(b.k), e1 = perpAt(b.k, b.side * b.len, b.along);
      const c = perpAt(b.k, b.side * b.len * 0.5, b.along * 0.5 + b.bend);
      const pts = []; for (let i = 0; i <= 30; i++) { const q = quadBez(s0, c, e1, i / 30 * k); pts.push(project(MAP.toWorld(q))); }
      ctx.strokeStyle = col(P.lime, 0.55); pathPts(ctx, pts, false); ctx.stroke();
      const ep = pts[pts.length - 1]; dot(ctx, ep.x, ep.y, 2, P.lime, 0.9);
    }
    for (const s of NET1.scat) {
      const k = er(t, s.t, s.t + 0.25, E.o3);
      if (k <= 0) continue;
      let q = perpAt(s.k, s.off, s.along);
      const target = s.k < 0.5 ? MAP.P1 : MAP.P2;
      q = [lerp(q[0], target[0], absorb), lerp(q[1], target[1], absorb)];
      const p = project(MAP.toWorld(q)), rp = project(route3(s.k, t));
      ctx.strokeStyle = col(P.cream, 0.16 * k * (1 - absorb));
      ctx.beginPath(); ctx.moveTo(rp.x, rp.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      dot(ctx, p.x, p.y, s.sz * (1 - absorb * 0.6), s.lime ? P.lime : P.cream, 0.8 * k * (1 - absorb));
    }
  }

  // route: ground track + lifted trajectory
  const hk = headK(t);
  const flat = [], arc = [];
  for (let i = 0; i <= 120; i++) { const k = i / 120 * hk; flat.push(project(MAP.toWorld(MAP.routeAt(k)))); arc.push(project(route3(k, t))); }
  if (hk > 0 && t < T.collide + 0.05) {
    const fade = 1 - er(t, 8.2, 8.45);
    if (lift > 0) {
      ctx.setLineDash([3, 6]); ctx.lineWidth = 1; ctx.strokeStyle = col(P.cream, 0.35 * fade);
      pathPts(ctx, flat, false); ctx.stroke(); ctx.setLineDash([]);
      // drop lines
      ctx.strokeStyle = col(P.cream, 0.22 * lift * fade); ctx.setLineDash([2, 4]);
      ctx.beginPath();
      for (let i = 1; i < 24; i++) { const k = i / 24; const a = project(route3(k, t)), g = project(MAP.toWorld(MAP.routeAt(k))); ctx.moveTo(a.x, a.y); ctx.lineTo(g.x, g.y); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.lineWidth = 1.6; ctx.strokeStyle = col(P.cream, 0.92 * fade);
    pathPts(ctx, arc, false); ctx.stroke();
    // ticks along the route
    ctx.lineWidth = 1; ctx.strokeStyle = col(P.cream, 0.5 * fade); ctx.beginPath();
    for (let i = 1; i < 60; i++) {
      const k = i / 60; if (k > hk) break;
      const a = MAP.routeAt(k), b = MAP.routeAt(k + 0.003), l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l, h = i % 5 === 0 ? 7 : 3.5;
      const p0 = project(MAP.toWorld([a[0] - nx * h, a[1] - ny * h])), p1 = project(MAP.toWorld([a[0] + nx * h, a[1] + ny * h]));
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
    }
    ctx.stroke();
    // nodes on the trajectory
    for (const n of NET1.nodes) {
      const k = er(t, n.t, n.t + 0.2, E.oB);
      if (k <= 0) continue;
      const p = project(route3(n.k, t));
      ring(ctx, p.x, p.y, 3.2 * k, P.cream, 0.9 * fade, 1.1);
      const pr = rm(t, n.t, n.t + 0.6);
      if (pr > 0 && pr < 1) ring(ctx, p.x, p.y, 3 + 22 * E.o3(pr), P.lime, 0.6 * (1 - pr), 1);
    }
    // head
    if (t < 3.1) {
      const hp = arc[arc.length - 1];
      const speed = t > 2.3 && t < 2.95 ? 1 - rm(t, 2.3, 2.95) : 0;
      dot(ctx, hp.x, hp.y, 3.4, P.lime, 1);
      glow(ctx, hp.x, hp.y, 26 + 40 * speed, P.lime, 0.55 + 0.4 * speed);
    }
  }

  // endpoints (Lisboa / Caerdydd)
  if (pre) {
    const pin = er(t, 0.25, 0.6, E.oB);
    const pts = [[MAP.P1, 0.3, 'LISBOA', '38.72°N  9.14°W', 0.65], [MAP.P2, 2.95, 'CAERDYDD', '51.49°N  3.18°W', 3.0]];
    for (const [sp, t0, name, coord, tt] of pts) {
      const k = er(t, t0, t0 + 0.35, E.oB);
      if (k <= 0) continue;
      const p = project(MAP.toWorld(sp));
      dot(ctx, p.x, p.y, 3.4 * k, P.lime, 1);
      ring(ctx, p.x, p.y, 8 * k, P.cream, 0.8, 1);
      const pr = rm(t, t0, t0 + 0.9);
      if (pr > 0 && pr < 1) ring(ctx, p.x, p.y, 8 + 46 * E.o3(pr), P.cream, 0.7 * (1 - pr), 1);
      glow(ctx, p.x, p.y, 30, P.lime, 0.35 * k);
      const la = 1 - er(t, 6.2, 6.7);
      if (la > 0) {
        ctx.font = FONT.mono(12); ctx.textAlign = 'left'; ctx.letterSpacing = '1.5px';
        const n1 = Math.floor(rm(t, tt, tt + 0.5) * coord.length);
        ctx.fillStyle = col(P.cream, 0.75 * la); ctx.fillText(coord.slice(0, n1) + (n1 < coord.length && n1 > 0 ? '▍' : ''), p.x + 16, p.y + 26);
        const n2 = Math.floor(rm(t, tt + 0.15, tt + 0.45) * name.length);
        ctx.fillStyle = col(P.lime, 0.85 * la); ctx.fillText(name.slice(0, n2), p.x + 16, p.y + 44);
        ctx.letterSpacing = '0px';
      }
    }
    void pin;
  }

  // ball on the trajectory
  if (t > 5.8 && t < T.collide + 0.02) {
    let bp;
    if (t < 7.9) bp = route3(0.5 * E.ios(rm(t, 5.9, 7.9)), t);
    else { bp = MAP.planeW(0, 0, HH * (1 - E.i2(rm(t, 7.9, T.collide)))); }
    const p = project(bp), g = project([bp[0], 0, bp[2]]);
    const a = er(t, 5.8, 6.0);
    ctx.strokeStyle = col(P.cream, 0.3 * a); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(g.x, g.y); ctx.stroke(); ctx.setLineDash([]);
    dot(ctx, g.x, g.y, 2.4 * g.s, P.cream, 0.35 * a);
    // ghost samples (trajectory telemetry)
    for (let i = 1; i <= 6; i++) {
      const tt = t - i * 0.07; if (tt < 5.9) break;
      const q = tt < 7.9 ? route3(0.5 * E.ios(rm(tt, 5.9, 7.9)), tt) : MAP.planeW(0, 0, HH * (1 - E.i2(rm(tt, 7.9, T.collide))));
      const pp = project(q); dot(ctx, pp.x, pp.y, 1.6, P.lime, 0.5 * (1 - i / 7) * a);
    }
    const R = 9 * p.s;
    ctx.fillStyle = col(P.deep, 0.9 * a); ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill();
    ring(ctx, p.x, p.y, R, P.cream, a, 1.4);
    // pentagon hint
    ctx.strokeStyle = col(P.cream, 0.6 * a); ctx.lineWidth = 0.9; ctx.beginPath();
    for (let i = 0; i <= 5; i++) { const an = -Math.PI / 2 + i * TAU / 5 + t * 5; const x = p.x + Math.cos(an) * R * 0.42, y = p.y + Math.sin(an) * R * 0.42; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    glow(ctx, p.x, p.y, 30, P.lime, 0.4 * a);
  }

  // PORTUGAL / WALES — typography living on the map plane
  if (pre) {
    const fP = textFrame('pt', t), fW = textFrame('wa', t);
    const trackP = lerp(46, TXT_PT.track, er(t, 2.55, 3.9, E.o4));
    const trackW = lerp(30, TXT_WA.track, er(t, 3.05, 4.1, E.o4));
    const flare = er(t, 8.15, 8.4, E.i3);
    ctx.fillStyle = col(mix(P.cream, P.white, flare));
    drawPlaneText(ctx, cam, fP.X.font, 1, fP.X.str, fP.o, fP.ax, fP.ay, trackP, 'fill', (i, n) => {
      const k = er(t, 2.55 + i * 0.045, 2.95 + i * 0.045, E.o4);
      return { a: k, sy: Math.max(0.001, k) };
    });
    drawPlaneText(ctx, cam, fW.X.font, 1, fW.X.str, fW.o, fW.ax, fW.ay, trackW, 'fill', (i, n) => {
      const k = er(t, 3.05 + i * 0.06, 3.5 + i * 0.06, E.o4);
      return { a: k, lift: (1 - k) * -40 };
    });
    // hairline under PORTUGAL, micro captions
    const ul = er(t, 2.8, 3.6, E.io3) * (1 - morph);
    if (ul > 0) {
      const w = layout(TXT_PT.font, TXT_PT.str, trackP).width;
      const a0 = project(vadd(fP.o, vmul(vnorm(fP.ax), -w / 2))), a1 = project(vadd(fP.o, vmul(vnorm(fP.ax), -w / 2 + w * ul)));
      ctx.strokeStyle = col(P.cream, 0.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a0.x, a0.y + 26); ctx.lineTo(a1.x, a1.y + 26); ctx.stroke();
      ctx.font = FONT.mono(11); ctx.fillStyle = col(P.cream, 0.5 * ul); ctx.textAlign = 'left'; ctx.letterSpacing = '2px';
      ctx.fillText('PT', a0.x, a0.y + 46);
      const wW = project(vadd(fW.o, vmul(vnorm(fW.ax), -layout(TXT_WA.font, TXT_WA.str, trackW).width / 2)));
      ctx.fillStyle = col(P.cream, 0.5 * er(t, 3.4, 3.9) * (1 - morph));
      ctx.fillText('CYMRU', wW.x + 8, wW.y + 36);
      ctx.letterSpacing = '0px';
    }
  }

  // collision: shock rings on the plane + halfway flash
  if (t >= T.collide - 0.02 && t < 9.6) {
    const k = rm(t, T.collide, T.collide + 0.9);
    const ringPts = (r) => { const o = []; for (let i = 0; i <= 90; i++) { const a = i / 90 * TAU; o.push(project(MAP.planeW(Math.cos(a) * r, Math.sin(a) * r))); } return o; };
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = col(P.lime, 0.9 * (1 - k)); pathPts(ctx, ringPts(97 + 900 * E.o3(k)), false); ctx.stroke();
    const k2 = rm(t, T.collide + 0.08, T.collide + 1.2);
    ctx.lineWidth = 1; ctx.strokeStyle = col(P.cream, 0.6 * (1 - k2)); pathPts(ctx, ringPts(60 + 1300 * E.o3(k2)), false); ctx.stroke();
    const hk2 = rm(t, T.collide, T.collide + 0.5);
    for (const s of [-1, 1]) {
      const a = s * 700 * E.o3(hk2);
      const p0 = project(MAP.planeW(a, -MAP.Wp)), p1 = project(MAP.planeW(a, MAP.Wp));
      ctx.strokeStyle = col(P.lime, (1 - hk2) * 0.9); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    const c = project(MAP.Mw);
    glow(ctx, c.x, c.y, 380 * (1 - k * 0.5), P.lime, 0.8 * (1 - E.o2(rm(t, T.collide, T.collide + 0.5))));
    glow(ctx, c.x, c.y, 900, P.white, 0.25 * (1 - E.o2(rm(t, T.collide, T.collide + 0.35))));
  }
}

// ── scale bar + compass (editorial map furniture) ─────────────
function drawMapFurniture(ctx, t) {
  const a = er(t, 1.3, 2.0) * (1 - er(t, 5.2, 5.7));
  if (a <= 0) return;
  const x = 1560, y = 930;
  ctx.save(); ctx.globalAlpha = a;
  const km = 250, len = km * MAP.pxPerKm;
  ctx.strokeStyle = col(P.cream, 0.55); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.moveTo(x + len, y - 5); ctx.lineTo(x + len, y + 5); ctx.moveTo(x + len / 2, y - 3); ctx.lineTo(x + len / 2, y + 3); ctx.stroke();
  ctx.font = FONT.mono(10); ctx.fillStyle = col(P.cream, 0.55); ctx.textAlign = 'left'; ctx.letterSpacing = '1.5px';
  ctx.fillText('0', x - 3, y + 20); ctx.textAlign = 'right'; ctx.fillText('250 KM', x + len + 6, y + 20);
  // compass: geo-north on this rotated map (screen delta of +1° latitude = A·(−i))
  const cx = x + len + 60, cy = y - 4;
  const dirN = [MAP.A[1], -MAP.A[0]];
  const l = Math.hypot(dirN[0], dirN[1]), ux = dirN[0] / l, uy = dirN[1] / l;
  ring(ctx, cx, cy, 14, P.cream, 0.5, 1);
  ctx.strokeStyle = col(P.lime, 0.9); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx - ux * 10, cy - uy * 10); ctx.lineTo(cx + ux * 14, cy + uy * 14); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = col(P.cream, 0.7); ctx.fillText('N', cx + ux * 28, cy + uy * 28 + 4);
  ctx.letterSpacing = '0px';
  ctx.restore();
}
