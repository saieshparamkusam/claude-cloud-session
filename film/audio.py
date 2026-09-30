"""HORMUZ — procedural sound design, synced to the visual timeline in main.js.
Everything is synthesised here (no samples): air, sub drones, pulses, data clicks,
mechanical textures, risers, a sonified Brent price curve, ring pulses and a pad.
"""
import json, numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 37.0
N = int(SR * DUR)
rng = np.random.default_rng(11)
L = np.zeros(N); R = np.zeros(N)          # dry bus
RL = np.zeros(N); RR = np.zeros(N)        # reverb send
T_ACC, T_STOP = 16.8, 19.3

def db(x): return 10 ** (x / 20)
def tt(n): return np.arange(n) / SR
def idx(t): return int(round(t * SR))

def put(sig, t0, gain=1.0, pan=0.0, send=0.0):
    """pan: -1..1 scalar or array (equal power)."""
    i0 = idx(t0)
    if i0 >= N: return
    if i0 < 0: sig = sig[-i0:]; i0 = 0
    if isinstance(pan, np.ndarray): pan = pan[:len(sig)]
    n = min(len(sig), N - i0); sig = sig[:n] * gain
    p = pan if np.isscalar(pan) else pan[:n]
    a = (np.asarray(p) + 1) * np.pi / 4
    l, r = sig * np.cos(a), sig * np.sin(a)
    L[i0:i0 + n] += l; R[i0:i0 + n] += r
    if send:
        RL[i0:i0 + n] += l * send; RR[i0:i0 + n] += r * send

def env(n, a=0.01, r=0.2, curve=4.0):
    t = tt(n); e = np.minimum(1, t / max(a, 1e-4))
    rel = np.exp(-np.maximum(0, t - a) / max(r, 1e-4) * (curve / 4))
    return e * rel

def osc(freq, n, kind='sin', ph=0.0):
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    phase = 2 * np.pi * np.cumsum(f) / SR + ph
    if kind == 'sin': return np.sin(phase)
    if kind == 'saw': return signal.sawtooth(phase)
    if kind == 'tri': return signal.sawtooth(phase, 0.5)

def lp(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, order=2): return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)

def svf(x, fc, q=0.7, mode='bp'):
    """time-varying state-variable filter; fc can be an array."""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    g = np.tan(np.pi * np.clip(fc, 20, SR * 0.45) / SR); k = 1 / q
    a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2
    ic1 = ic2 = 0.0; y = np.empty_like(x)
    for i in range(len(x)):
        v3 = x[i] - ic2; v1 = a1[i] * ic1 + a2[i] * v3; v2 = ic2 + a2[i] * ic1 + a3[i] * v3
        ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2
        y[i] = v1 if mode == 'bp' else (v2 if mode == 'lp' else x[i] - k * v1 - v2)
    return y

def noise(n): return rng.standard_normal(n)
def pink(n):
    w = np.fft.rfft(noise(n)); f = np.fft.rfftfreq(n, 1 / SR); f[0] = 1
    return np.fft.irfft(w / np.sqrt(f), n) * 30

def ease_io(u): u = np.clip(u, 0, 1); return np.where(u < .5, 4 * u ** 3, 1 - (-2 * u + 2) ** 3 / 2)
def inv(a, b, x): return np.clip((x - a) / (b - a), 0, 1)

# ------------------------------------------------------------------ primitives
def click(bright=1.0, dur=0.012):
    n = int(SR * dur); e = np.exp(-tt(n) / (dur / 5))
    s = hp(noise(n), 2500 * bright) * e * 0.6 + osc(4200 * bright, n) * e * 0.5
    return s

def tick_wood(freq=1800, dur=0.03):
    n = int(SR * dur); e = np.exp(-tt(n) / 0.006)
    return (bp(noise(n), freq * .7, freq * 1.4) * 1.5 + osc(freq, n) * .4) * e

def thump(f0=90, f1=48, dur=0.5, dec=0.12):
    n = int(SR * dur); t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t / 0.03)
    return np.tanh(osc(f, n) * env(n, 0.002, dec) * 1.6)

def bell(f, dur=2.5, dec=0.9, bright=1.0):
    n = int(SR * dur); t = tt(n)
    mod = osc(f * 2.01, n) * 1.6 * bright * np.exp(-t / 0.25)
    s = np.sin(2 * np.pi * f * t + mod) * env(n, 0.004, dec)
    return s + 0.25 * osc(f * 3.0, n) * env(n, 0.002, dec * 0.3)

def whoosh(dur, f0, f1, q=1.2, shape=None):
    n = int(SR * dur); u = np.linspace(0, 1, n)
    fc = f0 * (f1 / f0) ** u
    s = svf(noise(n), fc, q)
    e = shape(u) if shape else np.sin(np.pi * u) ** 1.5
    return s * e

def pad_voice(f, dur, detune=0.004, cutoff=900):
    n = int(SR * dur)
    s = sum(osc(f * (1 + d), n, 'saw', rng.uniform(0, 6)) for d in (-detune, 0, detune)) / 3
    return lp(s, cutoff, 2)

# ------------------------------------------------------------------ 0 · air / room tone (whole film, shaped)
n = N; t = tt(n)
air = bp(pink(n), 1800, 7000) * 0.05
air_env = np.interp(t, [0, 3, 4.2, 9, 19.29, 19.31, 20.3, 26, 31, 36, 37], [.7, 1, 1, .6, .6, .18, .35, .5, .45, .4, 0])
put(air * air_env, 0, db(-12), 0)
room = lp(noise(n), 180) * 0.35 * np.interp(t, [0, 4, 8, 19.29, 19.31, 21, 37], [.4, .6, 1, 1, .2, .6, .3])
put(room, 0, db(-24), 0)

# ------------------------------------------------------------------ 1 · the first line (0–4.2)
n = int(SR * 4.8); t = tt(n)
line_tone = (osc(880, n) * .6 + osc(1318.5, n) * .25 + osc(1760.2, n) * .12) * np.interp(t, [0, .6, 3.6, 4.8], [0, 1, .8, 0])
line_tone *= 0.8 + 0.2 * np.sin(2 * np.pi * 3.1 * t)
put(line_tone, 0.2, db(-35), np.interp(t, [0, 4.8], [-.8, .7]), send=.6)
n = int(SR * 3.6); t = tt(n)
line2 = (osc(587.3, n) * .7 + osc(880.3, n) * .2) * np.interp(t, [0, .5, 2.8, 3.6], [0, 1, .7, 0])
put(line2, 1.3, db(-39), np.interp(t, [0, 3.6], [.8, -.4]), send=.6)
# lane hairlines drawing
for k, tk in enumerate(np.linspace(1.95, 3.5, 5)): put(click(.8), tk, db(-40), -.5 + k * .25, send=.3)
# "narrows": narrowing band of noise
put(whoosh(1.3, 3200, 900, q=np.linspace(.8, 6, int(SR * 1.3)).mean()), 2.3, db(-30), 0, send=.4)
# gauge endpoints + label
put(tick_wood(2400), 2.72, db(-27), -.3, send=.4); put(tick_wood(2400), 3.45, db(-27), .3, send=.4)
put(click(1.2), 3.25, db(-33), .1)
put(bell(659.3, 3, 1.2, .5), 2.95, db(-33), 0, send=.8)   # "to this?"

# ------------------------------------------------------------------ 2 · reveal (4.2–10)
n = int(SR * 33); t = tt(n)
drone = (osc(41.2, n) * .8 + osc(55.0 * 1.001, n) * .6 + osc(82.4, n) * .18)
drone_env = np.interp(t + 4.0, [4, 7, 10, 17, 19.29, 19.3, 21, 24, 26.5, 31, 35, 37], [0, .8, 1, 1, 1, 0, 0, .5, .9, .6, .4, 0])
drone *= drone_env * (0.85 + 0.15 * np.sin(2 * np.pi * 0.23 * t))
put(lp(drone, 140), 4.0, db(-15), 0)
put(whoosh(3.2, 180, 2600, 1.0, lambda u: np.sin(np.pi * u) ** 2), 4.1, db(-19), np.linspace(-.4, .4, int(SR * 3.2)), send=.3)
put(whoosh(2.2, 1400, 250, 1.3), 6.3, db(-25), 0, send=.3)
# HORMUZ lands
put(thump(110, 44, 2.2, 0.9), 6.1, db(-10), 0, send=.2)
put(lp(noise(int(SR * .5)), 900) * env(int(SR * .5), .002, .08), 6.1, db(-24), 0, send=.4)
for f, g in ((220, -30), (329.6, -33), (493.9, -36)):
    put(pad_voice(f, 3.6, cutoff=1400) * np.interp(tt(int(SR * 3.6)), [0, .5, 2.5, 3.6], [0, 1, .6, 0]), 6.05, db(g), 0, send=.8)
# compression squeeze + fly
n = int(SR * 1.0); u = np.linspace(0, 1, n)
sq = svf(noise(n), 2400 * (0.25 ** u), 2 + 10 * u) * (u ** 1.5) * 0.8 + osc(420 * (0.35 ** u), n, 'tri') * u ** 2 * 0.15
put(sq, 7.3, db(-22), 0, send=.3)
put(whoosh(0.9, 500, 3000, 1.5, lambda u: u ** 2 * (1 - u) * 4), 8.2, db(-27), np.linspace(-.1, .3, int(SR * .9)), send=.3)
put(click(1.0), 9.08, db(-26), .2, send=.5)
put(bell(987.8, 2, .8, .3), 9.1, db(-38), .2, send=.8)

# ------------------------------------------------------------------ 3 · flow (9.8–19.3): pulses + data ticks
def speed(ts): return np.where(ts < T_ACC, 1.0, np.where(ts < T_STOP, 1 + 2.6 * inv(T_ACC, T_STOP, ts) ** 2, 0.0))
beat = 60 / 112
ph, tcur, pulses = 0.0, 9.8, []
while tcur < T_STOP:
    ph += speed(np.array(tcur)) / SR * 64 / beat; tcur += 64 / SR
    if ph >= 1: ph -= 1; pulses.append(tcur)
for i, tp in enumerate(pulses):
    lvl = np.interp(tp, [9.8, 11, 16.8, 19.3], [-26, -17, -16, -12])
    put(thump(95, 56, 0.35, 0.1), tp, db(lvl), 0)
    if i % 2 == 1: put(hp(noise(int(SR * .04)), 6000) * env(int(SR * .04), .001, .012), tp, db(lvl - 12), .3 * (-1) ** i, send=.2)
# data ticks: density follows the fleet and its speed
tk = 9.8
while tk < T_STOP:
    rate = 16 * float(speed(np.array(tk))) * float(np.clip((tk - 9.8) / 2.5, 0, 1)) + 1e-3
    tk += rng.exponential(1 / rate)
    if tk >= T_STOP - 0.005: break
    put(click(rng.uniform(.7, 1.6), rng.uniform(.006, .014)), tk, db(rng.uniform(-40, -32)), rng.uniform(-.9, .9), send=.15)
# typography hits
put(bell(440, 3, 1.4, .8), 10.55, db(-26), -.4, send=.7); put(click(1.1), 10.55, db(-28), -.4)
for tk2 in (11.2, 11.35): put(tick_wood(2100), tk2, db(-33), -.2, send=.3)
put(bell(659.3, 3, 1.4, .8), 13.5, db(-27), -.3, send=.7); put(click(1.1), 13.5, db(-29), -.3)
for tk2 in (14.1, 14.2, 15.3, 15.6): put(tick_wood(2300), tk2, db(-34), 0, send=.3)
# acceleration: mechanical texture + riser, hard cut at the stop
n = idx(T_STOP) - idx(15.8); t = tt(n) + 15.8
sp = speed(t)
mech = bp(noise(n), 90, 700) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * np.cumsum(sp * 7.5) / SR))) * np.interp(t, [15.8, 16.8, T_STOP], [0, .3, 1])
put(mech, 15.8, db(-24), 0, send=.1)
n = idx(T_STOP) - idx(16.6); u = np.linspace(0, 1, n)
riser = svf(noise(n), 300 * (14 ** u ** 1.3), 3.0) * u ** 2.2 + osc(196 * 4 ** u ** 1.6, n, 'saw') * 0.05 * u ** 3
riser = lp(riser, 9000)
put(riser, 16.6, db(-15), np.sin(np.linspace(0, 9, n)) * .3 * u, send=.25)

# hard stop: everything before T_STOP is cut with a 4 ms fade (dry + send)
i0 = idx(T_STOP); fade = np.linspace(1, 0, int(SR * .004))
for B in (L, R, RL, RR):
    tail = B[i0:i0 + len(fade)].copy(); B[i0:] = 0; B[i0:i0 + len(fade)] = tail * fade
# ...then the thud and near silence
put(thump(70, 38, 1.0, 0.2), T_STOP, db(-11), 0)
put(lp(noise(int(SR * .4)), 120) * env(int(SR * .4), .002, .08), T_STOP, db(-20), 0)
air2 = bp(pink(int(SR * 17.7)), 1800, 7000) * 0.05 * np.interp(tt(int(SR * 17.7)), [0, 1, 6, 17.7], [.08, .15, .45, .4])
put(air2, T_STOP + 0.004, db(-12), 0)
put(tick_wood(3200, .02), 19.78, db(-32), .1, send=.8)          # gate
put(bell(261.6, 4, 1.6, .25), 20.35, db(-31), 0, send=1.0)      # the quote

# ------------------------------------------------------------------ 4 · stacking (20.45–23.5)
cols = 80
for i in range(0, 1600, 4):
    u = i / 1600
    # inverse of the io2 fill curve -> time of this slot
    ts = 21.25 + 2.2 * (np.sqrt(u / 2) if u < .5 else 1 - np.sqrt((1 - u) / 2))
    put(tick_wood(rng.uniform(1300, 2600), .025), ts + rng.uniform(0, .01), db(rng.uniform(-40, -34)), rng.uniform(-.8, .8), send=.12)
for k in range(28):
    ts = 20.45 + k / 28 * 1.8
    put(tick_wood(900, .04), ts, db(-34), -.6 + k / 28 * 1.2, send=.2)
n = int(SR * 3.4); t = tt(n)
hum = bp(noise(n), 60, 260) * np.interp(t, [0, 1.5, 3.4], [0, 1, .6]) * (0.7 + .3 * np.sin(2 * np.pi * 11 * t))
put(hum, 20.5, db(-30), 0)

# ------------------------------------------------------------------ 5 · the wall becomes a price curve (24–26.7)
put(whoosh(1.1, 3000, 260, 1.4, lambda u: np.sin(np.pi * u) ** 1.2), 23.95, db(-24), np.linspace(-.5, .5, int(SR * 1.1)), send=.35)
brent = json.load(open('data/brent.json'))
p = np.array([v for _, v in brent])
n = idx(25.75) - idx(24.6); u = ease_io(np.linspace(0, 1, n))
pr = np.interp(u * (len(p) - 1), np.arange(len(p)), p)
f = 220 * (pr / 60) ** 1.25
son = osc(f, n) * .7 + osc(f * 2, n) * .12 + osc(f * 1.5, n) * .08
son *= np.interp(np.linspace(0, 1, n), [0, .05, .9, 1], [0, 1, 1, 0])
put(son, 24.6, db(-27), np.linspace(-.6, .6, n), send=.6)
for d in ('2026-02-27', '2026-04-07', '2026-09-22'):
    k = [x for x, _ in brent].index(d) / (len(brent) - 1)
    uu = np.interp(k, u, np.linspace(0, 1, n)) if k <= u[-1] else 1
    put(click(1.3), 24.6 + uu * (25.75 - 24.6), db(-29), -.6 + 1.2 * uu, send=.3)
n = int(SR * .9); u = np.linspace(0, 1, n)
put(whoosh(.9, 700, 2400, 2.5), 25.85, db(-27), np.sin(u * 2 * np.pi) * .8, send=.4)

# ------------------------------------------------------------------ 6 · ripple (26.6–31)
RING_T = [26.6, 27.15, 27.7, 28.25, 28.8]
for k, tr in enumerate(RING_T):
    put(thump(75, 40 - k * 1.5, 2.5, 0.8 + k * .12), tr, db(-9 + k * .4), 0, send=.15)
    put(lp(noise(int(SR * .4)), 400) * env(int(SR * .4), .002, .06), tr, db(-22), 0)
    put(bell(220 * [1, 1.5, 2, 2.25, 3][k], 2.5, 1.2, .4), tr, db(-33), (-1) ** k * .3, send=.8)
# increasing rhythmic complexity: one more subdivision layer per ring, dropping out for the final
sub = 0.55
for k in range(5):
    div = [2, 3, 4, 6, 8][k]
    tstart, tend = RING_T[k], 31.0 - (4 - k) * 0.12
    tb = tstart; j = 0
    while tb < tend:
        lvl = -38 + k * 0.5 - (6 if j % div else 0)
        put(click(1.0 + .25 * k, .006), tb, db(lvl), [-.7, .7, -.35, .35, 0][k], send=.2)
        tb += sub / div; j += 1
# deep controlled bass bed
n = int(SR * 5.2); t = tt(n)
bass = osc(36.7, n) * np.interp(t, [0, .5, 4.2, 5.2], [0, 1, 1, 0]) * (.8 + .2 * np.sin(2 * np.pi * 1.818 * t))
put(np.tanh(bass * 1.4), 26.6, db(-15), 0)

# ------------------------------------------------------------------ 7 · final: simplify
n = int(SR * 6.4); t = tt(n)
chord = [(73.42, -22), (110.0, -24), (146.83, -26), (164.81, -28), (220.0, -29), (329.63, -33)]  # D sus2 — neutral, open
penv = np.interp(t, [0, 1.2, 4.6, 6.4], [0, 1, .85, 0])
for f, g in chord:
    put(pad_voice(f, 6.4, 0.003, 700) * penv, 30.6, db(g + 2), rng.uniform(-.4, .4), send=.7)
for tl, f in zip((31.55, 31.85, 32.25), (587.3, 659.3, 880.0)):
    put(bell(f, 3.5, 1.6, .25), tl, db(-31), 0, send=1.0)
put(thump(60, 36.7, 3.0, 1.4), 31.55, db(-15), 0)

# ------------------------------------------------------------------ reverb + master
def ir(sec=2.6, decay=0.9):
    n = int(SR * sec); t = tt(n)
    e = np.exp(-t / decay * 3)
    a, b = noise(n) * e, noise(n) * e
    return lp(a, 5000), lp(b, 5000)
irl, irr = ir()
wetL = signal.fftconvolve(RL, irl)[:N] * 0.06; wetR = signal.fftconvolve(RR, irr)[:N] * 0.06
mixL, mixR = L + wetL, R + wetR
mixL, mixR = hp(mixL, 22), hp(mixR, 22)
fade_out = np.interp(tt(N), [0, 0.02, 35.6, 37.0], [0, 1, 1, 0])
mixL *= fade_out; mixR *= fade_out
peak = max(np.abs(mixL).max(), np.abs(mixR).max())
g = db(-1.0) / peak
out = np.stack([mixL * g, mixR * g], 1)
out = np.tanh(out * 1.1) / np.tanh(1.1)   # gentle glue
wavfile.write('audio/score.wav', SR, (out * 32767 * 0.98).astype(np.int16))
print('peak before norm', peak, 'rms dB', 20 * np.log10(np.sqrt((out ** 2).mean())))
