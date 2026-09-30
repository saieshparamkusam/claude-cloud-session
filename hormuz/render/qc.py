"""QC helpers: contact sheets from the encoded video + temporal-discontinuity scan."""
import subprocess, sys, os, numpy as np
from PIL import Image
video = sys.argv[1]
outdir = sys.argv[2] if len(sys.argv) > 2 else '/tmp/qc'
os.makedirs(outdir, exist_ok=True)
W, H = 480, 270
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vf', f'scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                     capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32)
print('frames', len(fr))
d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2, 3))
med = np.median(d)
for i in np.argsort(d)[::-1][:12]:
    print(f'jump f{i+1:4d} t={(i+1)/30:6.2f}s diff={d[i]:.2f} (median {med:.2f})')
lum = fr.mean(axis=(1, 2, 3))
print('mean luma per second:', ' '.join(f'{lum[i*30:(i+1)*30].mean():.0f}' for i in range(len(fr)//30)))
# sheets: every 0.5 s, 6 columns
idx = list(range(0, len(fr), 15))
cols = 6
for s in range(0, len(idx), 36):
    chunk = idx[s:s+36]
    rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * W, rows * H))
    for k, i in enumerate(chunk):
        sheet.paste(Image.fromarray(fr[i].astype(np.uint8)), ((k % cols) * W, (k // cols) * H))
    sheet.save(f'{outdir}/sheet_{s//36}.png')
print('sheets in', outdir)
