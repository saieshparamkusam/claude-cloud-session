// HORMUZ — a motion-design film. Deterministic frame renderer.
// World units: X = (lon-LON0)*KX, Y = lat-LAT0 (degrees), Z up.
'use strict';
const W = 1920, H = 1080, FPS = 30, DUR = 37.0;
const LON0 = 56.40, LAT0 = 26.60, KX = Math.cos(26.6 * Math.PI / 180);
const C = {
  bg: '#030c0a', cream: '237,230,211', lime: '205,245,60', grey: '150,158,150', teal: '40,120,108',
};
// ---------------------------------------------------------------- utils
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const ss = (a, b, x) => { const t = inv(a, b, x); return t * t * (3 - 2 * t); };
const E = {
  lin: t => t,
  io: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  io2: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  in2: t => t * t,
  in3: t => t * t * t,
  out3: t => 1 - Math.pow(1 - t, 3),
  out5: t => 1 - Math.pow(1 - t, 5),
  expo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  hold: t => 0,
};
// window with fade in/out
const win = (t, a, b, fi = .4, fo = .4) => Math.min(inv(a, a + fi, t), 1 - inv(b - fo, b, t));
function key(t, ks) { // ks: [[t, v, ease]]
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1], [t1, v1, e] = ks[i];
      const u = (E[e || 'io'])((t - t0) / (t1 - t0));
      return Array.isArray(v0) ? v0.map((x, j) => lerp(x, v1[j], u)) : lerp(v0, v1, u);
    }
  }
  return ks[ks.length - 1][1];
}
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const toW = (lon, lat) => [(lon - LON0) * KX, lat - LAT0];
const toLL = (x, y) => [x / KX + LON0, y + LAT0];
const fmt = n => Math.round(n).toLocaleString('en-US');

// ---------------------------------------------------------------- mat4
const M4 = {
  mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
  persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
  look(e, c, u) {
    let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z = z.map(v => v / l);
    let x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x = x.map(v => v / l);
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    const o = new Float32Array(16);
    o[0] = x[0]; o[4] = x[1]; o[8] = x[2]; o[1] = y[0]; o[5] = y[1]; o[9] = y[2]; o[2] = z[0]; o[6] = z[1]; o[10] = z[2];
    o[12] = -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]); o[13] = -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]); o[14] = -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]); o[15] = 1;
    return o;
  }
};

// ---------------------------------------------------------------- data
const DATA = {};
function h2f(h) { const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 31, m = h & 1023; if (e === 0) return s * Math.pow(2, -14) * (m / 1024); if (e === 31) return 0; return s * Math.pow(2, e - 15) * (1 + m / 1024); }
async function loadData() {
  DATA.meta = await (await fetch('data/meta.json')).json();
  DATA.brent = await (await fetch('data/brent.json')).json();
  for (const n of ['world', 'region', 'strait']) {
    const buf = new Uint16Array(await (await fetch(`data/${n}.f16`)).arrayBuffer());
    const f = new Float32Array(buf.length / 2); for (let i = 0; i < f.length; i++) f[i] = h2f(buf[i * 2]);
    DATA[n] = { raw: buf, f, ...DATA.meta[n] };
  }
}
function sampleOne(d, lon, lat) {
  const u = (lon - d.lon0) / (d.lon1 - d.lon0) * (d.w - 1), v = (d.lat1 - lat) / (d.lat1 - d.lat0) * (d.h - 1);
  if (u < 0 || v < 0 || u > d.w - 1 || v > d.h - 1) return null;
  const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, i1 = Math.min(i + 1, d.w - 1), j1 = Math.min(j + 1, d.h - 1);
  const a = d.f[j * d.w + i], b = d.f[j * d.w + i1], c = d.f[j1 * d.w + i], e = d.f[j1 * d.w + i1];
  return lerp(lerp(a, b, fu), lerp(c, e, fu), fv);
}
function heightAt(lon, lat) {
  let h = sampleOne(DATA.strait, lon, lat); if (h !== null) return h;
  h = sampleOne(DATA.region, lon, lat); if (h !== null) return h;
  lon = ((lon + 180) % 360 + 360) % 360 - 180; h = sampleOne(DATA.world, lon, lat); return h === null ? 0 : h;
}

// ---------------------------------------------------------------- GL terrain
let gl, prog, U = {}, gridBuf, idxBuf, nIdx;
const VS = `#version 300 es
precision highp float;
in vec2 aG;
uniform vec2 uCenter; uniform float uSpan; uniform mat4 uVP; uniform float uExag; uniform float uLod;
uniform sampler2D tW, tR, tS;
out vec2 vLL; out vec3 vP;
const float KX=${KX.toFixed(6)}, LON0=${LON0.toFixed(3)}, LAT0=${LAT0.toFixed(3)};
float boxw(vec2 ll, vec4 b, float m){ float d=min(min(ll.x-b.x,b.y-ll.x),min(ll.y-b.z,b.w-ll.y)); return smoothstep(0.,m,d); }
float hgt(vec2 ll, float lod){
  float hw = textureLod(tW, vec2((ll.x+180.)/360., (80.-ll.y)/160.), lod).r;
  float hr = textureLod(tR, vec2((ll.x-40.)/32., (34.-ll.y)/22.), max(lod-3.,0.)).r;
  float hs = textureLod(tS, vec2((ll.x-55.4)/2.2, (27.5-ll.y)/2.), max(lod-6.,0.)).r;
  float h = mix(hw, hr, boxw(ll, vec4(40.,72.,12.,34.), 1.2));
  return mix(h, hs, boxw(ll, vec4(55.4,57.6,25.5,27.5), .18));
}
void main(){
  vec2 X = uCenter + aG*uSpan;
  vec2 ll = vec2(X.x/KX+LON0, X.y+LAT0);
  float h = hgt(ll, uLod+1.5);
  float z = max(h,0.)*smoothstep(0.,260.,h)/111320.*uExag;
  vLL = ll; vP = vec3(X,z);
  gl_Position = uVP*vec4(X,z,1.);
}`;
const FS = `#version 300 es
precision highp float;
in vec2 vLL; in vec3 vP;
uniform sampler2D tW, tR, tS;
uniform vec3 uCam; uniform float uCoastA; uniform float uD, uIsoL, uReveal, uRevW, uTerrain, uMono, uFog0, uFog1, uGrat, uGratA, uExag, uDim, uSeaIso;
out vec4 o;
float boxw(vec2 ll, vec4 b, float m){ float d=min(min(ll.x-b.x,b.y-ll.x),min(ll.y-b.z,b.w-ll.y)); return smoothstep(0.,m,d); }
vec2 hgt2(vec2 ll){
  vec2 hw = texture(tW, vec2((ll.x+180.)/360., (80.-ll.y)/160.)).rg;
  vec2 hr = texture(tR, vec2((ll.x-40.)/32., (34.-ll.y)/22.)).rg;
  vec2 hs = texture(tS, vec2((ll.x-55.4)/2.2, (27.5-ll.y)/2.)).rg;
  vec2 h = mix(hw, hr, boxw(ll, vec4(40.,72.,12.,34.), 1.2));
  return mix(h, hs, boxw(ll, vec4(55.4,57.6,25.5,27.5), .18));
}
float hgt(vec2 ll){ return hgt2(ll).x; }
float iso(float f, float wpx){ float w=fwidth(f); float d=abs(fract(f+.5)-.5)/max(w,1e-6); return (1.-smoothstep(wpx*.5, wpx*.5+1., d))*smoothstep(.55,.18,w); }
void main(){
  vec2 ll = vLL;
  vec2 H2 = hgt2(ll); float h = H2.x; float hc = H2.y;
  float fw = max(length(fwidth(ll)), 1e-5);
  float e = max(fw*1.5, 0.0012);
  float hx = hgt(ll+vec2(e,0.)), hy = hgt(ll+vec2(0.,e));
  float sc = 1./(111320.*e)*max(uExag,2.)*0.6;
  vec3 n = normalize(vec3(-(hx-h)*sc, -(hy-h)*sc, 1.));
  float shade = clamp(dot(n, normalize(vec3(-.55,.6,.58))), 0., 1.);
  // land / sea
  float hw = fwidth(hc);
  float land = smoothstep(-.6,.6, hc/max(hw,1e-3));
  vec3 cream = vec3(.929,.902,.827);
  vec3 seaDeep = vec3(.012,.047,.040), seaSh = vec3(.030,.110,.098);
  float depth = max(-h,0.);
  vec3 sea = mix(seaSh, seaDeep, smoothstep(10.,1800.,depth));
  vec3 landLo = vec3(.022,.058,.047), landHi = vec3(.075,.150,.122);
  vec3 lc = mix(landLo, landHi*.85, smoothstep(.15,.95,shade)) + vec3(.02,.03,.025)*smoothstep(0.,3000.,h);
  vec3 col = mix(sea, lc, land);
  // land isolines (octave LOD)
  float L = log2(uIsoL); float I0 = exp2(floor(L)); float tf = fract(L);
  float l1 = iso(h/I0, .9), l2 = iso(h/(2.*I0), 1.0);
  float li = max(l2, l1*(1.-tf)) * land * smoothstep(I0*.5, I0*1.5, h);
  col = mix(col, cream, li*(.07+.17*smoothstep(0.,2500.,h))*(1.-.35*uMono));
  // bathymetry: log-spaced isobaths
  float fb = log2(max(depth,1.)/5.)*uSeaIso;
  float lb = iso(fb, .8)*(1.-land)*smoothstep(14.,30.,depth);
  col = mix(col, vec3(.16,.47,.42), lb*.34*(1.-.5*uMono));
  // coastline
  float cd = abs(hc)/max(hw,1e-3);
  float coast = 1.-smoothstep(.35,1.25,cd);
  col = mix(col, cream, coast*uCoastA);
  // graticule
  vec2 g = ll/uGrat; vec2 gw = fwidth(g); vec2 gd = abs(fract(g+.5)-.5)/max(gw,vec2(1e-6));
  float gr = max(1.-smoothstep(.3,1.2,gd.x), 1.-smoothstep(.3,1.2,gd.y));
  col = mix(col, cream, gr*uGratA);
  // mono / restraint
  float lum = dot(col, vec3(.3,.55,.15));
  col = mix(col, vec3(lum)*vec3(.93,1.0,.97), uMono*.62);
  col *= uDim;
  // fog / haze
  float cdist = length(vP-uCam)/uD;
  float fog = smoothstep(uFog0, uFog1, cdist);
  vec3 haze = mix(vec3(.018,.058,.050), vec3(.012,.035,.03), uMono);
  col = mix(col, haze, fog);
  // reveal mask around the strait
  col = mix(vec3(.012,.047,.040), col, smoothstep(80.,76.5,abs(ll.y)));
  float r = length(vP.xy - vec2(0.04,-0.02));
  float m = 1.-smoothstep(uReveal-uRevW, uReveal, r);
  col = mix(vec3(.012,.047,.040), col, m*uTerrain);
  o = vec4(col,1.);
}`;
function mkShader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
function mkTex(d, unit, repeat) {
  const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, d.w, d.h, 0, gl.RG, gl.HALF_FLOAT, d.raw);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function initGL() {
  const cv = document.getElementById('gl');
  gl = cv.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
  gl.getExtension('EXT_color_buffer_float'); gl.getExtension('OES_texture_float_linear');
  prog = gl.createProgram();
  gl.attachShader(prog, mkShader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, mkShader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  for (const n of ['uCenter', 'uSpan', 'uVP', 'uExag', 'uLod', 'tW', 'tR', 'tS', 'uCam', 'uD', 'uIsoL', 'uReveal', 'uRevW', 'uTerrain', 'uMono', 'uFog0', 'uFog1', 'uGrat', 'uGratA', 'uDim', 'uSeaIso', 'uCoastA']) U[n] = gl.getUniformLocation(prog, n);
  mkTex(DATA.world, 0, true); mkTex(DATA.region, 1); mkTex(DATA.strait, 2);
  gl.uniform1i(U.tW, 0); gl.uniform1i(U.tR, 1); gl.uniform1i(U.tS, 2);
  const N = 820, v = new Float32Array((N + 1) * (N + 1) * 2); let k = 0;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { v[k++] = i / N * 2 - 1; v[k++] = j / N * 2 - 1; }
  const idx = new Uint32Array(N * N * 6); k = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.set([a, b, c, b, d, c], k); k += 6; }
  nIdx = idx.length;
  gridBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
  idxBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aG'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.DEPTH_TEST);
}

// ---------------------------------------------------------------- camera
const CAM = [ // t, lon, lat, viewH(deg), pitch, yaw, ease
  [0.0, 56.50, 26.62, 0.95, 0, -30],
  [4.0, 56.48, 26.60, 1.12, 0, -27, 'lin'],
  [6.6, 56.30, 26.10, 4.0, 24, -14, 'in2'],
  [10.0, 56.10, 24.40, 14.0, 50, -1, 'out3'],
  [16.8, 56.70, 24.00, 12.6, 52, 6, 'io2'],
  [19.3, 56.45, 26.05, 5.0, 44, 2, 'in3'],
  [20.3, 56.45, 26.05, 5.0, 44, 2, 'hold'],
  [24.2, 54.60, 25.70, 8.4, 40, -3, 'io'],
  [26.0, 54.90, 25.80, 9.4, 36, -2, 'lin'],
  [31.2, 56.40, 24.0, 118, 0, 0, 'io'],
  [37.0, 56.40, 24.0, 108, 0, 0, 'out3'],
];
function camAt(t) {
  let i = 1; while (i < CAM.length - 1 && t > CAM[i][0]) i++;
  const a = CAM[i - 1], b = CAM[i];
  let u = clamp((t - a[0]) / (b[0] - a[0]));
  u = E[b[6] || 'io'](u);
  const lon = lerp(a[1], b[1], u), lat = lerp(a[2], b[2], u);
  const vh = Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), u));
  return { lon, lat, vh, pitch: lerp(a[4], b[4], u), yaw: lerp(a[5], b[5], u) };
}
const FOV = 30 * Math.PI / 180;
let VP, camPos, camD, camInfo;
function setupCamera(t) {
  const c = camAt(t); camInfo = c;
  const T = [...toW(c.lon, c.lat), 0];
  const D = c.vh / 2 / Math.tan(FOV / 2);
  const p = c.pitch * Math.PI / 180, y = c.yaw * Math.PI / 180;
  const rot = v => [v[0] * Math.cos(y) - v[1] * Math.sin(y), v[0] * Math.sin(y) + v[1] * Math.cos(y), v[2]];
  const f = rot([0, Math.sin(p), -Math.cos(p)]), u = rot([0, Math.cos(p), Math.sin(p)]);
  const e = [T[0] - f[0] * D, T[1] - f[1] * D, T[2] - f[2] * D];
  const P = M4.persp(FOV, W / H, D * 0.05, D * 30);
  VP = M4.mul(P, M4.look(e, T, u)); camPos = e; camD = D;
  return { T, D, c };
}
function proj(x, y, z = 0) {
  const m = VP; const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (cw <= 1e-6) return null;
  return [(cx / cw * .5 + .5) * W, (1 - (cy / cw * .5 + .5)) * H, cw];
}
const projLL = (lon, lat, z = 0) => { const [x, y] = toW(lon, lat); return proj(x, y, z); };
// pixels per world unit at a point (for sizing)
function ppu(x, y, z = 0) { const a = proj(x, y, z), b = proj(x + 0.01, y, z), c = proj(x, y + 0.01, z); if (!a || !b || !c) return 0; return Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(c[0] - a[0], c[1] - a[1])) / 0.01; }

// ---------------------------------------------------------------- routes & ships
function catmull(pts, step) {
  const P = [pts[0], ...pts, pts[pts.length - 1]], out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
class Path {
  constructor(llpts, step = 0.01) {
    const w = llpts.map(p => toW(p[0], p[1]));
    this.p = catmull(w, step); this.s = [0];
    for (let i = 1; i < this.p.length; i++) this.s.push(this.s[i - 1] + Math.hypot(this.p[i][0] - this.p[i - 1][0], this.p[i][1] - this.p[i - 1][1]));
    this.L = this.s[this.s.length - 1];
  }
  at(s) { // returns [x,y,tx,ty]
    s = clamp(s, 0, this.L); let lo = 0, hi = this.s.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.s[m] <= s) lo = m; else hi = m; }
    const u = (s - this.s[lo]) / Math.max(this.s[hi] - this.s[lo], 1e-9), a = this.p[lo], b = this.p[hi];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), dx / l, dy / l];
  }
}
const TSS = [[55.30, 26.30], [55.85, 26.42], [56.15, 26.56], [56.42, 26.645], [56.63, 26.585], [56.79, 26.38], [56.93, 26.10], [57.06, 25.80], [57.26, 25.45]];
const OMAN = [[57.26, 25.45], [57.85, 24.95], [58.65, 24.35], [59.45, 23.45], [60.45, 22.65]];
const TRUNK = [[49.55, 28.85], [50.85, 27.60], [52.15, 26.95], [53.45, 26.40], [54.55, 26.20], [55.30, 26.30]];
const ORIG = { // weights ~ IEA 2025 export volumes (mb/d) by exporter
  basra: { w: 3.6, pts: [[48.85, 29.62], [49.25, 29.20]], join: 0 },
  kuwait: { w: 2.4, pts: [[48.30, 29.02], [48.95, 28.85]], join: 0 },
  kharg: { w: 2.4, pts: [[50.22, 29.22], [50.45, 28.55]], join: 1 },
  tanura: { w: 6.2, pts: [[50.30, 26.78], [50.95, 27.12], [51.8, 27.02]], join: 2 },
  laffan: { w: 1.4, pts: [[51.70, 25.98], [52.50, 26.35]], join: 3 },
  ruwais: { w: 2.2, pts: [[52.75, 24.35], [53.05, 25.00], [53.95, 25.85]], join: 4 },
  jebel: { w: 1.0, pts: [[55.00, 25.12], [54.95, 25.70]], join: 5 },
};
const DEST = { // share of flows (IEA: ~80% of Hormuz oil to Asia)
  asia: { w: .52, pts: [[62.8, 21.9], [66.5, 20.6], [71.0, 18.6], [76.0, 15.5]] },
  india: { w: .24, pts: [[63.5, 23.1], [66.8, 23.0], [69.3, 22.55]] },
  red: { w: .14, pts: [[60.1, 20.8], [58.2, 17.9], [54.5, 14.8], [50.0, 12.95], [46.0, 12.35], [43.4, 12.7]] },
  south: { w: .10, pts: [[61.2, 19.5], [62.3, 14.5], [63.0, 9.0]] },
};
let ROUTES = [], SHIPS = [], LANE_OUT, LANE_IN, TSS_PATH;
function buildRoutes() {
  seed = 7;
  TSS_PATH = new Path(TSS, 0.004);
  for (const [on, o] of Object.entries(ORIG)) for (const [dn, d] of Object.entries(DEST)) {
    const pts = [...o.pts, ...TRUNK.slice(o.join), ...TSS.slice(1), ...OMAN.slice(1), ...d.pts];
    const path = new Path(pts, 0.02);
    ROUTES.push({ path, w: o.w * d.w, on, dn });
  }
  const total = ROUTES.reduce((a, r) => a + r.w, 0), NSHIP = 560;
  for (const r of ROUTES) {
    const n = Math.max(1, Math.round(r.w / total * NSHIP));
    for (let i = 0; i < n; i++) {
      const inbound = rnd() < 0.34; // ballast tankers returning into the Gulf
      SHIPS.push({ r, ph: rnd(), v: lerp(.85, 1.15, rnd()), jit: rnd() * 2 - 1, inbound, sz: lerp(.7, 1.2, rnd()), id: SHIPS.length });
    }
  }
}
// cumulative flow-time with acceleration & stop
const T_ACC = 16.8, T_STOP = 19.3;
function speedAt(t) { if (t < T_ACC) return 1; if (t < T_STOP) return 1 + 2.6 * E.in2(inv(T_ACC, T_STOP, t)); return 0; }
const TAU = []; (function () { let s = 0; for (let f = 0; f <= DUR * FPS + 2; f++) { TAU.push(s); s += speedAt(f / FPS) / FPS; } })();
const tauAt = t => { const f = t * FPS, i = Math.floor(f); return lerp(TAU[i] || 0, TAU[i + 1] || TAU[i] || 0, f - i); };
const SPEED = 0.62; // world units / flow-second
function shipPos(sh, tau, back = 0) {
  const P = sh.r.path, L = P.L;
  const cyc = L / SPEED * sh.v; // seconds to traverse
  let u = ((sh.ph + tau / cyc) % 1 + 1) % 1;
  let s = u * L - back; if (sh.inbound) s = L - s;
  const [x, y, tx, ty] = P.at(s);
  // lateral: right-hand traffic lanes inside the TSS, fanning out in open water
  const d = Math.hypot(x - 0.1, y - 0.0);
  const tssW = 1 - ss(0.35, 1.6, d);
  const dir = sh.inbound ? -1 : 1;
  const nx = ty * dir, ny = -tx * dir; // right normal of travel direction
  const off = 0.0333 * tssW + sh.jit * 0.2 * (1 - tssW) * ss(0.2, 2.5, d);
  const fade = ss(0, .05, u) * (1 - ss(.93, 1, u));
  return [x + nx * off, y + ny * off, tx * dir, ty * dir, fade, u];
}

// ---------------------------------------------------------------- 2D helpers
let out, octx, ov, ctx, gw, gctx, grainC = [];
function cvs(w = W, h = H) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function font(size, w = 400, fam = 'Inter Tight', style = 'normal') { return `${style} ${w} ${size}px "${fam}"`; }
function text(c, s, x, y, o = {}) {
  c.save(); c.font = o.font || font(16); c.fillStyle = o.color || `rgba(${C.cream},${o.a ?? 1})`;
  c.textAlign = o.align || 'left'; c.textBaseline = o.base || 'alphabetic'; c.letterSpacing = (o.ls || 0) + 'px';
  if (o.a !== undefined && !o.color) c.globalAlpha = 1; c.fillText(s, x, y); c.restore();
}
function measure(c, s, f, ls = 0) { c.save(); c.font = f; c.letterSpacing = ls + 'px'; const w = c.measureText(s).width; c.restore(); return w; }
function line(c, pts, col, lw = 1) { if (pts.length < 2) return; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.strokeStyle = col; c.lineWidth = lw; c.stroke(); }
// masked reveal of text line (wipe up)
function revealText(c, s, x, y, p, o) {
  const f = o.font; const size = parseFloat(f.match(/(\d+(\.\d+)?)px/)[1]);
  c.save(); const w = measure(c, s, f, o.ls || 0) + 20;
  const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  c.beginPath(); c.rect(x0 - 10, y - size * 1.05, w + 20, size * 1.35); c.clip();
  const e = E.out5(clamp(p)); text(c, s, x, y + (1 - e) * size * 1.1, o); c.restore();
}

// ---------------------------------------------------------------- scene state helpers
const STR = toW(56.43, 26.66); // strait focal point (world)
const GAUGE = [[56.358, 26.823], [56.510, 26.506]]; // Larak Is. <-> Great Quoin Is. (≈38 km measured; IEA: 39 km)
const disrupt = t => t >= T_STOP ? 1 : 0;
function colFlow(t, a = 1) { return disrupt(t) ? `rgba(${C.grey},${a * .8})` : `rgba(${C.lime},${a})`; }

// ---------------------------------------------------------------- grid (1,600 vessels)
const GRID = { cols: 80, rows: 20, dz: 0.072 };
let WALL_PATH;
function gridSlot(i) { // column-major stacks along the approach lane
  const c = Math.floor(i / GRID.rows), r = i % GRID.rows;
  const [x, y] = WALL_PATH.at(WALL_PATH.L * c / (GRID.cols - 1));
  return [x, y, 0.015 + r * GRID.dz];
}

// ---------------------------------------------------------------- brent chart layout
const CH = { x0: 250, x1: 1670, yb: 820, k: 4.4, p0: 55 };
let chartPts = [], chartLen = [];
function buildChart() {
  const d0 = Date.parse('2026-01-01'), d1 = Date.parse('2026-09-30');
  chartPts = DATA.brent.map(([d, v]) => [lerp(CH.x0, CH.x1, (Date.parse(d) - d0) / (d1 - d0)), CH.yb - (v - CH.p0) * CH.k, v, d]);
  chartLen = [0]; for (let i = 1; i < chartPts.length; i++) chartLen.push(chartLen[i - 1] + Math.hypot(chartPts[i][0] - chartPts[i - 1][0], chartPts[i][1] - chartPts[i - 1][1]));
}
function chartAt(u) { // u 0..1 along arc length
  const L = chartLen[chartLen.length - 1] * clamp(u); let i = 1; while (i < chartLen.length - 1 && chartLen[i] < L) i++;
  const a = chartPts[i - 1], b = chartPts[i], f = (L - chartLen[i - 1]) / Math.max(chartLen[i] - chartLen[i - 1], 1e-6);
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
}

// ---------------------------------------------------------------- geodesic
const R_E = 6371;
function dest(lon, lat, brg, km) {
  const d = km / R_E, p1 = lat * Math.PI / 180, l1 = lon * Math.PI / 180, b = brg * Math.PI / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  let dl = Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  dl = ((dl + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return [lon + dl * 180 / Math.PI, p2 * 180 / Math.PI];
}
function hav(lon1, lat1, lon2, lat2) { const r = Math.PI / 180, a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2; return 2 * R_E * Math.asin(Math.sqrt(a)); }
const HZ = [56.43, 26.6];
const CITIES = [
  ['MUMBAI', 72.88, 19.08], ['SINGAPORE', 103.82, 1.35], ['SHANGHAI', 121.47, 31.23], ['TOKYO', 139.69, 35.69],
  ['ROTTERDAM', 4.48, 51.92], ['CAPE TOWN', 18.42, -33.92], ['SEOUL', 126.98, 37.57],
].map(([n, lon, lat]) => ({ n, lon, lat, km: hav(HZ[0], HZ[1], lon, lat) }));

// ================================================================= RENDER
function renderGL(t) {
  const { T, D, c } = setupCamera(t);
  gl.viewport(0, 0, W, H);
  gl.clearColor(.012, .047, .04, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const span = c.vh * (1.25 + 5.0 * Math.sin(c.pitch * Math.PI / 180) ** 1.5);
  gl.uniform2f(U.uCenter, T[0], T[1] + span * 0.55 * Math.sin(c.pitch * Math.PI / 180) * Math.cos(c.yaw * Math.PI / 180));
  gl.uniform1f(U.uSpan, span);
  gl.uniformMatrix4fv(U.uVP, false, VP);
  const exag = key(t, [[0, 3], [4, 3], [10, 48, 'io'], [17, 48], [24.2, 34], [30.5, 0]]);
  gl.uniform1f(U.uExag, exag);
  gl.uniform1f(U.uLod, Math.max(0, Math.log2(span * 2 / 820 / (360 / 4096))));
  gl.uniform3f(U.uCam, ...camPos); gl.uniform1f(U.uD, D);
  gl.uniform1f(U.uIsoL, 22 * Math.pow(c.vh / 0.4, 0.84));
  gl.uniform1f(U.uSeaIso, key(t, [[0, 2], [8, 2], [12, 1.5], [28, 1], [31, .7]]));
  const rev = key(t, [[2.2, 0.0], [4.2, 0.55, 'out3'], [8.2, 30, 'in2'], [26.6, 30], [29.6, 110, 'io'], [31.6, 400, 'in2']]);
  gl.uniform1f(U.uReveal, rev); gl.uniform1f(U.uRevW, Math.max(0.12, rev * 0.45));
  gl.uniform1f(U.uTerrain, key(t, [[2.2, 0], [3.8, 1, 'io']]));
  gl.uniform1f(U.uMono, t >= T_STOP ? key(t, [[T_STOP, 1], [26, .85], [31, .7]]) : 0);
  gl.uniform1f(U.uDim, t >= T_STOP ? key(t, [[T_STOP, .7], [21, .86], [24.0, .86], [24.6, .42], [26.0, .42], [27.0, .92], [31, .95]]) : 1);
  const fog = key(t, [[0, 9], [4, 9], [10, 1.25], [24, 1.25], [30, 3]]);
  gl.uniform1f(U.uFog0, fog * .8); gl.uniform1f(U.uFog1, fog * 1.9);
  const g = c.vh < 2 ? 0.25 : c.vh < 20 ? 2 : 15;
  gl.uniform1f(U.uGrat, g); gl.uniform1f(U.uGratA, 0.05 * key(t, [[3, 0], [6, 1]]));
  gl.uniform1f(U.uCoastA, key(t, [[0, .62], [29, .62], [32, .42]]));
  gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_INT, 0);
}


// ================================================================= OVERLAY LAYERS
function lanePt(s, off) { const [x, y, tx, ty] = TSS_PATH.at(s); return [x + ty * off, y - tx * off]; }
function nearestS(path, x, y) { let b = 0, bd = 1e9; for (let i = 0; i < path.p.length; i++) { const d = Math.hypot(path.p[i][0] - x, path.p[i][1] - y); if (d < bd) { bd = d; b = path.s[i]; } } return b; }
let S_C;
function drawOpening(t) {
  if (t > 9.5) return;
  const fadeAll = 1 - inv(6.5, 9.0, t);
  // TSS lane hairlines (lane edges + separation zone)
  const dl = E.io(inv(1.9, 3.7, t));
  if (dl > 0) {
    const s0 = S_C - 2.2, s1 = S_C + 2.2;
    for (const [off, a, dash] of [[0.0167, .30, 0], [-0.0167, .30, 0], [0.05, .16, 0], [-0.05, .16, 0], [0, .22, 1]]) {
      const pts = []; const n = 160;
      for (let i = 0; i <= n * dl; i++) { const p = lanePt(lerp(s0, s1, i / n), off); const q = proj(p[0], p[1]); if (q) pts.push(q); }
      ctx.save(); if (dash) ctx.setLineDash([2, 6]);
      line(ctx, pts, `rgba(${C.cream},${a * fadeAll})`, 1); ctx.restore();
    }
  }
  // hero vessels: the first thin line
  const heroes = [
    { t0: 0.2, s0: S_C - 0.95, v: 0.30, off: 0.0333, col: C.lime, a: 1, w: 1.6 },
    { t0: 1.3, s0: S_C + 1.05, v: -0.26, off: -0.0333, col: C.cream, a: .7, w: 1.1 },
  ];
  for (const h of heroes) {
    if (t < h.t0) continue;
    const sHead = h.s0 + h.v * (t - h.t0);
    const pts = []; const n = 140;
    const sTail = h.s0 - Math.sign(h.v) * 0.6;
    for (let i = 0; i <= n; i++) { const s = lerp(sTail, sHead, i / n); const p = lanePt(s, h.off); const q = proj(p[0], p[1]); if (q) pts.push([...q, i / n]); }
    for (let i = 1; i < pts.length; i++) {
      const al = h.a * Math.pow(pts[i][3], 1.6) * fadeAll;
      line(ctx, [pts[i - 1], pts[i]], `rgba(${h.col},${al})`, h.w);
      if (h.col === C.lime) line(gctx, [pts[i - 1], pts[i]], `rgba(${h.col},${al * .8})`, 3);
    }
    const hp = pts[pts.length - 1];
    if (hp) {
      ctx.fillStyle = `rgba(${h.col},${h.a * fadeAll})`; ctx.beginPath(); ctx.arc(hp[0], hp[1], 2.6, 0, 7); ctx.fill();
      gctx.fillStyle = `rgba(${h.col},${.9 * fadeAll})`; gctx.beginPath(); gctx.arc(hp[0], hp[1], 7, 0, 7); gctx.fill();
    }
  }
  // gauge: narrowest point
  const gp = E.out3(inv(2.7, 3.5, t)), ga = 1 - inv(4.6, 5.3, t);
  if (gp > 0 && ga > 0) {
    const a = projLL(...GAUGE[0]), b = projLL(...GAUGE[1]);
    const mx = lerp(a[0], b[0], .5), my = lerp(a[1], b[1], .5);
    const ax = lerp(mx, a[0], gp), ay = lerp(my, a[1], gp), bx = lerp(mx, b[0], gp), by = lerp(my, b[1], gp);
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l * 7, ny = dx / l * 7;
    ctx.save(); ctx.globalAlpha = ga;
    line(ctx, [[ax, ay], [bx, by]], `rgba(${C.cream},.9)`, 1);
    line(ctx, [[ax - nx, ay - ny], [ax + nx, ay + ny]], `rgba(${C.cream},.9)`, 1);
    line(ctx, [[bx - nx, by - ny], [bx + nx, by + ny]], `rgba(${C.cream},.9)`, 1);
    const la = inv(3.2, 3.7, t);
    text(ctx, '39 KM', mx + 18, my - 4, { font: font(15, 500, 'Geist Mono'), ls: 2, a: la });
    text(ctx, 'NARROWEST POINT', mx + 18, my + 16, { font: font(11, 400, 'Geist Mono'), ls: 2, a: la * .55 });
    ctx.restore();
  }
  // question
  const qa = 1 - inv(4.0, 4.7, t);
  if (qa > 0) {
    ctx.save(); ctx.globalAlpha = qa;
    const f1 = font(50, 300);
    revealText(ctx, 'What happens when the world’s', 150, 205, inv(0.7, 1.5, t), { font: f1, ls: -0.5 });
    revealText(ctx, 'energy highway', 150, 267, inv(0.95, 1.75, t), { font: f1, ls: -0.5 });
    // "narrows" physically narrows
    const nw = E.io(inv(2.35, 3.55, t));
    const ls = lerp(18, -3.2, nw);
    const x2 = 150 + measure(ctx, 'energy highway ', f1, -0.5);
    revealText(ctx, 'narrows', x2, 267, inv(1.45, 2.2, t), { font: f1, ls });
    const x3 = x2 + measure(ctx, 'narrows', f1, ls) + 14;
    revealText(ctx, 'to this?', x3, 267, inv(2.9, 3.6, t), { font: font(56, 400, 'Instrument Serif', 'italic'), ls: 0 });
    ctx.restore();
    text(ctx, '26°34′N  56°15′E', 150, 960, { font: font(12, 400, 'Geist Mono'), ls: 3, a: .5 * win(t, 0.9, 4.6, .8, .6) });
  }
}

// giant HORMUZ that compresses into the strait label
function drawHormuz(t) {
  if (t < 6.1) return;
  const lblA = t < 19.3 ? 1 : 1 - inv(19.8, 20.6, t);
  const anchor = projLL(56.05, 27.55, 0);
  const word = 'HORMUZ';
  if (t < 9.1) {
    const appear = inv(6.1, 7.0, t);
    const cp = E.in3(inv(7.3, 8.25, t)); // compression
    const fly = E.io(inv(8.1, 9.1, t));
    const size = Math.exp(lerp(Math.log(260), Math.log(19), fly));
    const ls0 = lerp(62, -size * 0.2, cp);
    const ls = lerp(ls0, 7, fly);
    const sx = lerp(lerp(1, 0.5, cp), 1, fly);
    const cx = lerp(W / 2, anchor ? anchor[0] : W / 2, fly), cy = lerp(H * 0.56, anchor ? anchor[1] : H / 2, fly);
    const f = font(size, 200);
    ctx.save(); ctx.font = f; ctx.letterSpacing = ls + 'px'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(word).width - ls;
    ctx.translate(cx, cy); ctx.scale(sx, 1);
    let x = -tw / 2;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i]; const w = ctx.measureText(ch).width;
      const ai = E.out3(clamp(appear * 1.8 - i * 0.14));
      ctx.globalAlpha = ai * .95;
      ctx.fillStyle = `rgb(${C.cream})`; ctx.fillText(ch, x, (1 - ai) * 40);
      x += w;
    }
    ctx.restore();
  } else if (anchor && lblA > 0) {
    text(ctx, 'HORMUZ', anchor[0], anchor[1], { font: font(19, 200), ls: 7, align: 'center', base: 'middle', a: .95 * lblA * (t < T_STOP ? 1 : .8) });
  }
  if (anchor && t > 8.7 && lblA > 0) {
    const a = inv(8.7, 9.4, t) * lblA;
    const sp = projLL(56.42, 26.66, 0);
    if (sp) { const d = E.out3(inv(9.0, 9.7, t)); line(ctx, [[anchor[0], anchor[1] + 14], [lerp(anchor[0], sp[0], d), lerp(anchor[1] + 14, sp[1] - 4, d)]], `rgba(${C.cream},${.5 * a})`, 1); }
    text(ctx, 'STRAIT OF', anchor[0], anchor[1] - 22, { font: font(10, 400, 'Geist Mono'), ls: 3.5, align: 'center', base: 'middle', a: .6 * a });
  }
}

const LABELS = [
  ['IRAN', 54.6, 30.9, 'c', 7.0], ['OMAN', 56.9, 21.3, 'c', 7.3], ['U.A.E.', 54.2, 23.55, 'c', 7.5], ['SAUDI ARABIA', 47.8, 24.6, 'c', 7.6], ['QATAR', 51.2, 25.05, 'c', 7.8],
  ['Persian Gulf', 51.0, 27.9, 'w', 7.9], ['Gulf of Oman', 58.25, 24.05, 'w', 8.1], ['Arabian Sea', 62.2, 16.8, 'w', 8.3],
];
function drawLabels(t) {
  if (t < 6.8 || t > 25) return;
  const out = 1 - inv(23.4, 24.4, t);
  for (const [n, lon, lat, k, t0] of LABELS) {
    let a = inv(t0, t0 + 0.9, t) * out * (t > T_STOP ? .55 : 1);
    if (n === 'Persian Gulf') a *= 1 - inv(20.2, 20.8, t);
    if (a <= 0) continue;
    const z = k === 'c' ? Math.max(heightAt(lon, lat), 0) / 111320 * key(t, [[0, 3], [4, 3], [10, 48, 'io'], [17, 48], [24.2, 34], [30.5, 0]]) : 0;
    const p = projLL(lon, lat, z); if (!p) continue;
    if (k === 'c') text(ctx, n, p[0], p[1], { font: font(14, 500), ls: 6, align: 'center', a: .78 * a });
    else text(ctx, n, p[0], p[1], { font: font(25, 400, 'Instrument Serif', 'italic'), ls: .3, align: 'center', color: t > T_STOP ? `rgba(160,170,165,${.8 * a})` : `rgba(120,190,176,${.9 * a})` });
  }
}

// ----- the 20 / 20% data object, filled with moving oil
let numC, numX, maskC;
function drawNumber(t) {
  if (t < 10.4 || t > 20.6) return;
  const tau = tauAt(t);
  const D = disrupt(t);
  const appear = E.out5(inv(10.5, 11.5, t));
  const pct = E.io(inv(13.5, 14.3, t));
  const leave = inv(19.9, 20.6, t);
  const x0 = 140, yb = 905, size = 330;
  const f = font(size, 250);
  const w20 = measure(ctx, '20', f, -12);
  const wP = measure(ctx, '%', font(size, 200), -6);
  numX = numC.getContext('2d');
  const n = numX; n.clearRect(0, 0, W, H);
  n.save();
  // base tint
  n.font = f; n.letterSpacing = '-12px'; n.fillStyle = D ? `rgba(${C.grey},.14)` : `rgba(${C.lime},.16)`;
  const lift = (1 - appear) * 60;
  n.fillText('20', x0, yb + lift);
  if (pct > 0) { n.font = font(size, 200); n.letterSpacing = '-6px'; n.globalAlpha = pct; n.fillText('%', x0 + w20 - 4 + (1 - pct) * 60, yb); n.globalAlpha = 1; }
  // streaks
  seed = 99;
  const top = yb - size * 0.78, hgt = size * 0.8;
  for (let i = 0; i < 230; i++) {
    const y = top + rnd() * hgt, len = 40 + rnd() * 260, sp = 140 + rnd() * 160, ph = rnd() * 3000;
    const span = w20 + wP + 200;
    const x = x0 - 100 + ((ph + tau * sp) % span);
    const g = n.createLinearGradient(x - len, 0, x, 0);
    const c = D ? C.grey : C.lime;
    g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(1, `rgba(${c},${D ? .55 : .95})`);
    n.fillStyle = g; n.fillRect(x - len, y, len, 1.6 + rnd() * 2.2);
  }
  const mk = maskC.getContext('2d'); mk.clearRect(0, 0, W, H); mk.save();
  mk.font = f; mk.letterSpacing = '-12px'; mk.fillStyle = '#fff'; mk.fillText('20', x0, yb + lift);
  if (pct > 0) { mk.font = font(size, 200); mk.letterSpacing = '-6px'; mk.globalAlpha = pct; mk.fillText('%', x0 + w20 - 4 + (1 - pct) * 60, yb); }
  mk.restore();
  n.globalCompositeOperation = 'destination-in'; n.drawImage(maskC, 0, 0);
  n.restore();
  const A = appear * (1 - leave);
  ctx.save(); ctx.globalAlpha = A;
  if (leave > 0) { ctx.translate(x0, yb); ctx.scale(1 - leave * 0.25, 1 - leave * .9); ctx.translate(-x0, -yb); }
  ctx.drawImage(numC, 0, 0); ctx.restore();
  if (!D) { gctx.save(); gctx.globalAlpha = A * .55; gctx.drawImage(numC, 0, 0); gctx.restore(); }
  // captions
  const cx = x0 + w20 + (wP + 30) * pct + 26;
  const capA = A * (1 - inv(19.3, 19.8, t) * .5);
  const m1 = win(t, 11.2, 13.55, .5, .35), m2 = inv(14.1, 14.7, t);
  const mf = font(15, 500, 'Geist Mono');
  revealText(ctx, 'MILLION BARRELS', cx, yb - 150, inv(11.2, 11.8, t), { font: mf, ls: 3, a: capA * m1 });
  revealText(ctx, 'OF OIL, EVERY DAY', cx, yb - 126, inv(11.35, 11.95, t), { font: mf, ls: 3, a: capA * m1 });
  text(ctx, 'IEA · 2025 AVERAGE', cx, yb - 92, { font: font(11, 400, 'Geist Mono'), ls: 2.5, a: capA * m1 * .5 });
  revealText(ctx, 'OF GLOBAL OIL', cx, yb - 150, m2, { font: mf, ls: 3, a: capA });
  revealText(ctx, 'CONSUMPTION', cx, yb - 126, inv(14.2, 14.8, t), { font: mf, ls: 3, a: capA });
  text(ctx, 'EIA · 2024', cx, yb - 92, { font: font(11, 400, 'Geist Mono'), ls: 2.5, a: capA * inv(14.5, 15.0, t) * .5 });
  const l3 = inv(15.1, 15.7, t);
  line(ctx, [[cx, yb - 66], [cx + 250 * E.out3(l3), yb - 66]], `rgba(${C.cream},${.25 * capA})`, 1);
  revealText(ctx, '+ ≈20% OF GLOBAL LNG TRADE', cx, yb - 38, inv(15.3, 15.9, t), { font: font(13, 400, 'Geist Mono'), ls: 2.5, a: capA * .8 });
  text(ctx, 'IEA · 2025', cx, yb - 16, { font: font(11, 400, 'Geist Mono'), ls: 2.5, a: capA * inv(15.6, 16.1, t) * .5 });
  // editorial leader: strait -> number, with oil pulses travelling along it
  const sp = projLL(56.62, 26.35, 0);
  const la = win(t, 10.5, 20.1, .6, .5);
  if (sp && la > 0) {
    const d = E.io(inv(10.5, 11.3, t));
    const kx = x0 + w20 * 0.5, ky = yb - size * 0.86;
    const mid = [kx + (sp[1] - ky) * 0.0, sp[1] + (ky - sp[1]) * 0.0];
    const B = u => { const a = [sp[0], sp[1]], b = [sp[0] - 40, ky - 10], c = [kx + 220, ky - 60], e = [kx, ky + 10];
      return [0, 1].map(k => (1 - u) ** 3 * a[k] + 3 * (1 - u) ** 2 * u * b[k] + 3 * (1 - u) * u * u * c[k] + u ** 3 * e[k]); };
    const pts = []; for (let i = 0; i <= 60 * d; i++) pts.push(B(i / 60));
    line(ctx, pts, `rgba(${C.cream},${.3 * la})`, 1);
    ctx.fillStyle = `rgba(${C.cream},${.8 * la})`; ctx.beginPath(); ctx.arc(sp[0], sp[1], 2.5, 0, 7); ctx.fill();
    if (d >= 1) {
      ctx.save(); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.setLineDash([12, 40]); ctx.lineDashOffset = -tau * 140;
      ctx.strokeStyle = D ? `rgba(${C.grey},${.5 * la})` : `rgba(${C.lime},${.95 * la})`; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
    }
  }
}

// ----- ships (free flow) + frozen grid + chart morph
let FROZEN = null;
function freeze() {
  if (FROZEN) return FROZEN;
  const tau = tauAt(T_STOP + 0.01);
  const gulf = [], rest = [];
  for (const sh of SHIPS) {
    const [x, y, , , fade] = shipPos(sh, tau);
    const [lon, lat] = toLL(x, y);
    const g = lon < 56.55 && lat > 24.0 && lat < 30.5 && !(lon > 55.9 && lat < 26.2);
    (g ? gulf : rest).push({ sh, x, y, fade });
  }
  // each held ship stacks onto the nearest column of the wall
  const height = new Array(GRID.cols).fill(0);
  const colS = []; for (let c = 0; c < GRID.cols; c++) colS.push(WALL_PATH.at(WALL_PATH.L * c / (GRID.cols - 1)));
  gulf.sort((a, b) => a.x - b.x);
  for (const g of gulf) {
    let best = 0, bd = 1e9;
    for (let c = 0; c < GRID.cols; c++) { const d = Math.hypot(colS[c][0] - g.x, colS[c][1] - g.y) + height[c] * 0.02; if (d < bd && height[c] < GRID.rows) { bd = d; best = c; } }
    g.slot = best * GRID.rows + height[best]; height[best]++;
  }
  // remaining slots stack up row by row, columns in shuffled order
  seed = 5;
  const free = [];
  const h2 = height.slice();
  for (let r = 0; r < GRID.rows; r++) {
    const cols = []; for (let c = 0; c < GRID.cols; c++) if (h2[c] <= r) cols.push(c);
    cols.sort(() => rnd() - .5);
    for (const c of cols) { free.push(c * GRID.rows + h2[c]); h2[c]++; }
  }
  FROZEN = { gulf, rest, free, N: GRID.cols * GRID.rows };
  return FROZEN;
}
function chartAtX(fx) {
  const x = lerp(CH.x0, CH.x1, clamp(fx)); let i = 1; while (i < chartPts.length - 1 && chartPts[i][0] < x) i++;
  const a = chartPts[i - 1], b = chartPts[i], u = clamp((x - a[0]) / Math.max(b[0] - a[0], 1e-6));
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
}
let ROUTE_LINES = null;
function drawRouteLines(t) {
  const a0 = key(t, [[5.2, 0], [8.6, 1, 'io']]) * (1 - inv(22.0, 24.2, t));
  if (a0 <= 0) return;
  if (!ROUTE_LINES) {
    ROUTE_LINES = [];
    for (const r of ROUTES) for (const j of [-0.7, -0.15, 0.4, 0.95]) {
      const pts = [];
      for (let i = 0; i < r.path.p.length; i += 2) {
        const [x, y, tx, ty] = r.path.at(r.path.s[i]);
        const d = Math.hypot(x - 0.1, y); const tssW = 1 - ss(0.35, 1.6, d);
        const off = 0.0333 * tssW + j * 0.2 * (1 - tssW) * ss(0.2, 2.5, d);
        pts.push([x + ty * off, y - tx * off]);
      }
      ROUTE_LINES.push({ pts, w: r.w });
    }
  }
  const D = disrupt(t);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1; ctx.lineJoin = 'round';
  for (const rl of ROUTE_LINES) {
    const sp = rl.pts.map(p => proj(p[0], p[1], 0));
    const al = a0 * (0.022 + 0.028 * Math.min(rl.w / 1.2, 1));
    strokePts(ctx, sp, D ? `rgba(${C.grey},${al * .5})` : `rgba(${C.lime},${al})`, 1);
  }
  ctx.restore();
}
function drawFleet(t) {
  const fleetA = key(t, [[4.6, 0], [7.8, 1, 'io']]);
  if (fleetA <= 0 || t > 26.8) return;
  const tau = tauAt(t), D = disrupt(t);
  const trailK = speedAt(Math.min(t, T_STOP - 1e-3));
  if (!D) {
    for (const sh of SHIPS) {
      const [x, y, , , fade] = shipPos(sh, tau);
      const a = fade * fleetA; if (a < .01) continue;
      const p = proj(x, y, 0); if (!p || p[0] < -80 || p[0] > W + 80 || p[1] < -80 || p[1] > H + 80) continue;
      const back = (0.30 + 0.85 * (trailK - 1)) * (sh.inbound ? .6 : 1);
      const pts = [p];
      for (let s = 1; s <= 5; s++) { const q = shipPos(sh, tau - back * s / 5); const pp = proj(q[0], q[1], 0); if (pp) pts.push(pp); }
      for (let s = 1; s < pts.length; s++) {
        const al = a * (1 - s / 6) * (sh.inbound ? .22 : .5);
        if (Math.hypot(pts[s][0] - pts[s - 1][0], pts[s][1] - pts[s - 1][1]) > 200) break;
        line(ctx, [pts[s - 1], pts[s]], sh.inbound ? `rgba(${C.cream},${al})` : `rgba(${C.lime},${al})`, 1);
        if (!sh.inbound) line(gctx, [pts[s - 1], pts[s]], `rgba(${C.lime},${al * .9})`, 2.5);
      }
      const sz = sh.inbound ? 1.7 : 2.3;
      ctx.fillStyle = sh.inbound ? `rgba(${C.cream},${a * .65})` : `rgba(${C.lime},${a})`;
      ctx.fillRect(p[0] - sz / 2, p[1] - sz / 2, sz, sz);
    }
    return;
  }
  // ---- disrupted
  const F = freeze();
  const restA = key(t, [[T_STOP, 1], [21.5, .45], [24, .3], [24.8, 0]]);
  for (const r of F.rest) {
    const p = proj(r.x, r.y, 0); if (!p) continue;
    ctx.fillStyle = `rgba(${C.grey},${r.fade * restA * .8})`; ctx.fillRect(p[0] - 1, p[1] - 1, 2, 2);
  }
  const col2chart = t < 24.0 ? 0 : 1;
  const toRing = E.io(inv(25.9, 26.7, t));
  const marks = [];
  F.gulf.forEach((g, i) => {
    const st = 20.45 + (i % 29) / 29 * 0.7;
    const u = E.io(inv(st, st + 1.2, t));
    const [sx, sy, sz] = gridSlot(g.slot);
    marks.push({ x: lerp(g.x, sx, u), y: lerp(g.y, sy, u), z: sz * E.in2(u), a: g.fade + (1 - g.fade) * u, slot: g.slot });
  });
  const fillP = E.io2(inv(21.25, 23.45, t));
  const nF = fillP * F.free.length;
  for (let i = 0; i < F.free.length && i < nF; i++) {
    const [sx, sy, sz] = gridSlot(F.free[i]);
    const age = clamp((nF - i) / 60);
    marks.push({ x: sx, y: sy, z: sz + (1 - E.out3(age)) * 0.25, a: age, slot: F.free[i] });
  }
  const count = F.gulf.length * inv(20.45, 21.5, t) + Math.floor(nF);
  for (const m of marks) {
    const p = proj(m.x, m.y, m.z); if (!p) continue;
    let X = p[0], Y = p[1];
    const c = Math.floor(m.slot / GRID.rows), r = m.slot % GRID.rows;
    if (col2chart) {
      const st = 24.0 + (c / GRID.cols) * 0.35 + (GRID.rows - r) / GRID.rows * 0.25;
      const u = E.io(inv(st, st + 0.75, t));
      const q = chartAtX((c + r / GRID.rows) / GRID.cols);
      X = lerp(X, q[0], u); Y = lerp(Y, q[1], u);
    }
    if (toRing > 0) {
      const q = ringScreen(t, 400, m.slot / F.N);
      if (q) { X = lerp(X, q[0], toRing); Y = lerp(Y, q[1], toRing); }
    }
    const a = m.a * (1 - .5 * inv(25.0, 25.6, t)) * (1 - inv(26.5, 26.8, t));
    const k = ppu(m.x, m.y);
    const w = t > 24.4 ? 2 : clamp(k * 0.03, 2.2, 5), h = t > 24.4 ? 2 : 1.5;
    ctx.fillStyle = `rgba(${C.cream},${a * .9})`; ctx.fillRect(X - w / 2, Y - h / 2, w, h);
  }
  // shadow line of the wall on the water
  const wa = win(t, 20.6, 24.2, .6, .4);
  if (wa > 0) { const pts = []; for (let c = 0; c < GRID.cols; c++) pts.push(proj(...gridSlot(c * GRID.rows).slice(0, 2), 0)); strokePts(ctx, pts, `rgba(${C.cream},${.35 * wa})`, 1); }
  // count + attribution (anchored above the grid's top-left, clamped on screen)
  const ga = win(t, 22.3, 24.05, .45, .45);
  if (ga > 0) {
    const tl = proj(...gridSlot(GRID.rows - 1).slice(0, 2), gridSlot(GRID.rows - 1)[2] + 0.1);
    if (tl) {
      const lx = Math.max(150, tl[0]), ly = Math.max(330, tl[1]) - 34;
      text(ctx, fmt(Math.min(1600, count)), lx, ly - 58, { font: font(72, 250), ls: -1.5, a: ga });
      text(ctx, 'VESSELS HELD INSIDE THE GULF', lx + 4, ly - 30, { font: font(12, 500, 'Geist Mono'), ls: 2.5, a: ga * .85 });
      text(ctx, '≈1,600 VESSELS · ≈20,000 SEAFARERS — IMO, 24 APR 2026', lx + 4, ly - 10, { font: font(10.5, 400, 'Geist Mono'), ls: 2, a: ga * .5 * inv(22.2, 22.8, t) });
    }
  }
}

// ----- chart
function drawChart(t) {
  if (t < 24.2 || t > 26.9) return;
  const a = win(t, 24.35, 26.6, .5, .6);
  const yOf = v => CH.yb - (v - CH.p0) * CH.k;
  const draw = E.io(inv(24.6, 25.7, t));
  const fadeLine = 1 - E.io(inv(25.9, 26.5, t));
  // axis furniture
  ctx.save(); ctx.globalAlpha = a;
  text(ctx, 'BRENT CRUDE · DAILY SPOT PRICE · US$ / BARREL · 2026', CH.x0, yOf(145) - 10, { font: font(12, 500, 'Geist Mono'), ls: 2.5, a: .75 });
  text(ctx, 'SOURCE: U.S. EIA VIA FRED', CH.x0, yOf(145) + 10, { font: font(10.5, 400, 'Geist Mono'), ls: 2, a: .4 });
  ctx.setLineDash([3, 6]);
  line(ctx, [[CH.x0, yOf(100)], [lerp(CH.x0, CH.x1, E.out3(inv(24.3, 25.0, t))), yOf(100)]], `rgba(${C.cream},.35)`, 1);
  ctx.setLineDash([]);
  text(ctx, '$100', CH.x1 + 14, yOf(100) + 4, { font: font(12, 500, 'Geist Mono'), ls: 1.5, a: .7 });
  const months = 'JAN FEB MAR APR MAY JUN JUL AUG SEP'.split(' ');
  months.forEach((m, i) => {
    const x = lerp(CH.x0, CH.x1, (Date.parse(`2026-${String(i + 1).padStart(2, '0')}-01`) - Date.parse('2026-01-01')) / (Date.parse('2026-09-30') - Date.parse('2026-01-01')));
    text(ctx, m, x, CH.yb + 42, { font: font(10.5, 400, 'Geist Mono'), ls: 2, a: .45 });
    line(ctx, [[x, CH.yb + 22], [x, CH.yb + 28]], `rgba(${C.cream},.3)`, 1);
  });
  ctx.restore();
  // the curve
  if (draw > 0) {
    const L = chartLen[chartLen.length - 1] * draw; const pts = [];
    for (let i = 0; i < chartPts.length && chartLen[i] <= L; i++) pts.push(chartPts[i]);
    pts.push(chartAt(draw));
    ctx.save(); ctx.lineJoin = 'round';
    line(ctx, pts, `rgba(${C.cream},${.95 * fadeLine * a})`, 1.6); ctx.restore();
    // annotations
    const ann = [['2026-02-27', 'FEB 27  $71', 'l'], ['2026-04-07', 'APR 7  $138', 'r'], ['2026-09-22', 'SEP 22  $115', 'r']];
    ann.forEach(([d, s, side], i) => {
      const cp = chartPts.find(p => p[3] === d); if (!cp) return;
      const idx = chartPts.indexOf(cp); if (chartLen[idx] > L) return;
      const aa = a * fadeLine * inv(0, .3, (L - chartLen[idx]) / chartLen[chartLen.length - 1] * 3);
      ctx.fillStyle = `rgba(${C.cream},${aa})`; ctx.beginPath(); ctx.arc(cp[0], cp[1], 3, 0, 7); ctx.fill();
      const ly = cp[1] - 30;
      line(ctx, [[cp[0], cp[1] - 6], [cp[0], ly + 6]], `rgba(${C.cream},${aa * .4})`, 1);
      text(ctx, s, cp[0] + (side === 'l' ? -8 : 8), ly, { font: font(11, 500, 'Geist Mono'), ls: 1.5, align: side === 'l' ? 'right' : 'left', a: aa * .85 });
    });
  }
}

// ----- ripple rings
const RING_WORDS = ['OIL SUPPLY', 'ENERGY PRICES', 'SHIPPING', 'INDUSTRY', 'GLOBAL ECONOMY'];
const RING_MI = [1000, 2000, 3000, 4000, 5000];
const RING_T = [26.6, 27.15, 27.7, 28.25, 28.8];
function ringRadiusKm(k, t) {
  const u = inv(RING_T[k], RING_T[k] + 3.4, t);
  return lerp(400, RING_MI[k] * 1.609, E.out3(u));
}
function ringPts(km, n = 240) {
  const pts = []; let prev = null;
  for (let i = 0; i <= n; i++) {
    const brg = i / n * 360;
    let [lon, lat] = dest(HZ[0], HZ[1], brg, km);
    lon = HZ[0] + ((lon - HZ[0] + 540) % 360) - 180;
    const [x, y] = toW(lon, lat);
    const p = lat > 78 || lat < -70 ? null : proj(x, y, 0);
    pts.push(p && prev && Math.abs(p[0] - prev[0]) > W * .5 ? null : p); prev = p;
  }
  return pts;
}
function ringScreen(t, km, u) { // point on the first ring (for the morph)
  let [lon, lat] = dest(HZ[0], HZ[1], (u - 0.5) * 360, km);
  const [x, y] = toW(lon, lat); return proj(x, y, 0);
}
function strokePts(c, pts, style, lw) {
  c.beginPath(); let pen = false;
  for (const p of pts) { if (!p) { pen = false; continue; } if (!pen) { c.moveTo(p[0], p[1]); pen = true; } else c.lineTo(p[0], p[1]); }
  c.strokeStyle = style; c.lineWidth = lw; c.stroke();
}
function textOnPath(c, s, pts, startFrac, f, ls, style) {
  const seg = []; let L = 0;
  for (let i = 1; i < pts.length; i++) { if (!pts[i] || !pts[i - 1]) { seg.push(null); continue; } const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push([pts[i - 1], pts[i], L, d]); L += d; }
  c.save(); c.font = f; c.letterSpacing = '0px'; c.fillStyle = style; c.textAlign = 'center'; c.textBaseline = 'middle';
  let pos = startFrac * L;
  for (const ch of s) {
    const w = c.measureText(ch).width; const mid = pos + w / 2;
    const sg = seg.find(q => q && mid >= q[2] && mid <= q[2] + q[3]);
    if (sg) {
      const u = (mid - sg[2]) / sg[3]; const x = lerp(sg[0][0], sg[1][0], u), y = lerp(sg[0][1], sg[1][1], u);
      const ang = Math.atan2(sg[1][1] - sg[0][1], sg[1][0] - sg[0][0]);
      c.save(); c.translate(x, y); c.rotate(ang); c.fillText(ch, 0, -9); c.restore();
    }
    pos += w + ls;
  }
  c.restore();
}
function drawRings(t) {
  if (t < 26.3) return;
  // great-circle network to demand centres
  const netA = inv(27.4, 29.5, t) * (1 - .6 * inv(31.0, 32.0, t));
  for (const [ci, cty] of CITIES.entries()) {
    const d = E.io(inv(27.2 + ci * 0.18, 28.9 + ci * 0.18, t)); if (d <= 0) continue;
    const pts = []; const n = 80;
    const r = Math.PI / 180, p1 = [Math.cos(HZ[1] * r) * Math.cos(HZ[0] * r), Math.cos(HZ[1] * r) * Math.sin(HZ[0] * r), Math.sin(HZ[1] * r)];
    const p2 = [Math.cos(cty.lat * r) * Math.cos(cty.lon * r), Math.cos(cty.lat * r) * Math.sin(cty.lon * r), Math.sin(cty.lat * r)];
    const om = Math.acos(p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2]);
    for (let i = 0; i <= n * d; i++) {
      const f = i / n, A = Math.sin((1 - f) * om) / Math.sin(om), B = Math.sin(f * om) / Math.sin(om);
      const v = [A * p1[0] + B * p2[0], A * p1[1] + B * p2[1], A * p1[2] + B * p2[2]];
      let lon = Math.atan2(v[1], v[0]) / r, lat = Math.asin(v[2]) / r; lon = HZ[0] + ((lon - HZ[0] + 540) % 360) - 180;
      pts.push(projLL(lon, lat, 0));
    }
    strokePts(ctx, pts, `rgba(${C.cream},${.22 * netA})`, 1);
  }
  for (let k = 0; k < 5; k++) {
    if (t < RING_T[k]) continue;
    const km = ringRadiusKm(k, t);
    const age = inv(RING_T[k], RING_T[k] + 0.25, t);
    const settle = inv(RING_T[k] + 2.2, RING_T[k] + 3.4, t);
    const finalA = lerp(1, .32, inv(30.8, 31.8, t));
    const pts = ringPts(km);
    const a = age * lerp(.85, .5, settle) * finalA;
    strokePts(ctx, pts, `rgba(${C.cream},${a})`, k === 4 ? 1.3 : 1);
    // word riding the wave
    const wa = age * (1 - inv(RING_T[k] + 2.6, RING_T[k] + 3.3, t));
    if (wa > 0) {
      const big = k === 4;
      const f = big ? font(lerp(22, 60, E.in2(inv(RING_T[k], RING_T[k] + 3.2, t))), 300) : font(15, 500);
      textOnPath(ctx, RING_WORDS[k], pts.slice().reverse(), 0.30 + k * 0.012, f, big ? 10 : 5, `rgba(${C.cream},${wa})`);
    }
    // mile label (SE, over the Indian Ocean)
    const ma = inv(RING_T[k] + 2.4, RING_T[k] + 3.2, t) * (1 - .4 * inv(31.8, 32.5, t));
    if (ma > 0) {
      let [lon, lat] = dest(HZ[0], HZ[1], 152, km); lon = HZ[0] + ((lon - HZ[0] + 540) % 360) - 180;
      const p = projLL(lon, lat, 0);
      if (p) { ctx.fillStyle = C.bg; const s = fmt(RING_MI[k]) + ' MI'; const w = measure(ctx, s, font(10.5, 500, 'Geist Mono'), 2);
        ctx.fillStyle = 'rgba(3,12,10,.9)'; ctx.fillRect(p[0] - w / 2 - 6, p[1] - 9, w + 12, 18);
        text(ctx, s, p[0], p[1] + 4, { font: font(10.5, 500, 'Geist Mono'), ls: 2, align: 'center', a: ma * .7 }); }
    }
  }
  // cities light up as the wave reaches them
  for (const cty of CITIES) {
    let hit = -1; for (let k = 0; k < 5; k++) if (t >= RING_T[k] && ringRadiusKm(k, t) >= cty.km) { hit = k; break; }
    if (hit < 0) continue;
    const firstT = RING_T[0];
    const a = inv(0, 1, 1) * (1 - inv(31.2, 32.2, t));
    const p = projLL(cty.lon, cty.lat, 0); if (!p) continue;
    ctx.fillStyle = `rgba(${C.cream},${.9 * a})`; ctx.beginPath(); ctx.arc(p[0], p[1], 2.4, 0, 7); ctx.fill();
    text(ctx, cty.n, p[0] + 8, p[1] - 3, { font: font(10.5, 500, 'Geist Mono'), ls: 2, a: .8 * a });
    text(ctx, fmt(cty.km / 1.609) + ' MI', p[0] + 8, p[1] + 11, { font: font(10, 400, 'Geist Mono'), ls: 1.5, a: .45 * a });
  }
}

// ----- disruption: gate + quote
function drawDisruption(t) {
  if (t < T_STOP || t > 24.5) return;
  const gp = E.out5(inv(19.75, 20.35, t)), ga = 1 - inv(23.6, 24.3, t);
  const a = projLL(...GAUGE[0]), b = projLL(...GAUGE[1]);
  if (a && b && gp > 0) {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    line(ctx, [[lerp(mx, a[0], gp), lerp(my, a[1], gp)], [lerp(mx, b[0], gp), lerp(my, b[1], gp)]], `rgba(${C.cream},${ga})`, 2.2);
  }
  const qa = win(t, 20.35, 22.35, .6, .4);
  if (qa > 0) {
    const f = font(46, 400, 'Instrument Serif', 'italic');
    revealText(ctx, '“The largest supply disruption in the', 150, 180, inv(20.35, 20.95, t), { font: f, a: qa });
    revealText(ctx, 'history of the global oil market.”', 150, 234, inv(20.5, 21.1, t), { font: f, a: qa });
    text(ctx, 'INTERNATIONAL ENERGY AGENCY · OIL MARKET REPORT · MARCH 2026', 152, 280, { font: font(11, 400, 'Geist Mono'), ls: 2.5, a: qa * .55 * inv(20.9, 21.4, t) });
  }
}

// ----- final
function drawFinal(t) {
  // lime source point at the strait (returns after the ripple)
  if (t > 26.4) {
    const p = projLL(HZ[0], HZ[1], 0);
    const a = inv(26.4, 27.2, t);
    if (p) {
      ctx.fillStyle = `rgba(${C.lime},${a})`; ctx.beginPath(); ctx.arc(p[0], p[1], 3.2, 0, 7); ctx.fill();
      gctx.fillStyle = `rgba(${C.lime},${a})`; gctx.beginPath(); gctx.arc(p[0], p[1], 9, 0, 7); gctx.fill();
      const ph = ((t - 26.4) / 2.2) % 1;
      ctx.strokeStyle = `rgba(${C.lime},${a * (1 - ph) * .6})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p[0], p[1], 4 + ph * 26, 0, 7); ctx.stroke();
    }
  }
  if (t < 31.3) return;
  const bd = inv(31.0, 32.0, t);
  const g = ctx.createRadialGradient(420, 880, 40, 420, 880, 760); g.addColorStop(0, `rgba(3,12,10,${.82 * bd})`); g.addColorStop(1, 'rgba(3,12,10,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 300, 1300, 780);
  const f = font(62, 300);
  const x = 150, y0 = 792;
  text(ctx, 'STRAIT OF HORMUZ · 26°34′N 56°15′E', x + 2, y0 - 88, { font: font(11, 500, 'Geist Mono'), ls: 3, a: .55 * inv(31.3, 31.9, t) });
  line(ctx, [[x + 2, y0 - 68], [x + 2 + 420 * E.out3(inv(31.4, 32.2, t)), y0 - 68]], `rgba(${C.cream},.25)`, 1);
  revealText(ctx, 'THE WORLD ECONOMY', x, y0, inv(31.55, 32.3, t), { font: f, ls: -1 });
  revealText(ctx, 'CAN FEEL A BOTTLENECK', x, y0 + 72, inv(31.85, 32.6, t), { font: f, ls: -1 });
  revealText(ctx, 'THOUSANDS OF MILES AWAY.', x, y0 + 144, inv(32.25, 33.0, t), { font: f, ls: -1 });
  text(ctx, 'DATA: IEA · U.S. EIA · IMO · FRED     ELEVATION: AWS TERRAIN TILES', 152, 1000, { font: font(9.5, 400, 'Geist Mono'), ls: 2, a: .34 * inv(33.6, 34.4, t) });
}

// ================================================================= COMPOSITE
let vign;
function makeStatics() {
  out = document.getElementById('out'); octx = out.getContext('2d');
  ov = cvs(); ctx = ov.getContext('2d'); gw = cvs(W / 2, H / 2); gctx = gw.getContext('2d'); numC = cvs(); maskC = cvs();
  gctx.setTransform(.5, 0, 0, .5, 0, 0);
  vign = cvs(); const v = vign.getContext('2d');
  const g = v.createRadialGradient(W / 2, H * .52, H * .25, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,4,3,.72)'); v.fillStyle = g; v.fillRect(0, 0, W, H);
  seed = 3;
  for (let k = 0; k < 6; k++) {
    const c = cvs(512, 512), x = c.getContext('2d'), id = x.createImageData(512, 512);
    for (let i = 0; i < id.data.length; i += 4) { const n = rnd() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = n; id.data[i + 3] = 255; }
    x.putImageData(id, 0, 0); grainC.push(c);
  }
}
window.renderFrame = function (f) {
  const t = f / FPS;
  renderGL(t);
  ctx.clearRect(0, 0, W, H); gctx.clearRect(0, 0, W * 2, H * 2);
  drawOpening(t);
  drawLabels(t);
  drawRouteLines(t);
  drawFleet(t);
  drawHormuz(t);
  drawNumber(t);
  drawDisruption(t);
  drawChart(t);
  drawRings(t);
  drawFinal(t);
  // composite
  octx.globalCompositeOperation = 'source-over'; octx.globalAlpha = 1; octx.filter = 'none';
  octx.drawImage(gl.canvas, 0, 0);
  octx.save(); octx.filter = 'blur(9px)'; octx.globalCompositeOperation = 'lighter'; octx.globalAlpha = .55; octx.drawImage(gw, 0, 0, W, H); octx.restore();
  octx.drawImage(ov, 0, 0);
  octx.drawImage(vign, 0, 0);
  // grain
  seed = 1000 + f; const gc = grainC[f % grainC.length];
  octx.save(); octx.globalCompositeOperation = 'overlay'; octx.globalAlpha = .07;
  const ox = Math.floor(rnd() * 512), oy = Math.floor(rnd() * 512);
  for (let x = -ox; x < W; x += 512) for (let y = -oy; y < H; y += 512) octx.drawImage(gc, x, y);
  octx.restore();
  return t;
};
window.init = async function () {
  await loadData();
  await Promise.all([font(50, 300), font(50, 200), font(50, 250), font(15, 500, 'Geist Mono'), font(15, 400, 'Geist Mono'), font(40, 400, 'Instrument Serif', 'italic'), font(40, 400, 'Instrument Serif')].map(f => document.fonts.load(f)));
  initGL(); buildRoutes(); buildChart(); makeStatics();
  S_C = nearestS(TSS_PATH, ...toW(56.52, 26.66));
  WALL_PATH = new Path([[51.05, 27.30], [52.15, 26.95], [53.45, 26.42], [54.55, 26.22], [55.30, 26.31], [55.95, 26.47]], 0.01);
  return { ships: SHIPS.length, cities: CITIES.map(c => c.n + ' ' + Math.round(c.km / 1.609)) };
};
