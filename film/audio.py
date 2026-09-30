#!/usr/bin/env python3
"""Sound design for ATTENTION STUDY — Portugal / Wales.

Everything is synthesised from scratch (no samples). Cue times come from sfx.json,
which the animation exports from the very same data that drives the visuals, so
every tick, sweep and impact lands on its frame.

usage: python3 audio.py build/sfx.json out.wav
"""
import json, sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
rng = np.random.default_rng(7)


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def sine_sweep(f0, f1, n, curve='exp'):
    if curve == 'exp':
        f = f0 * (f1 / f0) ** (np.arange(n) / max(n - 1, 1))
    else:
        f = np.linspace(f0, f1, n)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], 'band', output='sos')
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f / (SR / 2), 'low', output='sos'), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f / (SR / 2), 'high', output='sos'), x)


def sweep_bp(x, f0, f1, q=1.2, block=512):
    """time-varying band-pass (block-wise coefficients, state carried)."""
    out = np.zeros_like(x)
    nb = int(np.ceil(len(x) / block))
    zi = None
    for b in range(nb):
        u = b / max(nb - 1, 1)
        fc = f0 * (f1 / f0) ** u if np.isscalar(f0) else f0
        lo, hi = fc / (1 + 0.5 / q), min(fc * (1 + 0.5 / q) * 1.6, SR / 2 - 200)
        sos = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], 'band', output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        seg = x[b * block:(b + 1) * block]
        y, zi = signal.sosfilt(sos, seg, zi=zi)
        out[b * block:(b + 1) * block] = y
    return out


def pan_st(x, p):
    """constant-power pan; p scalar or array in [-1, 1]."""
    a = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def noise(n):
    return rng.standard_normal(n)


def pink(n):
    w = rng.standard_normal(n)
    b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, w) * 8


def norm(x):
    m = np.max(np.abs(x)) + 1e-9
    return x / m


# ── one-shot voices ─────────────────────────────────────────
def v_click(e):
    n = int(0.012 * SR)
    x = hp(noise(n), 2500) * env_exp(n, 0.0012) * 0.8 + np.sin(2 * np.pi * 4200 * np.arange(n) / SR) * env_exp(n, 0.002) * 0.5
    return pan_st(norm(x) * e['g'] * 0.5, e.get('pan', 0)), 0.15


def v_type(e):
    n = int(0.03 * SR)
    x = bp(noise(n), 3000, 9000) * env_exp(n, 0.002) + np.sin(2 * np.pi * 1850 * np.arange(n) / SR) * env_exp(n, 0.004) * 0.35
    return pan_st(norm(x) * e['g'] * 0.4, e.get('pan', 0)), 0.05


def v_tick(e):
    n = int(0.07 * SR); f = e.get('f', 2000)
    x = np.sin(2 * np.pi * f * np.arange(n) / SR) * env_exp(n, 0.009) + hp(noise(n), 4000) * env_exp(n, 0.0015) * 0.3
    return pan_st(norm(x) * e['g'] * 0.45, e.get('pan', 0)), 0.2


def v_pop(e):
    n = int(0.12 * SR); f = e.get('f', 1500)
    x = sine_sweep(f * 1.35, f, n) * env_exp(n, 0.025)
    return pan_st(norm(x) * e['g'] * 0.5, e.get('pan', 0)), 0.25


def v_ping(e):
    n = int(1.2 * SR); f = e.get('f', 1200); t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * f * 2.01 * t) + 0.06 * np.sin(2 * np.pi * f * 3.02 * t)) * env_exp(n, 0.28)
    x[:48] *= np.linspace(0, 1, 48)
    return pan_st(norm(x) * e['g'] * 0.5, e.get('pan', 0)), 0.6


def v_thump(e):
    n = int(0.6 * SR)
    x = sine_sweep(90, 40, n) * env_exp(n, 0.16) + lp(noise(n), 300) * env_exp(n, 0.02) * 0.4
    x[:24] *= np.linspace(0, 1, 24)
    return pan_st(norm(x) * e['g'] * 0.9, 0), 0.15


def v_pulse(e):
    n = int(0.45 * SR)
    x = sine_sweep(115, 52, n) * env_exp(n, 0.11) + lp(noise(n), 180) * env_exp(n, 0.01) * 0.25
    x[:36] *= np.linspace(0, 1, 36)
    return pan_st(norm(x) * e['g'] * 0.8, 0), 0.05


def v_impact(e):
    s = e.get('size', 1.0); n = int(3.2 * SR); t = np.arange(n) / SR
    sub = sine_sweep(62, 28, n) * env_exp(n, 0.55 * s)
    body = lp(noise(n), 900) * env_exp(n, 0.09)
    trans = hp(noise(n), 2500) * env_exp(n, 0.012)
    parts = [1.0, 2.76, 5.40, 8.93, 13.34]
    metal = sum(np.sin(2 * np.pi * 173 * p * t + rng.uniform(0, 6)) / (1 + i) for i, p in enumerate(parts)) * env_exp(n, 0.7) * 0.25
    x = norm(sub) * 1.0 + norm(body) * 0.55 + norm(trans) * 0.35 + metal
    x[:24] *= np.linspace(0, 1, 24)
    st = pan_st(x, 0)
    st[:, 1] = st[:, 1] * 0.96 + np.roll(st[:, 1], 40) * 0.04     # tiny width
    return st * e['g'] * 0.9, 0.55


def v_metal(e):
    n = int(1.4 * SR); t = np.arange(n) / SR
    base = rng.uniform(900, 1400)
    x = sum(np.sin(2 * np.pi * base * r * t + rng.uniform(0, 6)) * rng.uniform(0.3, 1) * env_exp(n, rng.uniform(0.2, 0.7)) for r in [1, 1.51, 2.37, 3.13, 4.02, 5.66])
    x *= np.minimum(1, t / 0.004)
    return pan_st(norm(x) * e['g'] * 0.35, e.get('pan', 0)), 0.7


def v_glitch(e):
    n = int(0.09 * SR)
    x = noise(n)
    hold = rng.integers(8, 60)
    x = np.repeat(x[::hold], hold)[:n]              # sample-and-hold crush
    x = np.round(x * 3) / 3
    gate = np.repeat(rng.random(n // 240 + 1) > 0.35, 240)[:n]
    x = bp(x * gate, 800, 7000) * np.minimum(1, (n - np.arange(n)) / 400)
    return pan_st(norm(x) * e['g'] * 0.4, e.get('pan', 0)), 0.2


def v_whoosh(e):
    d = e['dur']; n = int(d * SR); u = np.arange(n) / n
    if e.get('up'):
        x = sweep_bp(noise(n), 300, 5000, q=0.9); envl = np.sin(np.pi * u) ** 1.5 * (1 - u) ** 0.3
    elif e.get('low'):
        x = sweep_bp(noise(n), 200, 900, q=0.7); envl = np.sin(np.pi * u) ** 2
    else:
        x = sweep_bp(noise(n), 700, 3500, q=0.9); envl = np.sin(np.pi * u) ** 2
    p = e.get('p0', 0) + (e.get('p1', 0) - e.get('p0', 0)) * u
    return pan_st(norm(x * envl) * e['g'] * 0.55, p), 0.3


def v_flyby(e):
    d = e['dur']; n = int(d * SR); u = np.arange(n) / n
    fc = np.where(u < 0.6, 800 + 2600 * u / 0.6, 3400 - 2400 * (u - 0.6) / 0.4)
    x = np.zeros(n); block = 512; zi = None
    nz = noise(n)
    for b in range(0, n, block):
        f = fc[b]
        sos = signal.butter(2, [f / 1.6 / (SR / 2), min(f * 1.6, 20000) / (SR / 2)], 'band', output='sos')
        if zi is None: zi = np.zeros((sos.shape[0], 2))
        x[b:b + block], zi = signal.sosfilt(sos, nz[b:b + block], zi=zi)
    envl = np.where(u < 0.6, (u / 0.6) ** 2.5, (1 - (u - 0.6) / 0.4) ** 1.5)
    pn = e.get('pan', 0); p = np.clip(pn * (u - 0.3) * 1.8, -1, 1)
    return pan_st(norm(x * envl) * e['g'] * 0.55, p), 0.25


def v_riser(e):
    d = e['dur']; n = int(d * SR); u = np.arange(n) / n
    nz = sweep_bp(noise(n), 250, 6500, q=1.1)
    tone = sine_sweep(110, 330, n) * 0.35 + sine_sweep(165, 495, n) * 0.18
    trem = 0.75 + 0.25 * np.sin(2 * np.pi * np.cumsum(4 + 22 * u ** 2) / SR)
    x = (norm(nz) * 0.8 + tone) * (u ** 2.2) * trem
    x[-120:] *= np.linspace(1, 0, 120)
    st = pan_st(x, 0)
    st[:, 0] = np.roll(st[:, 0], 90)                  # decorrelate for width
    return st * e['g'] * 0.5, 0.35


def v_suck(e):
    d = e['dur']; n = int(d * SR); u = np.arange(n) / n
    tail = lp(noise(n), 3000) * env_exp(n, d * 0.3)
    x = tail[::-1] + sine_sweep(40, 160, n) * u ** 3 * 0.6
    x = x * u ** 1.5
    x[-60:] *= np.linspace(1, 0, 60)
    st = pan_st(norm(x), 0)
    st[:, 1] = np.roll(st[:, 1], 70)
    return st * e['g'] * 0.6, 0.2


def v_swell(e):
    d = e['dur']; n = int(d * SR); u = np.arange(n) / n
    lo, hi = (1500, 9000) if e.get('air') else (200, 2200)
    x = bp(pink(n), lo, hi) * np.sin(np.pi * u) ** 2
    return pan_st(norm(x) * e['g'] * 0.4, 0), 0.5


def v_drawtex(e):
    d = e['dur']; n = int(d * SR); u = np.arange(n) / n
    crackle = (rng.random(n) > 0.9993) * rng.standard_normal(n) * 3
    x = bp(noise(n) * 0.3 + crackle, 2500, 9000) * np.sin(np.pi * u) ** 0.8
    p = e.get('p0', 0) + (e.get('p1', 0) - e.get('p0', 0)) * u
    return pan_st(norm(x) * e['g'] * 0.25, p), 0.1


def v_grain(e):
    d = e['dur']; n = int(d * SR); x = np.zeros((n, 2))
    k = int(e['density'] * d)
    for i in range(k):
        s = int(rng.random() * (n - 800)); m = int(0.012 * SR)
        f = rng.uniform(2200, 8000)
        g = rng.uniform(0.2, 1.0) * ((1 - s / n) ** 2 if e.get('decay') else 1)
        blip = np.sin(2 * np.pi * f * np.arange(m) / SR) * env_exp(m, 0.0025) * g
        p = e['p0'] + (e['p1'] - e['p0']) * (s / n) + rng.uniform(-0.3, 0.3)
        x[s:s + m] += pan_st(blip, p)
    return x / (np.max(np.abs(x)) + 1e-9) * e['g'] * 0.35, 0.15


def v_stream(e):
    """attention streaming in: airy bed + density of micro-ticks + distant crowd-like murmur."""
    d = e['dur']; n = int(d * SR); u = np.arange(n) / n
    air = sweep_bp(noise(n), 500, 2600, q=0.6) * (0.2 + u ** 1.6)
    murmur = bp(pink(n), 250, 1400, order=3)
    am = 0.7 + 0.3 * lp(rng.standard_normal(n), 6) * 30
    murmur = murmur * np.clip(am, 0, 1.5) * u ** 1.3
    st = pan_st(norm(air) * 0.5, -0.2) + pan_st(norm(air[::-1]) * 0.0 + norm(murmur) * 0.35, 0.25)
    st[:, 1] += np.roll(norm(air), 300) * 0.45 * (0.2 + u ** 1.6)
    g = v_grain({'g': 1, 'dur': d, 'density': 140, 'p0': -0.8, 'p1': 0.8})[0]
    g *= (0.3 + u)[:, None]
    st = st[:len(g)] + g * 0.6
    st[-2400:] *= np.linspace(1, 0, 2400)[:, None]
    return st * e['g'] * 0.5, 0.2


def v_chord(e):
    d = e['dur']; n = int(d * SR); t = np.arange(n) / SR
    notes = [73.42, 110.0, 146.83, 185.0, 220.0, 329.63]      # D2 A2 D3 F#3 A3 E4 — open, warm
    x = np.zeros(n)
    for i, f in enumerate(notes):
        det = 1 + (i % 2) * 0.0015
        x += (np.sin(2 * np.pi * f * det * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)) / (1 + 0.35 * i)
    envl = np.minimum(1, t / 0.9) * np.minimum(1, (d - t) / 1.2)
    x = lp(x * envl, 1800)
    st = pan_st(norm(x), 0)
    st[:, 1] = np.roll(st[:, 1], 180)
    return st * e['g'] * 0.45, 0.5


VOICES = {k[2:]: v for k, v in globals().items() if k.startswith('v_')}


# ── continuous beds ─────────────────────────────────────────
def automation(points, n):
    ts = np.array([p[0] for p in points]); vs = np.array([p[1] for p in points])
    return np.interp(np.arange(n) / SR, ts, vs)


def bed_drone(n, T):
    t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * 36.71 * t) * 0.9 + np.sin(2 * np.pi * 73.42 * t) * 0.5 + np.sin(2 * np.pi * 110.0 * t + 0.4 * np.sin(2 * np.pi * 0.13 * t)) * 0.18
         + np.sin(2 * np.pi * 146.83 * t * 1.001) * 0.07)
    x = x + lp(pink(n), 220) * 0.05
    a = automation([(0, 0), (3.5, 0), (4.6, 0.16), (8.2, 0.24), (8.4, 0.3), (9.3, 0.16), (13.8, 0.26), (T['point3'] - 0.02, 0.3), (T['point3'], 0),
                    (15.3, 0), (16.4, 0.12), (21.6, 0.26), (22.6, 0.32), (23.4, 0.2), (27.55, 0.34), (T['peak'], 0.08), (T['thaw'], 0.08),
                    (T['iris'], 0.25), (T['iris'] + 0.4, 0), (40, 0)], n)
    return pan_st(x * a, 0)


def bed_bass(n, T):
    """bass movement: slow note changes under the build-ups."""
    seq = [(11.8, 73.42), (12.4, 87.31), (13.0, 98.0), (13.5, 110.0), (T['point3'], 0),
           (T['vert'], 73.42), (18.3, 87.31), (19.4, 98.0), (20.5, 116.54), (T['expand'], 110.0), (T['s5'], 0),
           (23.4, 73.42), (25.9, 87.31), (26.6, 98.0), (27.1, 110.0), (T['peak'], 0)]
    t = np.arange(n) / SR
    f = np.zeros(n); on = np.zeros(n)
    for i, (t0, fr) in enumerate(seq):
        t1 = seq[i + 1][0] if i + 1 < len(seq) else 40
        m = (t >= t0) & (t < t1)
        f[m] = fr; on[m] = 1.0 if fr > 0 else 0.0
    f = lp(np.where(f > 0, f, 73.42), 30, order=1)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    on = lp(on, 25, order=1)
    x = lp(x * on, 400)
    return pan_st(x * 0.22, 0)


def reverb_ir(sec=2.4):
    n = int(sec * SR); t = np.arange(n) / SR
    L = lp(noise(n), 6500) * np.exp(-t / 0.5); R = lp(noise(n), 6500) * np.exp(-t / 0.52)
    for d, g in [(0.011, 0.5), (0.019, 0.35), (0.029, 0.3), (0.041, 0.22)]:
        k = int(d * SR); L[k] += g * 8; R[k + 37] += g * 8
    return L / np.sqrt(np.sum(L ** 2)), R / np.sqrt(np.sum(R ** 2))


def main(src, dst):
    film = json.load(open(src))
    T, dur = film['T'], film['DUR']
    n = int((dur + 0.02) * SR)
    dry = np.zeros((n + SR * 4, 2)); wet = np.zeros_like(dry)
    for e in film['SFX']:
        fn = VOICES.get(e['type'])
        if fn is None:
            print('unknown voice', e['type']); continue
        x, send = fn(e)
        s = int(e['t'] * SR)
        m = min(len(x), len(dry) - s)
        dry[s:s + m] += x[:m]; wet[s:s + m] += x[:m] * send
    beds = bed_drone(len(dry), T) + bed_bass(len(dry), T)
    dry += beds
    irL, irR = reverb_ir()
    wet_mono = wet.mean(axis=1)
    rv = np.stack([signal.fftconvolve(wet_mono, irL)[:len(dry)], signal.fftconvolve(wet_mono, irR)[:len(dry)]], axis=1)
    mix = dry + rv * 0.55
    # silence windows: the film breathes
    t = np.arange(len(mix)) / SR
    duck = np.ones(len(mix))
    for a, b, lvl in [(T['point3'] + 0.12, T['s4'] - 0.02, 0.25), (T['peak'] + 0.18, T['thaw'] - 0.02, 0.35)]:
        m = (t > a) & (t < b); duck[m] = lvl
    duck = lp(duck, 30, order=1)
    mix *= duck[:, None]
    # glue: gentle RMS compression then soft limiting
    rms = np.sqrt(lp(np.mean(mix ** 2, axis=1), 8, order=1).clip(1e-9))
    thr = 0.18
    gain = np.where(rms > thr, (thr / rms) ** 0.45, 1.0)
    mix *= gain[:, None]
    mix = hp(mix.T, 25).T
    mix = mix / (np.max(np.abs(mix)) + 1e-9) * 1.25
    mix = np.tanh(mix) * 0.89
    # trim + fade tail
    end = int(dur * SR)
    mix = mix[:end]
    mix[-int(0.4 * SR):] *= np.linspace(1, 0, int(0.4 * SR))[:, None] ** 2
    wavfile.write(dst, SR, mix.astype(np.float32))
    print('wrote', dst, f'{len(mix) / SR:.2f}s', 'peak', float(np.max(np.abs(mix))))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
