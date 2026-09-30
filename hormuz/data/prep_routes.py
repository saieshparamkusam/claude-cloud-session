"""Stylised shipping-route network (illustrative geometry, not AIS data).

Routes are drawn port -> Gulf corridor -> Strait traffic-separation scheme ->
Gulf of Oman -> onward branch. Each route is checked against Natural Earth
10m land so no line crosses a coast. Output: data/routes.json (AEQD km).
"""
import json
import os
import numpy as np
from shapely.geometry import shape, box, LineString
from shapely.ops import unary_union
from geo_common import aeqd, RAW

HERE = os.path.dirname(os.path.abspath(__file__))

# Gulf trunk, NW -> SE (lon, lat)
TRUNK = [(48.85, 29.55), (49.35, 29.05), (49.95, 28.55), (50.55, 27.95), (51.2, 27.35),
         (52.0, 26.85), (52.9, 26.45), (53.8, 26.15), (54.6, 26.05), (55.25, 26.1),
         (55.6, 26.22), (55.97, 26.4), (56.25, 26.53), (56.55, 26.55), (56.72, 26.38),
         (56.79, 26.12), (56.87, 25.82), (57.1, 25.45), (57.8, 25.05), (58.8, 24.35),
         (59.7, 23.35), (60.3, 22.6)]
STRAIT_IDX = 12  # index of trunk vertex nearest the narrows

# spurs from ports: list of waypoints ending ON a trunk vertex index
PORTS = {
    "Basrah": ([(48.83, 29.68)], 0),
    "Kuwait": ([(48.25, 29.05), (48.8, 28.95)], 1),
    "Kharg": ([(50.28, 29.2), (50.15, 28.85)], 2),
    "Ras Tanura": ([(50.2, 26.7), (50.65, 26.95)], 4),
    "Juaymah": ([(50.12, 26.9), (50.6, 27.25)], 4),
    "Bahrain": ([(50.72, 26.22), (51.1, 26.55), (51.5, 26.95)], 5),
    "Ras Laffan": ([(51.62, 25.95), (51.95, 26.3), (52.4, 26.6)], 6),
    "Mesaieed": ([(51.62, 24.95), (51.95, 25.25), (52.45, 25.7), (53.1, 26.1)], 7),
    "Das Island": ([(52.88, 25.18), (53.25, 25.6), (53.9, 25.9)], 8),
    "Ruwais": ([(52.72, 24.2), (53.1, 24.7), (54.0, 25.35), (54.6, 25.8)], 8),
    "Jebel Ali": ([(55.0, 25.05), (55.15, 25.45), (55.35, 25.85)], 10),
    "Bandar Abbas": ([(56.3, 27.1), (56.3, 26.93), (56.29, 26.74)], 13),
}

# onward branches from the trunk end
BRANCHES = {
    "Asia": [(61.5, 22.2), (64.0, 21.3), (67.5, 20.2)],
    "India": [(61.3, 21.7), (63.5, 20.2), (66.5, 18.6)],
    "Red Sea": [(59.6, 21.0), (58.2, 18.8), (56.0, 16.0), (53.0, 14.0), (49.0, 12.6)],
    "Cape": [(60.0, 20.6), (59.2, 17.5), (58.0, 13.5), (56.8, 9.0)],
}

feat = [shape(f["geometry"]) for f in json.load(open(os.path.join(RAW, "ne_10m_land.geojson")))["features"]]
isl = [shape(f["geometry"]) for f in json.load(open(os.path.join(RAW, "ne_10m_minor_islands.geojson")))["features"]]
BB = box(40, 5, 70, 33)
LAND = unary_union([g for g in feat + isl if g.intersects(BB)])


def catmull(pts, n=10):
    pts = np.asarray(pts, float)
    P = np.vstack([pts[0], pts, pts[-1]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2])
    return np.asarray(out)


routes = []
bad = []
for pname, (spur, j) in PORTS.items():
    for bname, br in BRANCHES.items():
        ll = list(spur) + TRUNK[j:] + br
        line = catmull(ll, 12)
        ls = LineString(line)
        inter = ls.intersection(LAND)
        if not inter.is_empty and inter.length > 0.02:
            bad.append((pname, bname, round(inter.length, 3)))
        x, y = aeqd(line[:, 0], line[:, 1])
        routes.append({"from": pname, "to": bname,
                       "x": [round(float(v), 2) for v in x],
                       "y": [round(float(v), 2) for v in y]})

tl = catmull(TRUNK, 12)
tx, ty = aeqd(tl[:, 0], tl[:, 1])
json.dump({"routes": routes, "trunk": {"x": [round(float(v), 2) for v in tx],
                                       "y": [round(float(v), 2) for v in ty]}},
          open(os.path.join(HERE, "routes.json"), "w"), separators=(",", ":"))
print("routes", len(routes))
print("land crossings:", bad if bad else "none")
