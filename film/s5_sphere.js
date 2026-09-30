'use strict';
// ─────────────────────────────────────────────────────────────
//  SCENE 5 · MOMENTUM  (22.6 → 28.3s)
//  compressed rings → orbital sphere → spherical football geometry
//  → attention streams in → words fly through → peak → freeze → point
// ─────────────────────────────────────────────────────────────
const C5 = [SPK.axisX, SPK.baseY, 0];
const RS = 420;

// time remap: hard freeze at the peak
function te5(t) {
  if (t < T.peak) return t;
  if (t < T.thaw) return T.peak + (t - T.peak) * 0.06;
  return T.peak + (T.thaw - T.peak) * 0.06 + (t - T.thaw);
}
const spin5 = t => 0.3 * (t - T.s5) + 0.3 * Math.pow(Math.max(0, t - 24), 2);
const BALL_AX = vnorm([0.25, 1, 0.3]);

// truncated icosahedron on a sphere
const TI = (() => {
  const phi = (1 + Math.sqrt(5)) / 2, V = [];
  const cyc = v => [[v[0], v[1], v[2]], [v[1], v[2], v[0]], [v[2], v[0], v[1]]];
  const signs = (v) => { const o = []; for (const a of v[0] ? [1, -1] : [1]) for (const b of v[1] ? [1, -1] : [1]) for (const c of v[2] ? [1, -1] : [1]) o.push([v[0] * a, v[1] * b, v[2] * c]); return o; };
  for (const base of [[0, 1, 3 * phi], [1, 2 + phi, 2 * phi], [phi, 2, 2 * phi + 1]]) for (const s of signs(base)) for (const c of cyc(s)) V.push(c);
  const E2 = [];
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) { const d = vlen(vsub(V[i], V[j])); if (Math.abs(d - 2) < 0.01) E2.push([i, j]); }
  const Vn = V.map(vnorm);
  const ico = []; for (const s of signs([0, 1, phi])) for (const c of cyc(s)) ico.push(vnorm(c));
  const pents = ico.map(cn => {
    const idx = Vn.map((v, i) => [vdot(v, cn), i]).sort((a, b) => b[0] - a[0]).slice(0, 5).map(q => q[1]);
    const e1 = vnorm(vcross(cn, Math.abs(cn[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), e2 = vcross(cn, e1);
    idx.sort((a, b) => Math.atan2(vdot(Vn[a], e2), vdot(Vn[a], e1)) - Math.atan2(vdot(Vn[b], e2), vdot(Vn[b], e1)));
    return { c: cn, idx };
  });
  // edge reveal order: by height
  const order = E2.map((e, i) => [Vn[e[0]][1] + Vn[e[1]][1], i]).sort((a, b) => b[0] - a[0]);
  const rank = new Array(E2.length); order.forEach((o, r) => { rank[o[1]] = r / E2.length; });
  return { V: Vn, E: E2, pents, rank };
})();
function slerp(a, b, u) { const d = clamp(vdot(a, b), -1, 1), om = Math.acos(d); if (om < 1e-4) return a; const s = Math.sin(om); return vadd(vmul(a, Math.sin((1 - u) * om) / s), vmul(b, Math.sin(u * om) / s)); }

const RINGS5 = PLATES.map((pl, k) => {
  const r = rng(300 + k);
  const orbit = k % 5 === 2;
  return { pl, k, orbit, ax: vnorm([Math.cos(k * 2.39996), 0, Math.sin(k * 2.39996)]), beta: (orbit ? 55 + r() * 70 : 25 + r() * 150) * DEG, rT: orbit ? RS * (1.22 + 0.09 * (k % 4)) : RS * (1 + 0.004 * k), spin: (r() - 0.5) * 1.2 };
});
const PULSE5 = [23.0, 23.55, 24.05, 24.5, 24.9, 25.25, 25.58, 25.88, 26.15, 26.4, 26.62, 26.82, 27.0, 27.16, 27.3, 27.43, 27.55];

const STREAM = (() => {
  const r = rng(404), out = [];
  for (let i = 0; i < 1500; i++) {
    const z = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - z * z);
    out.push({ dir: [s * Math.cos(a), z, s * Math.sin(a)], t0: 23.4 + 3.95 * Math.sqrt(r()), life: 0.7 + r() * 0.4, lime: r() < 0.14, R0: 2000 + r() * 1400 });
  }
  return out;
})();
const ARCS5 = (() => {
  const r = rng(505), out = [];
  for (let i = 0; i < 22; i++) {
    const z = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - z * z);
    const d1 = [s * Math.cos(a), z, s * Math.sin(a)];
    const d2 = vnorm(vadd(d1, [(r() - 0.5) * 1.6, (r() - 0.5) * 1.6, (r() - 0.5) * 1.6]));
    out.push({ d1, d2, t0: 24.1 + r() * 3.3, len: 1500 + r() * 1200 });
  }
  return out;
})();
const FLY = (() => {
  const words = ['ATTENTION', 'SEARCH', 'PORTUGAL', 'WALES', 'SPIKE', 'RONALDO', 'MOMENTUM', 'SEARCH INTEREST', 'ATTENTION', 'RONALDO', 'WALES', 'PORTUGAL', 'SPIKE', 'RONALDO', 'ATTENTION'];
  const gaps = [0.45, 0.4, 0.36, 0.32, 0.28, 0.25, 0.22, 0.2, 0.18, 0.16, 0.15, 0.14, 0.13, 0.12];
  const r = rng(606), out = []; let t = 23.85;
  const quad = [[1, -1], [-1, 1], [1, 1], [-1, -1]];
  words.forEach((w, i) => {
    const q = quad[i % 4];
    out.push({ w, t0: t, style: i % 4, X: q[0] * (260 + r() * 420), Y: q[1] * (110 + r() * 260) });
    t += gaps[Math.min(i, gaps.length - 1)];
  });
  return out;
})();
const flyZ = u => 4400 * (1 - E.i3(u)) + 90;

function drawSphere(ctx, t, cam) {
  const tt = te5(t);
  const c = proj(cam, C5), cx = c.x, cy = c.y, Rscr = RS * c.s;
  const collapse = E.iE(rm(t, T.thaw, T.iris));
  const punch = 1 + 0.05 * E.o3(rm(t, T.peak, T.thaw));
  const sc = (1 - collapse) * punch;
  if (sc <= 0.001) return;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.rotate(0.6 * E.i3(rm(t, T.thaw, T.iris))); ctx.translate(-cx, -cy);

  // ── MOMENTUM band (behind everything) ──
  const mb = er(tt, 25.95, 26.25, E.o4);
  if (mb > 0) {
    const font = FONT.sans(900, 330, 'expanded'), unit = 'MOMENTUM ';
    const uw = measure(font, unit);
    const off = ((tt - 25.95) * 1100 + 0.5 * Math.pow(Math.max(0, tt - 26.6), 2) * 1600) % uw;
    ctx.save(); ctx.beginPath(); ctx.rect(-200, cy - 170 * mb, W + 400, 340 * mb); ctx.clip();
    ctx.font = font; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = col(P.cream, 0.97);
    for (let x = -off - 300; x < W + 300; x += uw) ctx.fillText(unit, x, cy + 14);
    ctx.textBaseline = 'alphabetic'; ctx.restore();
  }

  // ── expanding pulse rings ──
  for (const p0 of PULSE5) {
    const k = rm(tt, p0, p0 + 0.95);
    if (k <= 0 || k >= 1) continue;
    ring(ctx, cx, cy, Rscr * (1.02 + 2.2 * E.o3(k)), p0 > 26 ? P.lime : P.cream, 0.45 * (1 - k), 1.2);
  }

  // ── rings: compressed plates → orbital system ──
  const segBack = [], segFront = [];
  const nMorph = lerp(4, 2, er(tt, T.s5, 23.1, E.io3));
  const tilt = er(tt, 22.75, 23.7, E.io4);
  const rMorph = er(tt, T.s5, 23.2, E.io3);
  for (const rg of RINGS5) {
    const absorb = rg.orbit ? 0 : er(tt, 23.7 + (rg.k % 7) * 0.05, 24.4 + (rg.k % 7) * 0.05, E.io3);
    if (absorb >= 1) continue;
    const R0 = plateR(rg.pl, T.s5), R = lerp(R0, rg.rT, rMorph);
    const rot = plateRot(rg.k, T.s5) + rg.spin * (tt - T.s5) + (rg.orbit ? 0.4 * spin5(tt) : 0);
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const q = superPt(R, rot, i / 64 * TAU, nMorph);
      let v = vrot([q[0], 0, q[1]], rg.ax, rg.beta * tilt);
      pts.push(proj(cam, vadd(C5, v)));
    }
    const a = (rg.orbit ? 0.7 : 0.5) * (1 - absorb);
    for (let i = 0; i < 64; i++) {
      const p = pts[i], q = pts[i + 1];
      const front = (p.z + q.z) / 2 < c.z || Math.hypot((p.x + q.x) / 2 - cx, (p.y + q.y) / 2 - cy) > Rscr;
      (front ? segFront : segBack).push([p, q, a, rg.orbit]);
    }
  }
  const strokeSegs = (segs, dim) => {
    ctx.lineWidth = 1;
    for (const s of segs) { ctx.strokeStyle = col(s[3] ? P.lime : P.cream, s[2] * dim); ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y); ctx.lineTo(s[1].x, s[1].y); ctx.stroke(); }
  };
  const ballOn = er(tt, 23.2, 23.9, E.io3);
  strokeSegs(segBack, 1 - 0.75 * ballOn);

  // ── streams (behind) ──
  const streams = [[], []];
  for (const s of STREAM) {
    const u = (tt - s.t0) / s.life;
    if (u <= 0 || u >= 1) continue;
    const r1 = RS + (s.R0 - RS) * (1 - E.i2(u)), r0 = RS + (s.R0 - RS) * (1 - E.i2(Math.max(0, u - 0.07)));
    const a = proj(cam, vadd(C5, vmul(s.dir, r1))), b = proj(cam, vadd(C5, vmul(s.dir, r0)));
    if (a.z < 40 || b.z < 40) continue;
    (a.z > c.z ? streams[0] : streams[1]).push([a, b, s.lime]);
  }
  const drawStreams = L => {
    ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.strokeStyle = col(P.cream, 0.55); ctx.beginPath(); for (const [a, b, l] of L) if (!l) { ctx.moveTo(b.x, b.y); ctx.lineTo(a.x, a.y); } ctx.stroke();
    ctx.strokeStyle = col(P.lime, 0.9); ctx.beginPath(); for (const [a, b, l] of L) if (l) { ctx.moveTo(b.x, b.y); ctx.lineTo(a.x, a.y); } ctx.stroke();
  };
  drawStreams(streams[0]);

  // ── the ball: disc, pentagons, seams, nodes ──
  if (ballOn > 0) {
    const gr = ctx.createRadialGradient(cx - Rscr * 0.35, cy - Rscr * 0.4, Rscr * 0.1, cx, cy, Rscr);
    gr.addColorStop(0, col(P.em2, 0.96 * ballOn)); gr.addColorStop(0.7, col(P.em, 0.96 * ballOn)); gr.addColorStop(1, col(P.deep, 0.97 * ballOn));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, Rscr, 0, TAU); ctx.fill();
    ring(ctx, cx, cy, Rscr, P.cream, 0.35 * ballOn, 1);
    const ang = spin5(tt);
    const rv = v => vrot(v, BALL_AX, ang);
    const toCam = vnorm(vsub(cam.pos, C5));
    // pentagon panels
    const pk = er(tt, 23.9, 24.5);
    for (const pn of TI.pents) {
      const cn = rv(pn.c), f = vdot(cn, toCam);
      if (f <= 0.05 || pk <= 0) continue;
      const pts = pn.idx.map(i => proj(cam, vadd(C5, vmul(rv(TI.V[i]), RS))));
      ctx.fillStyle = col(P.em3, 0.55 * f * pk); pathPts(ctx, pts, true); ctx.fill();
    }
    // seams
    ctx.lineWidth = 1.2;
    const vert = [];
    TI.E.forEach((e, i) => {
      const k = er(tt, 23.25 + TI.rank[i] * 0.7, 23.55 + TI.rank[i] * 0.7, E.o3);
      if (k <= 0) return;
      const a = rv(TI.V[e[0]]), b = rv(TI.V[e[1]]);
      const mid = vnorm(vadd(a, b)), f = vdot(mid, toCam);
      const pts = [];
      for (let j = 0; j <= 6; j++) pts.push(proj(cam, vadd(C5, vmul(slerp(a, b, j / 6 * k), RS))));
      ctx.strokeStyle = f > 0 ? col(P.cream, 0.85 * (0.4 + 0.6 * f)) : col(P.cream, 0.1);
      pathPts(ctx, pts, false); ctx.stroke();
    });
    TI.V.forEach((v0, i) => { const v = rv(v0), f = vdot(v, toCam); if (f > 0) vert.push([proj(cam, vadd(C5, vmul(v, RS))), f]); });
    const vk = er(tt, 23.8, 24.3);
    for (const [p, f] of vert) dot(ctx, p.x, p.y, 2.3 * f * vk, P.lime, 0.95);
    // specular rim
    ctx.strokeStyle = col(P.white, 0.25 * ballOn); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, Rscr - 2, -2.6, -1.3); ctx.stroke();
  }
  strokeSegs(segFront, 1);
  drawStreams(streams[1]);

  // ── launch arcs (attention radiating outward) ──
  ctx.lineWidth = 1.2;
  for (const a of ARCS5) {
    const k = rm(tt, a.t0, a.t0 + 0.8);
    if (k <= 0 || k >= 1) continue;
    const S0 = vadd(C5, vmul(a.d1, RS)), E0 = vadd(C5, vmul(a.d2, RS + a.len)), Cc = vadd(C5, vmul(vnorm(vadd(a.d1, a.d2)), RS + a.len * 0.75));
    const pts = [];
    const k1 = E.o3(k), k0 = Math.max(0, k1 - 0.35);
    for (let j = 0; j <= 16; j++) { const u = lerp(k0, k1, j / 16), v = 1 - u; pts.push(proj(cam, [v * v * S0[0] + 2 * v * u * Cc[0] + u * u * E0[0], v * v * S0[1] + 2 * v * u * Cc[1] + u * u * E0[1], v * v * S0[2] + 2 * v * u * Cc[2] + u * u * E0[2]])); }
    ctx.strokeStyle = col(P.lime, 0.85 * (1 - k)); pathPts(ctx, pts, false); ctx.stroke();
    const hp = pts[pts.length - 1]; dot(ctx, hp.x, hp.y, 2.2, P.lime, 1 - k);
  }

  // ── curved typography orbiting the sphere ──
  const cr = er(tt, 24.2, 25.1, E.io3);
  if (cr > 0) {
    const str = 'ATTENTION · SEARCH INTEREST · MOMENTUM · PORTUGAL · WALES · RONALDO · ';
    const font = FONT.mono(14, 500), r = Rscr * 1.36;
    const L = layout(font, str, 5), scaleA = TAU / (L.width + 5);
    const base = -0.35 * tt - 0.22 * Math.pow(Math.max(0, tt - 25), 2);
    ctx.font = font; ctx.textAlign = 'center'; ctx.fillStyle = col(P.cream, 0.85);
    const n = L.glyphs.length;
    L.glyphs.forEach((g, i) => {
      if (i / n > cr) return;
      const th = base + g.x * scaleA;
      ctx.save(); ctx.translate(cx + Math.cos(th) * r, cy + Math.sin(th) * r); ctx.rotate(th + Math.PI / 2);
      ctx.fillText(g.ch, 0, 0); ctx.restore();
    });
    const r2 = Rscr * 1.46;
    ctx.strokeStyle = col(P.cream, 0.25 * cr); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r2, base, base + TAU * 0.3 * cr); ctx.stroke();
  }

  // ── words flying through space (camera space) ──
  for (const f of FLY) {
    const u = (tt - f.t0) / 1.05;
    if (u <= 0 || u >= 1) continue;
    for (let gh = 3; gh >= 0; gh--) {
      const uu = u - gh * 0.018;
      if (uu <= 0) continue;
      const Z = flyZ(uu), s = FL / Z;
      const a = er(uu, 0, 0.2) * clamp((Z - 110) / 320) * (gh ? 0.16 : 1);
      if (a <= 0.003) continue;
      ctx.save(); ctx.translate(CX + f.X * s, CY + f.Y * s); ctx.scale(s, s); ctx.globalAlpha = a;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (f.style === 0) { ctx.font = FONT.sans(900, 120, 'expanded'); ctx.fillStyle = col(P.cream); ctx.fillText(f.w, 0, 0); }
      else if (f.style === 1) { ctx.font = FONT.serif(150); ctx.fillStyle = col(P.cream); ctx.fillText(f.w.charAt(0) + f.w.slice(1).toLowerCase(), 0, 0); }
      else if (f.style === 2) { ctx.font = FONT.sans(800, 120, 'expanded'); ctx.strokeStyle = col(P.lime); ctx.lineWidth = 2 / Math.max(s, 0.5); ctx.strokeText(f.w, 0, 0); }
      else { ctx.font = FONT.sans(900, 140, 'extra-condensed'); ctx.fillStyle = col(P.lime); ctx.fillText(f.w, 0, 0); }
      ctx.restore();
    }
  }
  ctx.textBaseline = 'alphabetic';
  ctx.restore();

  // ── peak flash ──
  const fl = rm(t, T.peak, T.peak + 0.3);
  if (fl > 0 && fl < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col(P.white, 0.42 * (1 - E.o2(fl))); ctx.fillRect(0, 0, W, H); ctx.restore(); }
  // the point left behind
  if (t > T.iris - 0.1 && t < T.iris + 0.35) {
    const k = er(t, T.iris - 0.1, T.iris, E.o3);
    dot(ctx, cx, cy, 4.5 * k, P.lime, 1); glow(ctx, cx, cy, 90, P.lime, 0.9 * k);
  }
}
