# HORMUZ — a motion-design film

**Deliverable:** `HORMUZ_1080p30.mp4` (1920×1080, 30 fps, 37 s, H.264 High + AAC 320 kbps stereo)

The film is about one idea: a very narrow passage carries a very large share of the world's energy. It moves from one line on a dark field, to the geography of the Strait, to real energy flows, to the stop, and then outward to the global consequences. It is one continuous camera move and one visual system. The lane turns into flows, the flows turn into the 20% figure, the stopped ships stack into a 1,600-vessel wall, the wall flattens into the Brent price curve, the curve closes into a ring, and the ring spreads across the world.

## Pipeline (everything is procedural; no footage, stock or samples)
| Stage | Tool | File |
|---|---|---|
| Elevation and bathymetry (3 levels of detail, real data) | Python: Terrarium tiles → equirectangular grids, plus a smoothed coast channel | `data/fetch_tiles.py`, `data/prep.py` |
| 3D terrain, contour lines, isobaths, coast, fog | WebGL2 shaders in headless Chromium (displaced mesh, contour lines anti-aliased with fwidth) | `main.js` (VS/FS) |
| Ships, lanes, typography, data | Canvas 2D, using the same camera matrices as the 3D terrain | `main.js` |
| Frame capture | Playwright, deterministic `renderFrame(n)` | `render.js` |
| Sound design | numpy/scipy synthesis (sub drones, pulses, data clicks, mechanical textures, risers, the Brent curve turned into pitch, ring pulses, pad, convolution reverb) | `audio.py` |
| Encode | ffmpeg (x264 + AAC) | see below |

## Rebuild
```bash
pip install numpy scipy pillow imageio-ffmpeg && npm i playwright
python3 data/fetch_tiles.py && python3 data/prep.py
node render.js frames 0 1110 frames        # or: node render.js stills 0,300,600 stills
python3 audio.py
ffmpeg -framerate 30 -i frames/f%04d.png -i audio/score.wav -c:v libx264 -preset slow -crf 17 \
  -pix_fmt yuv420p -tune grain -c:a aac -b:a 320k -af volume=-1dB -movflags +faststart HORMUZ_1080p30.mp4
```

Every on-screen fact is listed with its source in `SOURCES.md`.
