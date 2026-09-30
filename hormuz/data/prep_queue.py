"""Lattice of 2,000 water points inside the Persian Gulf, ordered by distance
from the Strait. Used for the 'ships held in the Gulf' unit chart
(IMO / UN News, Mar 2026: ~2,000 ships, ~20,000 seafarers)."""
import json, os
import numpy as np
from shapely.geometry import shape, box, Point
from shapely.ops import unary_union
from shapely.prepared import prep
from geo_common import aeqd, RAW

HERE = os.path.dirname(os.path.abspath(__file__))
feat = [shape(f["geometry"]) for f in json.load(open(os.path.join(RAW, "ne_10m_land.geojson")))["features"]]
isl = [shape(f["geometry"]) for f in json.load(open(os.path.join(RAW, "ne_10m_minor_islands.geojson")))["features"]]
L = unary_union([g for g in feat + isl if g.intersects(box(46, 23, 58, 31))])
Lb = prep(L.buffer(0.07))
# inside the Gulf only: west of the narrows
gulf = box(47.5, 23.8, 56.25, 30.2)
pts = []
step = 0.085
for lat in np.arange(24.0, 30.1, step):
    off = (int(round((lat - 24) / step)) % 2) * step / 2
    for lon in np.arange(47.8 + off, 56.25, step):
        if Lb.contains(Point(lon, lat)):
            continue
        pts.append((lon, lat))
pts = np.array(pts)
x, y = aeqd(pts[:, 0], pts[:, 1])
# path distance proxy: distance to the narrows along the Gulf axis
d = np.hypot(x + 20, y + 5)
o = np.argsort(d)[:2000]
print("available", len(pts), "used", len(o), "max d", d[o].max())
json.dump({"x": [round(float(v), 2) for v in x[o]], "y": [round(float(v), 2) for v in y[o]]},
          open(os.path.join(HERE, "queue.json"), "w"), separators=(",", ":"))
