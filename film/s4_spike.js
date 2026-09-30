'use strict';
// ─────────────────────────────────────────────────────────────
//  SCENE 4 · SEARCH INTEREST  (15.2 → 22.6s)
//  point → quiet data line → bends upward → 3D ribbon → tower of
//  attention → expands → compresses into concentric rings
// ─────────────────────────────────────────────────────────────
const SPK = (() => {
  const Xb = 1250, R = 170;
  const hy = x => { const r = x / (x + 60); return r * (18 * (noise1(x * 0.011 + 3.1) - noise1(3.1)) + 7 * (noise1(x * 0.043 + 1.7) - noise1(1.7))) + 70 * Math.pow(x / Xb, 3); };
  const yb = hy(Xb), baseY = yb + R, axisX = Xb + R, arc = Math.PI * R / 2;
  return { Xb, R, hy, yb, baseY, axisX, arc, top: 2450 };
})();

function headS(t) {
  if (t < 15.3) return 0;
  if (t < T.bend) return SPK.Xb * Math.pow(rm(t, 15.3, T.bend), 1.15);
  if (t < T.vert) return SPK.Xb + SPK.arc * rm(t, T.bend, T.vert);
  const u = rm(t, T.vert, 20.8);
  return SPK.Xb + SPK.arc + SPK.top * (1 - Math.pow(1 - u, 2.2));
}
const headH = t => Math.max(0, headS(t) - SPK.Xb - SPK.arc);
const twistK = t => er(t, 17.4, 19.2);
const ribW = t => 150 * er(t, 17.3, 18.3, E.io3) * (1 - er(t, 22.15, 22.5, E.i2));
const vfac = t => (1 - E.i4(rm(t, T.compress, T.s5))) * (1 + 0.12 * er(t, T.expand, T.compress, E.o3));
const expandK = t => er(t, T.expand, T.compress, E.o3);

function spine(s, t) {
  const { Xb, R, yb, baseY, axisX, arc, hy } = SPK;
  if (s <= Xb) return [s, hy(s), 0];
  const sb = s - Xb;
  if (sb <= arc) { const ph = -Math.PI / 2 + sb / R; return [Xb + R * Math.cos(ph), yb + R + R * Math.sin(ph), 0]; }
  const h = sb - arc, tw = twistK(t);
  const rr = 64 * clamp(h / 420) * tw * (1 + 0.6 * expandK(t)), th = h * 0.0042;
  return [axisX - rr * Math.sin(th), baseY + h * vfac(t), rr * (Math.cos(th) - 1) * 0.5];
}
function ribNormal(s, t) {
  const h = s - SPK.Xb - SPK.arc;
  if (h <= 0) return [0, 0, 1];
  const ph = h * 0.0026 * twistK(t) + 0.35 * twistK(t) * (t - 17.4);
  return [Math.sin(ph), 0, Math.cos(ph)];
}

const PLATES = (() => {
  const out = [];
  for (let k = 0; k < 30; k++) {
    const h = 120 + k * 78;
    let lo = T.vert, hi = 21.2;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (headH(m) < h) lo = m; else hi = m; }
    out.push({ k, h, t: hi + 0.05, R: 232 + 58 * Math.sin(k * 0.42) + 18 * Math.sin(k * 1.7) });
  }
  return out;
})();
const plateRot = (k, t) => k * 0.075 + 0.22 * (t - 17);
const plateR = (pl, t) => pl.R * (1 + 0.55 * expandK(t));
function superPt(R, rot, a, n) {
  const c = Math.cos(a), s = Math.sin(a);
  const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * R, z = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * R;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  return [x * cr - z * sr, z * cr + x * sr];
}
function plateY(pl, t) { return SPK.baseY + pl.h * vfac(t); }

const TXT_RINGS = [5, 13, 21];

function drawSpike(ctx, t, cam) {
  const { Xb, axisX, baseY } = SPK;
  const sH = headS(t);
  const project = p => proj(cam, p);
  const retract = er(t, 21.4, 22.45, E.io3);
  const sStart = (Xb + SPK.arc * 0.6) * retract;

  // ── chart furniture (z = 0 plane) ──
  const fa = er(t, 15.35, 15.9) * (1 - er(t, 20.5, 21.4));
  if (fa > 0) {
    ctx.strokeStyle = col(P.cream, 0.28 * fa); ctx.lineWidth = 1;
    const k = er(t, 15.35, 16.4, E.io3);
    const a0 = project([-80, -60, 0]), a1 = project([lerp(-80, Xb + 700, k), -60, 0]);
    ctx.setLineDash([2, 5]); ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke(); ctx.setLineDash([]);
    const y1 = project([-80, lerp(-60, 300, k), 0]);
    ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(y1.x, y1.y); ctx.stroke();
    ctx.beginPath();
    for (let x = 10; x < Xb + 700; x += 90) { if (x > lerp(-80, Xb + 700, k)) break; const p = project([x, -60, 0]), q = project([x, -52, 0]); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); }
    ctx.stroke();
    // arrow head on y-axis (the chart's ceiling — the spike will leave it behind)
    if (k > 0.95) { const p = project([-80, 300, 0]); ctx.beginPath(); ctx.moveTo(p.x - 4, p.y + 7); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x + 4, p.y + 7); ctx.stroke(); }
    ctx.fillStyle = col(P.cream, 0.7 * fa);
    drawPlaneText(ctx, cam, FONT.mono(13, 500), 1, 'SEARCH INTEREST', [66, -112, 0], [1, 0, 0], [0, -1, 0], 3, 'fill', (i) => ({ a: er(t, 15.5 + i * 0.02, 15.7 + i * 0.02) }));
    ctx.fillStyle = col(P.cream, 0.4 * fa);
    drawPlaneText(ctx, cam, FONT.mono(10), 1, 'RELATIVE · CONCEPTUAL', [50, -136, 0], [1, 0, 0], [0, -1, 0], 2, 'fill', (i) => ({ a: er(t, 15.7 + i * 0.015, 15.9 + i * 0.015) }));
    drawPlaneText(ctx, cam, FONT.mono(10), 1, 'TIME →', [Xb + 640, -90, 0], [1, 0, 0], [0, -1, 0], 2, 'fill', () => ({ a: er(t, 16.2, 16.5) }));
  }

  // ── plates (floor slabs of the tower) ──
  const visPlates = PLATES.filter(pl => t > pl.t);
  for (const pl of visPlates) {
    const k = er(t, pl.t, pl.t + 0.45, E.io3);
    const R = plateR(pl, t), rot = plateRot(pl.k, t), y = plateY(pl, t);
    const pts = [];
    for (let i = 0; i <= 56; i++) { const q = superPt(R, rot, i / 56 * TAU, 4); pts.push(project([axisX + q[0], y, q[1]])); }
    ctx.fillStyle = col(P.em, 0.22 * k); pathPts(ctx, pts, true); ctx.fill();
    ctx.strokeStyle = col(P.cream, 0.55); ctx.lineWidth = 1;
    pathPts(ctx, partial(pts, k), false); ctx.stroke();
    if (k > 0.9) for (let c = 0; c < 4; c++) { const q = superPt(R, rot, Math.PI / 4 + c * Math.PI / 2, 4); const p = project([axisX + q[0], y, q[1]]); dot(ctx, p.x, p.y, 2.2 * Math.min(1.4, p.s * 1.2), P.lime, 0.9); }
  }
  // columns through the corners
  if (visPlates.length > 1) {
    ctx.strokeStyle = col(P.cream, 0.28); ctx.lineWidth = 1;
    for (let c = 0; c < 8; c++) {
      ctx.beginPath();
      visPlates.forEach((pl, i) => {
        const q = superPt(plateR(pl, t), plateRot(pl.k, t), Math.PI / 8 + c * Math.PI / 4, 4), p = project([axisX + q[0], plateY(pl, t), q[1]]);
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      });
      ctx.stroke();
    }
  }

  // ── ribbon ──
  const w = ribW(t);
  const S = [];
  for (let s = sStart; s < sH; s += 15) S.push(s);
  S.push(sH);
  const C = S.map(s => spine(s, t));
  if (w > 0.5 && S.length > 1) {
    const N = S.map(s => ribNormal(s, t));
    const A = C.map((c, i) => project(vadd(c, vmul(N[i], w / 2)))), B = C.map((c, i) => project(vadd(c, vmul(N[i], -w / 2))));
    const quads = [];
    const L = vnorm([0.4, 0.75, 0.55]);
    for (let i = 0; i < C.length - 1; i++) {
      const tg = vnorm(vsub(C[i + 1], C[i])), nn = vnorm(vcross(tg, N[i]));
      const toCam = vnorm(vsub(cam.pos, C[i]));
      const facing = vdot(nn, toCam);
      const light = 0.25 + 0.75 * Math.abs(vdot(nn, L));
      quads.push({ i, z: (A[i].z + B[i].z + A[i + 1].z + B[i + 1].z) / 4, light, facing });
    }
    quads.sort((a, b) => b.z - a.z);
    for (const q of quads) {
      const i = q.i;
      const c = q.facing > 0 ? mix(P.em, P.em3, q.light) : mix(P.deep, P.em2, q.light * 0.8);
      ctx.fillStyle = col(c, 0.94);
      ctx.beginPath(); ctx.moveTo(A[i].x, A[i].y); ctx.lineTo(A[i + 1].x, A[i + 1].y); ctx.lineTo(B[i + 1].x, B[i + 1].y); ctx.lineTo(B[i].x, B[i].y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col(c, 0.94); ctx.lineWidth = 0.8; ctx.stroke();
      if (i % 5 === 0) { ctx.strokeStyle = col(P.cream, 0.18); ctx.beginPath(); ctx.moveTo(A[i].x, A[i].y); ctx.lineTo(B[i].x, B[i].y); ctx.stroke(); }
    }
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = col(P.cream, 0.75); pathPts(ctx, A, false); ctx.stroke();
    ctx.strokeStyle = col(P.lime, 0.85); pathPts(ctx, B, false); ctx.stroke();
  }
  // spine (the data line itself)
  const sp = C.map(project);
  ctx.lineWidth = 1.7; ctx.strokeStyle = col(P.cream, 0.95); pathPts(ctx, sp, false); ctx.stroke();
  // data points on the quiet part
  if (t < 21.5) {
    for (let x = 90; x < Math.min(sH, Xb); x += 90) {
      const p = project([x, SPK.hy(x), 0]), g = project([x, -60, 0]);
      ctx.strokeStyle = col(P.cream, 0.14 * fa); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(g.x, g.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col(P.deep); ctx.beginPath(); ctx.arc(p.x, p.y, 3.3 * p.s, 0, TAU); ctx.fill();
      ring(ctx, p.x, p.y, 3.3 * p.s, P.cream, 0.85, 1);
    }
  }
  // head
  if (t < T.expand) {
    const hp = sp[sp.length - 1];
    dot(ctx, hp.x, hp.y, 3.6, P.lime, 1);
    const kick = t > T.vert ? 1 - rm(t, T.vert, 18.4) : 0;
    glow(ctx, hp.x, hp.y, 30 + 70 * kick, P.lime, 0.6 + 0.35 * kick);
    const la = er(t, 16.7, 17.0) * (1 - er(t, 19.8, 20.3));
    if (la > 0) {
      ctx.font = FONT.mono(11, 500); ctx.textAlign = 'left'; ctx.letterSpacing = '2px'; ctx.fillStyle = col(P.lime, la);
      ctx.fillText(scramble('ATTENTION ↑', la, 5), hp.x + 16, hp.y + 4); ctx.letterSpacing = '0px';
    }
  }

  // ── SPIKE: vertical kinetic word revealed by the rising line ──
  if (t > T.vert) {
    const font = FONT.sans(900, 230, 'expanded');
    const Lw = layout(font, 'SPIKE', 4);
    const vf = vfac(t);
    const y0 = baseY + 380 * vf;
    // the word's plane turns with the camera so it never reads mirrored
    const rh = vnorm([cam.r[0], 0, cam.r[2]]);
    const off = 470 + 180 * expandK(t);
    const o = [axisX + rh[0] * off, y0 + Lw.width / 2 * vf, rh[2] * off];
    ctx.fillStyle = col(P.cream, 0.96);
    drawPlaneText(ctx, cam, font, 1, 'SPIKE', o, [0, vf, 0], rh, 4, 'fill', (i, n, g) => {
      const gh = 380 + g.x; const k = clamp((headH(t) - gh + 120) / 260);
      return { a: E.o3(k), sy: Math.max(0.001, E.o4(k)) };
    });
    // hairline + label alongside
    const k2 = er(t, 17.6, 18.6);
    if (k2 > 0) {
      const rh2 = vnorm([cam.r[0], 0, cam.r[2]]), o2 = 250 + 180 * expandK(t);
      const p0 = project([axisX + rh2[0] * o2, y0, rh2[2] * o2]), p1 = project([axisX + rh2[0] * o2, y0 + (Lw.width * k2) * vf, rh2[2] * o2]);
      ctx.strokeStyle = col(P.lime, 0.8); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
  }

  // ── SEARCH INTEREST wrapped around the structure ──
  for (const ki of TXT_RINGS) {
    const pl = PLATES[ki];
    if (t < pl.t + 0.1) continue;
    const R = plateR(pl, t) + 34, y = plateY(pl, t) + 16 * vfac(t);
    const font = FONT.sans(700, 44, 'semi-expanded');
    const unit = 'SEARCH INTEREST · ';
    const uw = measure(font, unit) + unit.length * 2;
    const reps = Math.max(1, Math.floor(TAU * R / uw));
    const str = unit.repeat(reps);
    const Lr = layout(font, str, 2);
    const scaleA = TAU / (Lr.width + 2);
    const th0 = -0.35 * (t - pl.t) * (ki % 2 ? 1 : -1) + ki;
    const rev = er(t, pl.t + 0.1, pl.t + 0.9, E.o3);
    ctx.font = font; ctx.textAlign = 'center';
    Lr.glyphs.forEach((g, i) => {
      if (i / Lr.glyphs.length > rev) return;
      const th = th0 + g.x * scaleA;
      const Pw = [axisX + R * Math.sin(th), y, R * Math.cos(th)];
      const nrm = [Math.sin(th), 0, Math.cos(th)];
      const p0 = project(Pw);
      const face = vdot(nrm, vnorm(vsub(cam.pos, Pw)));
      const ax = [Math.cos(th), 0, -Math.sin(th)], ay = [0, -vfac(t) - 0.001, 0];
      const px = project(vadd(Pw, vmul(ax, 20))), py = project(vadd(Pw, vmul(ay, 20)));
      ctx.save();
      ctx.setTransform((px.x - p0.x) / 20, (px.y - p0.y) / 20, (py.x - p0.x) / 20, (py.y - p0.y) / 20, p0.x, p0.y);
      ctx.fillStyle = face > 0 ? col(P.lime, 0.95) : col(P.cream, 0.16);
      ctx.fillText(g.ch, 0, 0);
      ctx.restore();
    });
  }
}
