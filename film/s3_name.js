'use strict';
// ─────────────────────────────────────────────────────────────
//  SCENE 3 · THE NAME  (8.4 → 15.2s)
//  burst → orbital attention system → "ronaldo" typed → multiplies
//  through a network → dominates the frame → collapses to a point
// ─────────────────────────────────────────────────────────────
const F3 = [MAP.Mw[0], 230, MAP.Mw[2]];

const ORB = (() => {
  const r = rng(21), planes = [];
  for (let j = 0; j < 6; j++) {
    const n = vnorm([r() - 0.5, 0.5 + r() * 1.2, r() - 0.5]);
    const e1 = vnorm(vcross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1]));
    planes.push({ n, e1, e2: vcross(n, e1), dir: j % 2 ? 1 : -1 });
  }
  return planes;
})();
const G3 = t => (t - T.collide) + 0.85 * Math.pow(Math.max(0, t - 11.2), 2);
const R3 = t => (1 - 0.3 * er(t, 10.5, 13.6)) * (1 - E.iE(rm(t, T.collapse3, T.point3)));

function partPos(q, t) {
  const tau = Math.max(0, t - T.collide), k = 3.0, f = (1 - Math.exp(-k * tau)) / k;
  let p = [q.p0[0] + q.v[0] * f, q.p0[1] + q.v[1] * f, q.p0[2] + q.v[2] * f];
  const w = E.io3(rm(t, 8.95 + q.h * 0.6, 10.4 + q.h * 0.6));
  if (w > 0) {
    const pl = ORB[q.pl], th = q.ph + pl.dir * q.sp * G3(t), rr = (110 + 430 * Math.pow(q.r, 0.8)) * R3(t);
    const c = Math.cos(th) * rr, s = Math.sin(th) * rr;
    const o = [F3[0] + pl.e1[0] * c + pl.e2[0] * s, F3[1] + pl.e1[1] * c + pl.e2[1] * s, F3[2] + pl.e1[2] * c + pl.e2[2] * s];
    p = vlerp(p, o, w);
  }
  return p;
}

const TREE = (() => {
  const r = rng(99), nodes = [null];
  const labels = ['RONALDO', 'RONALDO', 'RONALDO', 'CRISTIANO RONALDO', 'RONALDO', 'CR7', 'RONALDO', 'RONALDO · PORTUGAL', 'RONALDO', 'PORTUGAL · WALES'];
  for (let i = 1; i < 64; i++) {
    const gen = Math.floor(Math.log2(i));
    let dir;
    if (i === 1) dir = [0, 0, 0];
    else if (gen === 1) dir = vnorm([r() - 0.5, r() - 0.5, r() - 0.5]);
    else { const pd = nodes[i >> 1].dir; dir = vnorm(vadd(pd, [(r() - 0.5) * 1.3, (r() - 0.5) * 1.3, (r() - 0.5) * 1.3])); }
    const t0 = 10.75 + (gen - 1) * 0.21 + r() * 0.06;
    nodes.push({ i, gen, dir, rad: gen ? 70 + gen * 74 : 0, t: gen ? t0 : 10.6, label: labels[Math.floor(r() * labels.length)] });
  }
  return nodes;
})();
const spinN = t => 0.25 * (t - 10.6) + 0.55 * Math.pow(Math.max(0, t - 12), 2);
function nodePos(n, t, sc) {
  const a = spinN(t), c = Math.cos(a), s = Math.sin(a);
  const d = [n.dir[0] * c + n.dir[2] * s, n.dir[1], -n.dir[0] * s + n.dir[2] * c];
  return vadd(F3, vmul(d, n.rad * sc));
}

// sonar rings
const RINGS3 = [9.55, 10.35, 10.95, 11.45, 11.85, 12.2, 12.5, 12.75, 12.97, 13.17, 13.35, 13.52, 13.68];

// geometric numeral 7 (screen units, centred)
const SEVEN = [[-250, -340], [270, -340], [270, -262], [-10, 380], [-120, 380], [150, -250], [-250, -250]];

function drawName(ctx, t, cam) {
  const c3 = proj(cam, F3), cx = c3.x, cy = c3.y;
  const sc = 1 - E.iE(rm(t, T.collapse3, T.point3));
  const rot = 0.5 * E.i3(rm(t, T.collapse3, T.point3));

  // ── sonar rings (behind) ──
  for (const r0 of RINGS3) {
    const k = rm(t, r0, r0 + 1.2);
    if (k <= 0 || k >= 1) continue;
    ring(ctx, cx, cy, (24 + 760 * E.o3(k)) * sc, P.cream, 0.32 * (1 - k), 1);
  }

  // ── particles ──
  if (t < T.point3 + 0.02) {
    const cls = [[], [], [], []];
    const fade = er(t, T.collide, T.collide + 0.05);
    for (const q of PARTS) {
      const a = proj(cam, partPos(q, t)), b = proj(cam, partPos(q, t - 0.011));
      if (a.z < 30) continue;
      cls[q.cls].push(a.x, a.y, b.x, b.y);
    }
    const style = [col(P.cream, 0.7), col(mix(P.em3, P.cream, 0.35), 0.8), col(P.cream, 0.4), col(P.lime, 0.9)];
    ctx.lineCap = 'round';
    for (let c = 0; c < 4; c++) {
      const L = cls[c]; ctx.strokeStyle = style[c]; ctx.lineWidth = c === 2 ? 1.1 : 1.7; ctx.globalAlpha = fade;
      ctx.beginPath();
      for (let i = 0; i < L.length; i += 4) {
        let dx = L[i] - L[i + 2], dy = L[i + 1] - L[i + 3];
        if (dx * dx + dy * dy < 1) { dx = 0.6; dy = 0; }
        ctx.moveTo(L[i + 2], L[i + 3]); ctx.lineTo(L[i + 2] + dx, L[i + 3] + dy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ── numeral 7, built from lines ──
  const s7 = er(t, 11.0, 11.7, E.io3) * (1 - er(t, 12.8, 13.2));
  if (s7 > 0 && sc > 0.01) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.04 + rot); ctx.scale(sc * 0.95, sc * 0.95); ctx.translate(40, 0);
    const pts = SEVEN.map(p => ({ x: p[0], y: p[1] }));
    ctx.strokeStyle = col(P.lime, 0.75 * s7); ctx.lineWidth = 1.3;
    pathPts(ctx, partial(pts.concat([pts[0]]), E.io3(rm(t, 11.0, 11.9))), false); ctx.stroke();
    ctx.save(); pathPts(ctx, pts, true); ctx.clip();
    const hk = er(t, 11.3, 12.2, E.o3);
    ctx.strokeStyle = col(P.lime, 0.28 * s7); ctx.lineWidth = 1; ctx.beginPath();
    for (let x = -700; x < -700 + 1400 * hk; x += 11) { ctx.moveTo(x, -400); ctx.lineTo(x + 800, 400); }
    ctx.stroke(); ctx.restore();
    ctx.font = FONT.mono(12); ctx.fillStyle = col(P.lime, 0.8 * s7); ctx.textAlign = 'left'; ctx.letterSpacing = '2px';
    ctx.fillText('Nº 7', 290, -330); ctx.letterSpacing = '0px';
    ctx.restore();
  }

  // ── network (binary multiplication tree) ──
  if (t > 10.55 && sc > 0.01) {
    const growSc = sc * (1 + 0.25 * er(t, 11.8, 13.4));
    const pos = TREE.map(n => n && proj(cam, nodePos(n, t, growSc)));
    ctx.lineWidth = 0.8;
    for (let i = 2; i < 64; i++) {
      const n = TREE[i], pa = pos[i >> 1], pb = pos[i];
      const k = rm(t, n.t - 0.2, n.t);
      if (k <= 0) continue;
      const x = lerp(pa.x, pb.x, E.io3(k)), y = lerp(pa.y, pb.y, E.io3(k));
      ctx.strokeStyle = col(P.cream, 0.22); ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(x, y); ctx.stroke();
      if (k < 1) { dot(ctx, x, y, 2.4, P.lime, 1); glow(ctx, x, y, 14, P.lime, 0.5); }
    }
    ctx.textAlign = 'left'; ctx.letterSpacing = '1.5px';
    for (let i = 2; i < 64; i++) {
      const n = TREE[i], p = pos[i], k = er(t, n.t, n.t + 0.18, E.oB);
      if (k <= 0) continue;
      const depth = clamp(1.25 - (p.z - cam.dist) / 700, 0.25, 1);
      dot(ctx, p.x, p.y, 2.6 * k, n.gen % 2 ? P.lime : P.cream, depth);
      const fs = n.gen <= 2 ? 13 : n.gen <= 4 ? 11 : 10;
      ctx.font = FONT.mono(fs, 500);
      ctx.fillStyle = col(P.cream, (n.gen <= 3 ? 0.9 : 0.6) * depth * clamp(k));
      ctx.fillText(n.gen <= 4 ? n.label : 'RONALDO', p.x + 8, p.y - 6);
    }
    ctx.letterSpacing = '0px';
  }

  // ── repeated rows: the frame fills with the name ──
  if (t > T.rows && sc > 0.01) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
    const font = FONT.sans(900, 118, 'expanded');
    const unit = 'RONALDO  ';
    const uw = measure(font, unit);
    ctx.font = font; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const spd = 1 + 3 * E.i3(rm(t, T.rows, T.collapse3 + 0.4));
    for (let k = -4; k <= 4; k++) {
      if (k === 0) continue;
      const rv = er(t, T.rows + Math.abs(k) * 0.055, T.rows + 0.4 + Math.abs(k) * 0.055, E.o4);
      if (rv <= 0) continue;
      const y = cy + k * 126;
      const dir = k % 2 ? 1 : -1;
      const off = ((dir * (t - T.rows) * 520 * spd + k * 211) % uw + uw) % uw;
      ctx.save();
      ctx.beginPath(); ctx.rect(cx - W * rv, y - 63, W * 2 * rv, 126); ctx.clip();
      if (Math.abs(k) % 2) { ctx.strokeStyle = col(P.cream, 0.42); ctx.lineWidth = 1.2; }
      else ctx.fillStyle = col(P.em2, 0.95);
      for (let x = -uw + off - W; x < W * 2; x += uw) {
        if (Math.abs(k) % 2) ctx.strokeText(unit, x, y + 4); else ctx.fillText(unit, x, y + 4);
      }
      ctx.restore();
    }
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // ── the centre word ──
  if (t > 9.45 && t < T.point3) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc);
    const grow = Math.exp(Math.log(13) * E.io4(rm(t, T.grow, 13.3)));
    if (t < 10.25) {
      // typed query with caret
      const typed = 'ronaldo';
      const n = Math.floor(rm(t, 9.72, 9.72 + 0.075 * 7) * 7 + 0.0001);
      const f = FONT.mono(26, 400);
      const w = measure(f, typed.slice(0, n));
      ctx.font = f; ctx.textAlign = 'left'; ctx.fillStyle = col(P.cream, 1);
      ctx.fillText(typed.slice(0, n), -measure(f, typed) / 2, 9);
      const blink = (Math.floor(t * 3.4) % 2 === 0) || (t > 9.72 && t < 10.3);
      if (blink) { ctx.fillStyle = col(P.lime, 1); ctx.fillRect(-measure(f, typed) / 2 + w + 3, -14, 2.5, 30); }
    } else {
      const fA = FONT.mono(26, 400), fB = FONT.sans(800, 34, 'expanded');
      const la = layout(fA, 'ronaldo', 0), lb = layout(fB, 'RONALDO', lerp(6, -1, rm(t, T.grow, 13.3)));
      ctx.textAlign = 'center';
      for (let i = 0; i < 7; i++) {
        const tf = 10.3 + i * 0.035, k = rm(t, tf - 0.07, tf + 0.07);
        const x = lerp(la.glyphs[i].x - la.width / 2, lb.glyphs[i].x - lb.width / 2, E.io3(k));
        ctx.save(); ctx.scale(grow, grow); ctx.translate(x, 0);
        if (k < 0.5) { ctx.scale(1, 1 - 2 * k); ctx.font = fA; ctx.fillStyle = col(P.cream); ctx.fillText('ronaldo'[i], 0, 9); }
        else { ctx.scale(1, 2 * k - 1); ctx.font = fB; ctx.fillStyle = col(P.cream); ctx.fillText('RONALDO'[i], 0, 12); }
        ctx.restore();
      }
      // targeting brackets
      const bk = er(t, 10.55, 10.8, E.o3) * (1 - er(t, 11.8, 12.1));
      if (bk > 0) {
        const bw = lb.width / 2 + 22 + (1 - bk) * 40, bh = 30 + (1 - bk) * 20, L = 10;
        ctx.strokeStyle = col(P.lime, bk); ctx.lineWidth = 1.4; ctx.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(sx * bw, sy * bh + -sy * L); ctx.lineTo(sx * bw, sy * bh); ctx.lineTo(sx * bw - sx * L, sy * bh); }
        ctx.stroke();
        ctx.font = FONT.mono(10); ctx.fillStyle = col(P.lime, 0.9 * bk); ctx.textAlign = 'left'; ctx.letterSpacing = '2px';
        ctx.fillText('SIGNAL — ATTENTION DRIVER', -bw, -bh - 12); ctx.letterSpacing = '0px';
      }
    }
    ctx.restore();
  }

  // ── the single point ──
  if (t > T.point3 - 0.12 && t < T.s4 + 0.02) {
    const k = er(t, T.point3 - 0.12, T.point3, E.o3);
    dot(ctx, cx, cy, 4 * k, P.lime, 1);
    glow(ctx, cx, cy, 70 * (1 - 0.5 * rm(t, T.point3, T.s4)), P.lime, 0.9 * k);
    const pr = rm(t, T.point3, T.point3 + 0.5);
    if (pr > 0 && pr < 1) ring(ctx, cx, cy, 6 + 90 * E.o3(pr), P.lime, 0.7 * (1 - pr), 1.2);
  }
}
