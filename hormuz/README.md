# HORMUZ — a motion-design film

A 36.5 s, 1920×1080, 30 fps motion-graphics film about why the Strait of Hormuz is a pressure point
in the 2026 U.S.–Iran conflict, and why its disruption reaches the world economy.

**Deliverable:** `out/HORMUZ_1080p30.mp4` (H.264 High, AAC 320 kbps, −16 LUFS).
**Facts and sources:** [`SOURCES.md`](SOURCES.md). Every on-screen number is cited there.

## The idea

The protagonist is the strait. The whole film is one continuous visual system in a single coordinate
space: an **azimuthal-equidistant projection centred on the narrows**. In this projection every great
circle through Hormuz is a straight line and every distance ring is a true circle. So the camera can
travel without a cut from a 7 km view of the shipping lanes to the whole planet. The final "thousands
of miles away" is a literal radius on the map.

Transformation chain (object → transformation → new object):
lane geometry → ship tracks → converging flow → counting gate → the extruded **20%** monolith with oil
flowing through its glyphs → **STOP** (flow freezes; lime accent drains to stone; filled points become
hollow) → 2,000-circle unit chart of ships held in the Gulf → **BOTTLENECK** crushed by two walls into a
single line → that line becomes the axis of the real EIA Brent curve → the curve is lathed into a 3D
crown around the strait → the crown releases ripple rings (oil supply → energy prices → shipping →
industry → global economy) → the world, with the strait as one lime point, echoed by the lime full stop
of the final line.

## Pipeline

| Stage | Tool | File |
|---|---|---|
| Research | EIA, IEA, CRS, IMO/UN, Reuters | `SOURCES.md` |
| Geography | Natural Earth + AWS terrain tiles → contours (contourpy), DEM-derived coastline for close-ups | `data/prep_geo.py` |
| Routes / queue lattice | shapely, land-checked | `data/prep_routes.py`, `data/prep_queue.py` |
| Type | Mona Sans variable → static width/weight instances (fontTools) + Geist Mono | `fonts/make_instances.py` |
| Rendering | Custom perspective camera + vector engine on Canvas2D in headless Chromium (2× supersampled, bloom, grain), deterministic per frame | `src/engine.js`, `src/film.js`, `render/render.js` |
| Sound | Fully procedural synthesis (numpy/scipy), same beat sheet as the picture; the Brent curve is sonified | `audio/sound.py` |
| Encode | ffmpeg / libx264 | `render/encode.sh` |

## Rebuild

```bash
pip install numpy scipy pillow shapely contourpy fonttools imageio-ffmpeg
python3 fonts/make_instances.py
(cd data && ./fetch_raw.sh && python3 prep_geo.py && python3 prep_routes.py && python3 prep_queue.py)
python3 audio/sound.py
node render/render.js frames 4          # -> out/frames
./render/encode.sh                      # -> out/HORMUZ_1080p30.mp4
node render/render.js stills 12,26.4    # single frames for review
```
