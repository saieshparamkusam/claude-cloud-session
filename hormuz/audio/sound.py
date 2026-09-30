"""Procedural soundtrack for HORMUZ. Everything is synthesised here (no samples).

Beat times mirror B in src/film.js. Output: audio/hormuz_score.wav (48 kHz, 24-bit stereo).
"""
import json
import os
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
DUR = 36.5
N = int(SR * DUR)
HERE = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(11)

B = dict(line=0.3, q1=0.8, q2=1.7, pinch=2.3, qOut=3.9, reveal0=3.6, reveal1=9.8,
         dim0=5.3, hz0=7.2, hz1=10.8, gate=10.6, big0=12.4, accel=16.2, STOP=17.8,
         status=18.3, queue0=19.2, queue1=22.4, bn0=21.2, bn1=23.9, price0=23.9,
         lathe0=25.9, lathe1=27.3, ripple0=27.1, ripple1=31.0, final0=31.2, foot=32.6)

t = np.arange(N) / SR
dry = np.zeros((N, 2))
wet = np.zeros((N, 2))   # reverb send


# ------------------------------------------------------------------ helpers
def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x, axis=0)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x, axis=0)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x, axis=0)


def ramp(a, b, x0, x1, e=lambda u: u):
    """piecewise envelope helper over the whole timeline"""
    u = np.clip((t - x0) / max(x1 - x0, 1e-6), 0, 1)
    return a + (b - a) * e(u)


def smooth(u):
    return u * u * (3 - 2 * u)


def env_ar(n, a, r):
    """attack / exponential release envelope of n samples"""
    e = np.ones(n)
    na = max(1, int(a * SR))
    e[:na] = np.linspace(0, 1, na) ** 2
    e[na:] = np.exp(-np.arange(n - na) / (r * SR))
    return e


def place(sig, at, gain=1.0, pan=0.0, send=0.0):
    """add a mono or stereo signal at time `at` with equal-power pan"""
    i = int(at * SR)
    if i >= N:
        return
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], 1)
    n = min(len(sig), N - i)
    dry[i:i + n] += sig[:n] * gain
    wet[i:i + n] += sig[:n] * gain * send


def noise(n, st=False):
    return rng.standard_normal((n, 2) if st else n)


def pink(n):
    w = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    w[1:] /= np.sqrt(f[1:])
    x = np.fft.irfft(w, n)
    return x / np.abs(x).max()


# ------------------------------------------------------------------ voices
def click(dur=0.004, f=5000, g=1.0):
    n = int(dur * SR)
    x = hp(noise(n), f) * env_ar(n, 0.0003, dur / 4)
    return x / (np.abs(x).max() + 1e-9) * g


def tock(f=1800, dur=0.05):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * tt) * env_ar(n, 0.0005, dur / 6)


def kick(f0=95, f1=48, dur=0.45, g=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-tt / 0.03)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env_ar(n, 0.002, dur / 3.5) * g


def sub_boom(f=38, dur=2.5):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    ff = f * (1 + 0.6 * np.exp(-tt / 0.08))
    x = np.sin(2 * np.pi * np.cumsum(ff) / SR) * env_ar(n, 0.004, dur / 3)
    x += 0.25 * lp(noise(n), 180) * env_ar(n, 0.001, 0.05)
    return x


def bell(f, dur=3.5, bright=1.0):
    """soft FM bell"""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    idx = 2.2 * bright * np.exp(-tt / 0.6)
    x = np.sin(2 * np.pi * f * tt + idx * np.sin(2 * np.pi * f * 1.4 * tt))
    x += 0.3 * np.sin(2 * np.pi * f * 2.01 * tt) * np.exp(-tt / 0.4)
    return x * env_ar(n, 0.003, dur / 4)


def pad(freqs, dur, attack=1.5, release=2.0, bright=900):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.zeros((n, 2))
    for k, f in enumerate(freqs):
        for c, det in enumerate((-0.12, 0.12)):
            ph = rng.random() * 2 * np.pi
            fm = f * (1 + det / 100 * np.sin(2 * np.pi * 0.13 * tt + k))
            saw = 2 * ((np.cumsum(fm) / SR + ph / (2 * np.pi)) % 1) - 1
            x[:, c] += saw
    x = lp(x, bright, 2)
    e = np.minimum(1, tt / attack) * np.minimum(1, (dur - tt) / release)
    return x * np.clip(e, 0, 1)[:, None] / len(freqs)


def whoosh(dur, f0, f1, pan0=-0.6, pan1=0.6, peak=0.6):
    n = int(dur * SR)
    x = noise(n)
    out = np.zeros(n)
    blk = 1024
    for i in range(0, n, blk):
        u = i / n
        fc = f0 * (f1 / f0) ** u
        seg = x[max(0, i - 2048):i + blk]
        y = bp(seg, fc * 0.7, min(fc * 1.4, SR / 2 - 100), 1)
        out[i:i + blk] = y[-len(out[i:i + blk]):]
    u = np.linspace(0, 1, n)
    e = np.where(u < peak, (u / peak) ** 2, ((1 - u) / (1 - peak)) ** 1.5)
    out *= e
    pan = pan0 + (pan1 - pan0) * u
    return np.stack([out * np.cos((pan + 1) * np.pi / 4), out * np.sin((pan + 1) * np.pi / 4)], 1)


def sweep_tone(freqs_t, dur):
    """tone following a frequency curve (array of Hz per sample)"""
    ph = 2 * np.pi * np.cumsum(freqs_t) / SR
    return np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph)


# ------------------------------------------------------------------ 1. air / room tone
air = pink(N)
air = np.stack([bp(air, 250, 4200), bp(np.roll(air, 12345), 250, 4200)], 1)
air /= np.abs(air).max()
lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.11 * t)
air_lvl = (ramp(0, 1, 0, 0.8) * ramp(1, 0.55, 4, 9) * (1 - ramp(0, 0.93, B["STOP"], B["STOP"] + 0.02))
           * (1 + ramp(0, 0.7, B["STOP"] + 1.6, B["STOP"] + 3.8)) * ramp(1, 0.35, B["final0"], DUR))
dry += air * (lfo * air_lvl * 0.035)[:, None]

# ------------------------------------------------------------------ 2. opening: a thin glass tone that travels with the line
n = int(4.8 * SR)
tt = np.arange(n) / SR
tone = (np.sin(2 * np.pi * 1318.5 * tt) * 0.6 + np.sin(2 * np.pi * 1975.5 * tt) * 0.25
        + np.sin(2 * np.pi * 659.25 * tt) * 0.3)
e = np.clip(tt / 1.6, 0, 1) ** 2 * np.clip((4.8 - tt) / 1.6, 0, 1)
pan = np.linspace(-0.7, 0.5, n)
tone *= e * (0.8 + 0.2 * np.sin(2 * np.pi * 3.1 * tt))
place(np.stack([tone * np.cos((pan + 1) * np.pi / 4), tone * np.sin((pan + 1) * np.pi / 4)], 1), B["line"], 0.018, send=0.6)
# words of the question: soft ticks
for i in range(5):
    place(tock(2600, 0.03), B["q1"] + i * 0.11, 0.05, pan=-0.5 + i * 0.1, send=0.4)
for i in range(4):
    place(tock(2200, 0.03), B["q2"] + i * 0.14, 0.05, pan=-0.3 + i * 0.1, send=0.4)
# the pinch: two converging filtered tones
n = int(1.8 * SR)
tt = np.arange(n) / SR
f = 220 + 80 * (tt / 1.8) ** 2
x = sweep_tone(f, 1.8) * np.clip(tt / 0.6, 0, 1) * np.clip((1.8 - tt) / 0.4, 0, 1)
place(lp(x, 900), B["pinch"], 0.04, send=0.5)

# ------------------------------------------------------------------ 3. reveal: low-frequency movement
n = int(8.0 * SR)
tt = np.arange(n) / SR
drone = pad([43.65, 87.3, 130.8], 8.0, attack=2.5, release=2.5, bright=160)
cut = 160 + 520 * smooth(np.clip((tt - 1.0) / 5.0, 0, 1))
dr2 = pad([43.65, 87.3, 130.8, 174.6], 8.0, attack=3.0, release=2.5, bright=700)
mix = np.clip((tt - 1.0) / 5.0, 0, 1)[:, None]
place(drone * (1 - mix) + dr2 * mix, B["reveal0"], 0.2, send=0.3)
place(whoosh(4.2, 90, 1400, -0.5, 0.5, 0.65), B["reveal0"] + 0.4, 0.22, send=0.5)
place(whoosh(2.4, 300, 3000, 0.4, -0.4, 0.7), 6.6, 0.08, send=0.6)
# HORMUZ word stretching: wide airy chord
place(pad([174.6, 261.6, 392.0, 523.3], 4.2, attack=1.2, release=1.6, bright=1800), B["hz0"], 0.10, send=0.8)
# dimension line: fine data ticks
for i in range(12):
    place(click(0.003, 6000), B["dim0"] + i * 0.05, 0.1 * (1 - i / 14), pan=0.2, send=0.2)

# ------------------------------------------------------------------ 4. energy flow: pulses + mechanical ticks
bpm_t = []
tcur = 9.6
while tcur < B["STOP"] - 0.02:
    bpm_t.append(tcur)
    if tcur < B["accel"]:
        step = 60 / 104
    else:
        u = (tcur - B["accel"]) / (B["STOP"] - B["accel"])
        step = 60 / 104 * (1 - 0.72 * u ** 1.3)
    tcur += step / 2      # eighth notes
for k, bt in enumerate(bpm_t):
    grow = np.clip((bt - 9.6) / 3.0, 0, 1)
    if k % 2 == 0:
        place(kick(92, 47, 0.42), bt, 0.30 * grow + 0.08, send=0.1)
    # soft tonal pulse (lime = energy)
    f = [110, 110, 164.8, 110, 146.8, 110, 164.8, 196][k % 8]
    n = int(0.28 * SR)
    tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * tt + 1.4 * np.exp(-tt / 0.05) * np.sin(2 * np.pi * 2 * f * tt)) * env_ar(n, 0.004, 0.07)
    place(lp(x, 1500), bt, 0.07 * grow, pan=0.3 * np.sin(k), send=0.35)
    # ticks at 16ths, denser as traffic grows
    for s in range(2):
        tick_t = bt + s * (bpm_t[1] - bpm_t[0]) / 2 if k + 1 < len(bpm_t) else bt
        p = 0.35 + 0.6 * np.clip((bt - 10) / 7.8, 0, 1)
        if rng.random() < p:
            place(click(0.003, 4500 + rng.random() * 3000), tick_t, 0.13 + 0.09 * rng.random(), pan=rng.uniform(-0.8, 0.8), send=0.15)
# mechanical texture: amplitude-modulated band noise
n = int((B["STOP"] - 10.0) * SR)
tt = np.arange(n) / SR
mech = bp(noise(n), 900, 2600) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 13.0 * tt))) * np.clip(tt / 3, 0, 1)
mech *= (0.4 + 0.6 * np.clip((tt - 5.5) / 2.3, 0, 1))
place(np.stack([mech, np.roll(mech, 300)], 1), 10.0, 0.02)
# counter: rapid data clicks
for i in range(40):
    u = i / 40
    place(click(0.002, 7000), B["gate"] + 0.2 + 1.6 * (u ** 0.7), 0.11, pan=-0.3, send=0.1)
# 20% monolith rising: sub boom + swell
place(sub_boom(36, 3.0), B["big0"], 0.45, send=0.2)
place(pad([55, 82.4, 110, 164.8, 220], 5.0, attack=0.6, release=2.5, bright=1100), B["big0"] + 0.05, 0.14, send=0.6)
# acceleration riser
n = int((B["STOP"] - B["accel"]) * SR)
tt = np.arange(n) / SR
u = tt / tt[-1]
riser = sweep_tone(180 * (1 + 5 * u ** 2.2), 0) * u ** 2
riser += 0.6 * bp(noise(n), 800, 7000) * u ** 3
place(riser, B["accel"], 0.06, send=0.4)

# ------------------------------------------------------------------ 5. STOP. near silence.
# relay clack: the last sound before the silence
place(click(0.012, 1200, 1.0), B["STOP"], 0.5, send=0.0)
place(kick(70, 38, 0.6), B["STOP"], 0.4)
# a faint high tone in the silence
n = int(3.0 * SR)
tt = np.arange(n) / SR
x = np.sin(2 * np.pi * 2093 * tt) * np.clip(tt / 1.0, 0, 1) * np.clip((3 - tt) / 1.2, 0, 1)
place(x, B["STOP"] + 0.4, 0.004, send=0.8)
# status lines
for i, d in enumerate([0.0, 0.25, 0.65, 1.15]):
    place(tock(900 - i * 60, 0.08), B["status"] + d, 0.09, pan=-0.6, send=0.6)
# queue: ships stacking, fine granular ticks panned left (inside the Gulf)
qt = np.sort(B["queue0"] + (B["queue1"] - B["queue0"]) * rng.random(420) ** 1.2)
for q in qt:
    place(click(0.0025, 3500 + rng.random() * 2000), q, 0.04 + 0.04 * rng.random(), pan=rng.uniform(-0.9, 0.1), send=0.3)
place(pad([55, 65.4, 82.4], 4.6, attack=2.2, release=1.2, bright=260), B["queue0"] + 0.9, 0.16, send=0.2)
# BOTTLENECK: pressure — closing band, detuned low saws
dur = B["bn1"] - B["bn0"] + 0.1
n = int(dur * SR)
tt = np.arange(n) / SR
u = np.clip(tt / (dur - 0.3), 0, 1)
press = pad([41.2, 41.7, 61.7, 82.4], dur, attack=0.3, release=0.15, bright=500)
nz = noise(n)
band = np.zeros(n)
for i in range(0, n, 1024):
    uu = i / n
    fc = 2400 * (1 - uu) + 500
    seg = nz[max(0, i - 2048):i + 1024]
    y = bp(seg, fc * (1 - 0.5 * (1 - uu)), fc * (1 + 0.5 * (1 - uu)) + 10, 1)
    band[i:i + 1024] = y[-len(band[i:i + 1024]):]
press[:, 0] += band * 0.8 * u ** 1.5
press[:, 1] += band * 0.8 * u ** 1.5
press *= (0.3 + 0.7 * u ** 1.4)[:, None]
place(press, B["bn0"], 0.32, send=0.3)
place(kick(120, 45, 0.5), B["bn1"] - 0.3, 0.55)
place(click(0.02, 400), B["bn1"] - 0.3, 0.25)

# ------------------------------------------------------------------ 6. ripple: deep bass + rising complexity
# the price curve, sonified: pitch follows EIA Brent as the line draws
brent = json.load(open(os.path.join(HERE, "..", "data", "brent_eia.json")))
v = np.array([x for w in brent["weeks"] for x in w[1]])
d0, d1 = B["price0"] + 0.15, B["price0"] + 1.6
n = int((d1 - d0) * SR)
u = np.linspace(0, 1, n)
pv = np.interp(u * (len(v) - 1), np.arange(len(v)), v)
f = 220 * 2 ** ((pv - 60) / 18)
x = sweep_tone(f, 0) * np.clip(u / 0.08, 0, 1)
place(np.concatenate([x, x[-1] * 0 + x[-int(0.4 * SR):] * np.linspace(1, 0, int(0.4 * SR))]), d0, 0.05, pan=0.3, send=0.5)
# bass bed
n = int((DUR - B["price0"]) * SR)
tt = np.arange(n) / SR
bass = pad([55, 55.2, 110], DUR - B["price0"], attack=1.2, release=4.0, bright=220)
bass *= (np.clip(1 - (tt - (B["final0"] - B["price0"])) / 3.0, 0.25, 1))[:, None]
place(bass, B["price0"], 0.42, send=0.15)
# lathe: circular pan whoosh
ww = whoosh(B["lathe1"] - B["lathe0"] + 0.4, 200, 2400, -0.9, 0.9, 0.55)
place(ww, B["lathe0"], 0.18, send=0.5)
# pulses with growing polyrhythm (4 against 3 against 5)
for base, div, g, fr in [(B["ripple0"], 0.5, 0.25, None), (B["ripple0"] + 0.9, 0.5 * 4 / 3, 0.05, 2400), (B["ripple0"] + 1.8, 0.5 * 4 / 5, 0.035, 3600)]:
    tc = base
    while tc < B["final0"] - 0.1:
        if fr is None:
            place(kick(80, 44, 0.5), tc, g * 0.8)
        else:
            place(tock(fr, 0.03), tc, g, pan=rng.uniform(-0.7, 0.7), send=0.4)
        tc += div
# ripple rings: descending bell tones
for i, fr in enumerate([659.25, 493.9, 440.0, 329.6, 220.0]):
    place(bell(fr, 4.5, 0.9), B["ripple0"] + 0.3 + i * 0.42, 0.10, pan=(-0.5 + i * 0.25), send=0.9)
# cities: small high blips
for i, tc in enumerate([28.7, 29.2, 29.6, 30.2]):
    place(bell(1760 + 220 * i, 1.2, 0.5), tc, 0.025, pan=(-0.7 + 0.45 * i), send=0.8)

# ------------------------------------------------------------------ 7. final: simplify
place(pad([110, 164.8, 220, 246.9, 329.6], DUR - B["final0"], attack=2.0, release=3.2, bright=1300), B["final0"], 0.2, send=0.9)
place(sub_boom(41, 4.0), B["final0"], 0.28, send=0.2)
place(bell(1318.5, 3.5, 0.6), B["final0"] + 1.55, 0.06, pan=0.1, send=0.9)   # the lime full stop

# ------------------------------------------------------------------ reverb + master
ir_n = int(3.2 * SR)
it = np.arange(ir_n) / SR
ir = np.stack([rng.standard_normal(ir_n), rng.standard_normal(ir_n)], 1) * np.exp(-it / 0.75)[:, None]
ir = lp(ir, 5000)
ir[: int(0.012 * SR)] = 0
ir /= np.sqrt((ir ** 2).sum(0))
rev = np.stack([fftconvolve(wet[:, 0], ir[:, 0])[:N], fftconvolve(wet[:, 1], ir[:, 1])[:N]], 1)
mixed = dry + rev * 0.55
mixed = hp(mixed, 28)
# gentle bus compression via soft clip
mixed /= np.abs(mixed).max() + 1e-9
mixed = np.tanh(mixed * 1.4) / np.tanh(1.4)
fade = np.clip((DUR - t) / 0.6, 0, 1)
mixed *= fade[:, None]
mixed *= 10 ** (-1.0 / 20) / np.abs(mixed).max()
wavfile.write(os.path.join(HERE, "hormuz_score.wav"), SR, (mixed * (2 ** 31 - 1)).astype(np.int32))
print("ok", mixed.shape, "rms dB", 20 * np.log10(np.sqrt((mixed ** 2).mean())))
