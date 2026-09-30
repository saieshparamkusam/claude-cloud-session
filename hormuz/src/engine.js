// ---------------------------------------------------------------------------
// Engine: maths, easing, deterministic noise, fonts, a perspective camera for
// the AEQD (km) world plane, and small drawing helpers. Canvas2D only.
// ---------------------------------------------------------------------------
'use strict';

const W = 1920, H = 1080, FPS = 30;
const SS = 2;                 // internal supersampling factor

// ---------------------------------------------------------------- maths
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, v) => clamp((v - a) / (b - a));
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const E = {
  lin: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  inOutQuint: t => t < .5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2,
  outQuint: t => 1 - Math.pow(1 - t, 5),
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  inOutExpo: t => t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

// eased progress of t within [a,b]
const seg = (t, a, b, e = E.inOutCubic) => e(inv(a, b, t));
// envelope: 0 → 1 over [a,b], 1 → 0 over [c,d]
const env = (t, a, b, c, d, ei = E.outCubic, eo = E.inCubic) =>
  t < b ? ei(inv(a, b, t)) : t < c ? 1 : 1 - eo(inv(c, d, t));

// keyframe track: [[t, v, ease], ...]; ease applies to the segment ending at that key
function track(keys, t, log = false) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      const k = (e || E.inOutCubic)(inv(t0, t1, t));
      return log ? Math.exp(lerp(Math.log(v0), Math.log(v1), k)) : lerp(v0, v1, k);
    }
  }
  return keys[keys.length - 1][1];
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- colour
const C = {
  bg0: [2, 10, 8], bg1: [5, 20, 16],
  land: [17, 53, 42], landHi: [24, 70, 55],
  teal: [18, 70, 66], tealHi: [36, 110, 100],
  lime: [206, 244, 66], cream: [239, 233, 216], stone: [150, 158, 140],
  emer: [30, 88, 70],
};
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---------------------------------------------------------------- fonts
// Mona Sans is instanced offline at width 75..125 (step 5) and 4 weights; a
// continuous width is rendered with the nearest lower instance plus a tiny
// horizontal correction, so width can be animated smoothly.
const MONA_W = [300, 450, 700, 850];
async function loadFonts() {
  const jobs = [];
  for (const wg of MONA_W) for (let wd = 75; wd <= 125; wd += 5) {
    const ff = new FontFace(`M${wd}_${wg}`, `url(../fonts/inst/Mona_${wd}_${wg}.ttf)`);
    jobs.push(ff.load().then(f => document.fonts.add(f)));
  }
  for (const wg of [300, 400, 500]) {
    const ff = new FontFace(`G${wg}`, `url(../fonts/inst/Geist_${wg}.ttf)`);
    jobs.push(ff.load().then(f => document.fonts.add(f)));
  }
  await Promise.all(jobs);
}
const mono = (px, wg = 400) => `${px}px G${wg}`;

// resolve a continuous width to (fontString, scaleX)
function monaFont(ctx, px, wd, wg, sample = 'HORMUZ') {
  wd = clamp(wd, 75, 125);
  const w0 = Math.min(120, Math.floor(wd / 5) * 5), w1 = w0 + 5;
  const f0 = `${px}px M${w0}_${wg}`, f1 = `${px}px M${w1}_${wg}`;
  const fr = (wd - w0) / 5;
  if (fr < 1e-3) return [f0, 1];
  ctx.font = f0; const a = ctx.measureText(sample).width;
  ctx.font = f1; const b = ctx.measureText(sample).width;
  return [f0, lerp(a, b, fr) / a];
}

// draw text letter by letter (tracking in px, continuous width), returns total width
// opts: {px, wd, wg, track, align:'left'|'center'|'right', fill, stroke, lw, perLetter(i,n)->{dx,dy,a,sx}}
function typeset(ctx, str, x, y, o) {
  const [font, sx] = monaFont(ctx, o.px, o.wd ?? 100, o.wg ?? 450, str);
  ctx.font = font;
  const chars = [...str];
  const adv = chars.map(ch => ctx.measureText(ch).width * sx);
  const tr = o.track ?? 0;
  let total = adv.reduce((s, v) => s + v, 0) + tr * (chars.length - 1);
  let x0 = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  let cx = x0;
  for (let i = 0; i < chars.length; i++) {
    const pl = o.perLetter ? o.perLetter(i, chars.length, cx - x0, total) : null;
    const a = pl?.a ?? 1;
    if (a > 0.003) {
      ctx.save();
      ctx.translate(cx + (pl?.dx ?? 0), y + (pl?.dy ?? 0));
      ctx.scale(sx * (pl?.sx ?? 1), pl?.sy ?? 1);
      ctx.globalAlpha *= a;
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fillText(chars[i], 0, 0); }
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = (o.lw ?? 1) / sx; ctx.strokeText(chars[i], 0, 0); }
      ctx.restore();
    }
    cx += adv[i] + tr;
  }
  return total;
}

// monospace label with tracking (ctx.letterSpacing)
function label(ctx, str, x, y, { px = 13, wg = 400, track = 0.18, fill = rgba(C.cream, .8), align = 'left', base = 'alphabetic' } = {}) {
  ctx.font = mono(px, wg);
  ctx.letterSpacing = `${(track * px).toFixed(2)}px`;
  ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillStyle = fill;
  // letterSpacing adds trailing space; compensate for centre/right
  const pad = align === 'center' ? track * px / 2 : align === 'right' ? track * px : 0;
  ctx.fillText(str, x + pad, y);
  const w = ctx.measureText(str).width;
  ctx.letterSpacing = '0px'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  return w;
}

// ---------------------------------------------------------------- camera
// World: x east (km), y north (km), z up (km). pitch 0 = straight down.
function makeCamera({ tx, ty, tz = 0, viewH, pitch, yaw, fov = 30, ox = 0, oy = 0 }) {
  const f2 = Math.tan(fov * DEG / 2);
  const d = viewH / 2 / f2;
  const p = pitch * DEG, y = yaw * DEG;
  const hx = Math.sin(y), hy = Math.cos(y);          // screen-up heading on the ground
  const rx = Math.cos(y), ry = -Math.sin(y);         // screen-right
  const fx = hx * Math.sin(p), fy = hy * Math.sin(p), fz = -Math.cos(p);   // forward
  const ux = hx * Math.cos(p), uy = hy * Math.cos(p), uz = Math.sin(p);    // up
  const cx = tx - fx * d, cy = ty - fy * d, cz = tz - fz * d;
  const F = (H / 2) / f2;
  const X0 = W / 2 + ox, Y0 = H / 2 + oy;
  const near = d * 0.02;
  const cam = {
    d, F, viewH, pitch, yaw, near, rx, ry, hx, hy, fx, fy, fz, ux, uy, uz, cx, cy, cz, X0, Y0,
    pxPerKm: F / d,
    D(x, y, z) { return (x - cx) * fx + (y - cy) * fy + (z - cz) * fz; },
    // returns screen x,y in out[0..1] and depth; false if behind camera
    P(x, y, z, out) {
      const vx = x - cx, vy = y - cy, vz = z - cz;
      const zc = vx * fx + vy * fy + vz * fz;
      if (zc < near) return false;
      const k = F / zc;
      out[0] = X0 + (vx * rx + vy * ry) * k;
      out[1] = Y0 - (vx * ux + vy * uy + vz * uz) * k;
      out[2] = zc;
      return true;
    },
  };
  return cam;
}

const _p = [0, 0, 0];
// add a polyline (x[],y[], z scalar or fn(i)) to the current path, clipped
// against the camera near plane (so fills stay valid at steep pitch)
function path3(ctx, cam, xs, ys, z, closed = false, from = 0, to = xs.length) {
  const zf = typeof z === 'function';
  const near = cam.near * 1.001;
  let pen = false, first = true, px = 0, py = 0, pz = 0, pd = 0, pin = false;
  const cnt = to - from + (closed ? 1 : 0);
  for (let k = 0; k < cnt; k++) {
    const i = from + (k % (to - from));
    const x = xs[i], y = ys[i], zz = zf ? z(i) : z;
    const d = cam.D(x, y, zz), inn = d >= near;
    if (!first && inn !== pin) {
      const u = (near - pd) / (d - pd);
      cam.P(px + (x - px) * u, py + (y - py) * u, pz + (zz - pz) * u, _p);
      if (pen) ctx.lineTo(_p[0], _p[1]); else { ctx.moveTo(_p[0], _p[1]); pen = true; }
      if (!inn && !closed) pen = false;
    }
    if (inn) {
      cam.P(x, y, zz, _p);
      if (pen) ctx.lineTo(_p[0], _p[1]); else { ctx.moveTo(_p[0], _p[1]); pen = true; }
    }
    first = false; px = x; py = y; pz = zz; pd = d; pin = inn;
  }
  if (closed && pen) ctx.closePath();
}

// polyline with seam flags: only real coastline edges are stroked
function coast3(ctx, cam, r, z = 0) {
  const xs = r.x, ys = r.y, s = r.s;
  let pen = false;
  for (let i = 0; i < xs.length - 1; i++) {
    if (s[i]) { pen = false; continue; }
    if (!pen) { if (!cam.P(xs[i], ys[i], z, _p)) continue; ctx.moveTo(_p[0], _p[1]); pen = true; }
    if (cam.P(xs[i + 1], ys[i + 1], z, _p)) ctx.lineTo(_p[0], _p[1]); else pen = false;
  }
}

// ---------------------------------------------------------------- polyline sampling
function makePath(xs, ys) {
  const n = xs.length;
  const L = new Float64Array(n);
  for (let i = 1; i < n; i++) L[i] = L[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  return { x: Float64Array.from(xs), y: Float64Array.from(ys), L, len: L[n - 1], n };
}
// sample position + unit tangent at arc length s
function sampleP(pth, s, out) {
  const L = pth.L;
  if (s <= 0) s = 0; else if (s >= pth.len) s = pth.len - 1e-6;
  let lo = 0, hi = pth.n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] <= s) lo = m; else hi = m; }
  const segL = L[hi] - L[lo] || 1e-9;
  const k = (s - L[lo]) / segL;
  const dx = pth.x[hi] - pth.x[lo], dy = pth.y[hi] - pth.y[lo];
  out[0] = pth.x[lo] + dx * k; out[1] = pth.y[lo] + dy * k;
  out[2] = dx / segL; out[3] = dy / segL;
  return out;
}

// ---------------------------------------------------------------- canvases
function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
