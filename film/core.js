'use strict';
// ─────────────────────────────────────────────────────────────
//  CORE — math, easing, colour, camera, typography helpers
// ─────────────────────────────────────────────────────────────
const W = 1920, H = 1080, CX = W / 2, CY = H / 2;
const FL = 1100;                 // focal length (px). camera dist FL => scale 1 on target plane
const FPS = 60;
const DUR = 32.5;
const TAU = Math.PI * 2, DEG = Math.PI / 180;

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const rm = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  lin: t => t,
  i2: t => t * t, o2: t => 1 - (1 - t) * (1 - t),
  i3: t => t * t * t, o3: t => 1 - Math.pow(1 - t, 3),
  io3: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  i4: t => t * t * t * t, o4: t => 1 - Math.pow(1 - t, 4),
  io4: t => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  o5: t => 1 - Math.pow(1 - t, 5),
  iE: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  oE: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  ioE: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  ios: t => -(Math.cos(Math.PI * t) - 1) / 2,
  oB: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
// eased remap
const er = (t, a, b, e = E.io3) => e(rm(t, a, b));

function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// smooth 1D value noise
function hash1(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function noise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash1(i), hash1(i + 1), u) * 2 - 1; }

// ── palette (restrained) ─────────────────────────────────────
const P = {
  ink:   [3, 8, 6],        // controlled black
  deep:  [5, 22, 16],      // deep green
  em:    [11, 47, 36],     // dark emerald
  em2:   [21, 92, 69],
  em3:   [46, 128, 96],
  cream: [237, 229, 208],  // warm cream
  lime:  [205, 242, 58],   // acid lime
  white: [245, 247, 240],
};
const col = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ── vectors ─────────────────────────────────────────────────
const v3 = (x, y, z) => [x, y, z];
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vmul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vlen = a => Math.hypot(a[0], a[1], a[2]);
const vnorm = a => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const vlerp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
// rotate v around unit axis k by angle
function vrot(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a), d = vdot(k, v), cr = vcross(k, v);
  return [v[0] * c + cr[0] * s + k[0] * d * (1 - c), v[1] * c + cr[1] * s + k[1] * d * (1 - c), v[2] * c + cr[2] * s + k[2] * d * (1 - c)];
}

// ── camera ──────────────────────────────────────────────────
// yaw/pitch in radians. pitch = +90° looks straight down, screen-up = world -z.
function makeCam(target, dist, yaw, pitch, roll = 0, fl = FL) {
  pitch = clamp(pitch, -89.7 * DEG, 89.7 * DEG);
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const o = [cp * sy, sp, cp * cy];
  const pos = [target[0] + o[0] * dist, target[1] + o[1] * dist, target[2] + o[2] * dist];
  const f = [-o[0], -o[1], -o[2]];
  const rl = Math.hypot(o[2], o[0]);
  let r = [o[2] / rl, 0, -o[0] / rl];
  let u = vcross(r, f);
  if (roll) {
    const c = Math.cos(roll), s = Math.sin(roll);
    const r2 = [r[0] * c + u[0] * s, r[1] * c + u[1] * s, r[2] * c + u[2] * s];
    const u2 = [u[0] * c - r[0] * s, u[1] * c - r[1] * s, u[2] * c - r[2] * s];
    r = r2; u = u2;
  }
  return { pos, f, r, u, fl, target, dist };
}
function proj(cam, p) {
  const dx = p[0] - cam.pos[0], dy = p[1] - cam.pos[1], dz = p[2] - cam.pos[2];
  const z = dx * cam.f[0] + dy * cam.f[1] + dz * cam.f[2];
  const x = dx * cam.r[0] + dy * cam.r[1] + dz * cam.r[2];
  const y = dx * cam.u[0] + dy * cam.u[1] + dz * cam.u[2];
  const s = cam.fl / Math.max(z, 1);
  return { x: CX + x * s, y: CY - y * s, z, s };
}
// keyframed camera: keys = [{t, tg:[x,y,z], d, yaw, pitch, e?}]
function camKeys(keys, t) {
  if (t <= keys[0].t) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t <= b.t) {
      const k = (b.e || E.io3)(rm(t, a.t, b.t));
      return {
        tg: vlerp(a.tg, b.tg, k), d: lerp(a.d, b.d, k),
        yaw: lerp(a.yaw, b.yaw, k), pitch: lerp(a.pitch, b.pitch, k), roll: lerp(a.roll || 0, b.roll || 0, k),
      };
    }
  }
  return keys[keys.length - 1];
}

// ── typography ──────────────────────────────────────────────
const FONT = {
  sans: (w, px, st = 'normal') => `${w} ${st} ${px}px Archivo`,
  serif: px => `italic ${px}px "Instrument Serif"`,
  serifR: px => `${px}px "Instrument Serif"`,
  mono: (px, w = 400) => `${w} ${px}px JBM`,
};
const _mw = new Map();
let _mctx = null;
function measure(font, s) {
  const k = font + '|' + s;
  let v = _mw.get(k);
  if (v === undefined) {
    if (!_mctx) _mctx = document.createElement('canvas').getContext('2d');
    _mctx.font = font; v = _mctx.measureText(s).width; _mw.set(k, v);
  }
  return v;
}
// per-glyph layout: returns [{ch, x (center), w}] and total width, with tracking in px
function layout(font, str, track = 0) {
  const out = []; let x = 0;
  for (const ch of str) {
    const w = measure(font, ch);
    out.push({ ch, x: x + w / 2, w });
    x += w + track;
  }
  const total = x - track;
  return { glyphs: out, width: total };
}
// draw a string glyph-by-glyph; fn(i, n, g) -> {dx,dy,a,sx,sy,rot} (optional)
function drawGlyphs(ctx, font, str, x, y, track, align, fill, fn) {
  const L = layout(font, str, track);
  const x0 = align === 'center' ? x - L.width / 2 : align === 'right' ? x - L.width : x;
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const n = L.glyphs.length;
  L.glyphs.forEach((g, i) => {
    const o = fn ? fn(i, n, g) : null;
    if (o && o.a !== undefined && o.a <= 0.002) return;
    ctx.save();
    ctx.translate(x0 + g.x + (o && o.dx || 0), y + (o && o.dy || 0));
    if (o && o.rot) ctx.rotate(o.rot);
    if (o && (o.sx !== undefined || o.sy !== undefined)) ctx.scale(o.sx ?? 1, o.sy ?? 1);
    ctx.globalAlpha *= o && o.a !== undefined ? o.a : 1;
    if (fill === 'stroke') ctx.strokeText(g.ch, 0, 0); else ctx.fillText(g.ch, 0, 0);
    ctx.restore();
  });
  return L.width;
}
// glyphs on a 3D plane: origin = baseline centre of string (world); ax = reading dir, ay = glyph-down dir,
// both in world units per font px (times `scale`). fn(i,n,g) -> {a, sy, lift(font px, upward)}
function drawPlaneText(ctx, cam, font, scale, str, origin, ax, ay, track, style, fn) {
  const L = layout(font, str, track);
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const n = L.glyphs.length;
  ax = vmul(ax, scale); ay = vmul(ay, scale);
  L.glyphs.forEach((g, i) => {
    const o = fn ? fn(i, n, g) : null;
    if (o && o.a !== undefined && o.a <= 0.002) return;
    const off = g.x - L.width / 2;
    let P0 = vadd(origin, vmul(ax, off));
    if (o && o.lift) P0 = vadd(P0, vmul(ay, -o.lift));
    const p0 = proj(cam, P0);
    if (p0.z < 20) return;
    const k = 24;
    const px = proj(cam, vadd(P0, vmul(ax, k)));
    const py = proj(cam, vadd(P0, vmul(ay, k)));
    ctx.save();
    ctx.setTransform((px.x - p0.x) / k, (px.y - p0.y) / k, (py.x - p0.x) / k, (py.y - p0.y) / k, p0.x, p0.y);
    ctx.globalAlpha *= o && o.a !== undefined ? o.a : 1;
    if (o && o.sy !== undefined) ctx.scale(1, o.sy);
    if (style === 'stroke') ctx.strokeText(g.ch, 0, 0); else ctx.fillText(g.ch, 0, 0);
    ctx.restore();
  });
  return L.width;
}
// scramble text resolve (for data-like labels)
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·—+';
function scramble(str, k, seed) {
  if (k >= 1) return str;
  const n = str.length, done = Math.floor(k * n);
  let s = '';
  for (let i = 0; i < n; i++) {
    if (i < done || str[i] === ' ') s += str[i];
    else s += GLYPHS[Math.floor(hash1(seed + i * 7.3 + Math.floor(k * 30)) * GLYPHS.length)];
  }
  return s;
}

// ── polylines & shapes ──────────────────────────────────────
function resample(pts, n, closed = true) {
  const P = closed ? pts.concat([pts[0]]) : pts.slice();
  const seg = []; let tot = 0;
  for (let i = 0; i < P.length - 1; i++) { const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); seg.push(l); tot += l; }
  const out = []; let si = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const d = (k / (closed ? n : n - 1)) * tot;
    while (si < seg.length - 1 && acc + seg[si] < d) { acc += seg[si]; si++; }
    const u = seg[si] ? (d - acc) / seg[si] : 0;
    out.push([lerp(P[si][0], P[si + 1][0], u), lerp(P[si][1], P[si + 1][1], u)]);
  }
  return out;
}
function signedArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
function pathPts(ctx, pts, closed) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i].x, pts[i].y) : ctx.moveTo(pts[i].x, pts[i].y);
  if (closed) ctx.closePath();
}
// partial polyline draw (progress 0..1) of projected points
function partial(pts, k) {
  if (k >= 1) return pts;
  const n = pts.length - 1, f = k * n, i = Math.floor(f), u = f - i;
  const out = pts.slice(0, i + 1);
  if (i < n) out.push({ x: lerp(pts[i].x, pts[i + 1].x, u), y: lerp(pts[i].y, pts[i + 1].y, u) });
  return out;
}
function quadBez(a, c, b, u) { const v = 1 - u; return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]; }

// glow sprite
let GLOW = null;
function glowSprite() {
  if (GLOW) return GLOW;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.45)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  GLOW = c; return c;
}
const _tint = new Map();
function tintedGlow(c) {
  const k = c.join(',');
  if (_tint.has(k)) return _tint.get(k);
  const s = glowSprite(), o = document.createElement('canvas'); o.width = o.height = 128;
  const g = o.getContext('2d'); g.drawImage(s, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col(c); g.fillRect(0, 0, 128, 128);
  _tint.set(k, o); return o;
}
function glow(ctx, x, y, r, c, a) {
  if (a <= 0.003 || r <= 0.5) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
  ctx.drawImage(tintedGlow(c), x - r, y - r, r * 2, r * 2); ctx.restore();
}
function dot(ctx, x, y, r, c, a = 1) { ctx.fillStyle = col(c, a); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
function ring(ctx, x, y, r, c, a, lw = 1) { if (a <= 0.003 || r <= 0) return; ctx.strokeStyle = col(c, a); ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }

// ── sound-event registry (read by the audio synthesiser) ────
const SFX = [];
function sfx(t, type, o = {}) { SFX.push(Object.assign({ t: +t.toFixed(4), type }, o)); }
const panX = x => clamp((x - CX) / CX, -1, 1);
