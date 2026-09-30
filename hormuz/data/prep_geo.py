"""Geographic data prep for the Hormuz film.

Everything is projected into one azimuthal-equidistant (AEQD) plane centred on
the narrowest point of the Strait of Hormuz, in kilometres. In that projection
every great circle through the Strait is a straight line and every distance
ring around it is a true circle, which is what lets the film zoom from ~10 km
to the whole planet inside a single coordinate system.

Outputs data/geo.json (consumed by src/film.js).
"""
import io
import json
import math
import os
import urllib.request

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
from shapely.geometry import shape, box, Polygon, MultiPolygon, LineString
from shapely.ops import unary_union
import contourpy

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
TILES = os.path.join(RAW, "tiles")
os.makedirs(TILES, exist_ok=True)

R = 6371.0088
LON0, LAT0 = 56.35, 26.55  # narrowest point of the strait (approx.)


def aeqd(lon, lat):
    lon = np.radians(np.asarray(lon, dtype=float))
    lat = np.radians(np.asarray(lat, dtype=float))
    l0, p0 = math.radians(LON0), math.radians(LAT0)
    cosc = np.sin(p0) * np.sin(lat) + np.cos(p0) * np.cos(lat) * np.cos(lon - l0)
    cosc = np.clip(cosc, -1, 1)
    c = np.arccos(cosc)
    k = np.where(c < 1e-9, 1.0, c / np.maximum(np.sin(c), 1e-9))
    x = R * k * np.cos(lat) * np.sin(lon - l0)
    y = R * k * (np.cos(p0) * np.sin(lat) - np.sin(p0) * np.cos(lat) * np.cos(lon - l0))
    return x, y


def load(name):
    with open(os.path.join(RAW, name + ".geojson")) as f:
        return json.load(f)


def polys_of(geom):
    if geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    out = []
    for g in getattr(geom, "geoms", []):
        out += polys_of(g)
    return out


def rnd(a, d=2):
    return [round(float(v), d) for v in a]


# ---------------------------------------------------------------- land
REGION = box(43.0, 15.0, 67.0, 33.5)  # hi-res (10m) window

land10 = unary_union([shape(f["geometry"]) for f in load("ne_10m_land")["features"]
                      if shape(f["geometry"]).intersects(REGION)])
isl10 = unary_union([shape(f["geometry"]) for f in load("ne_10m_minor_islands")["features"]
                     if shape(f["geometry"]).intersects(REGION)])
region_land = unary_union([land10, isl10]).intersection(REGION)

world50 = [shape(f["geometry"]) for f in load("ne_50m_land")["features"]]


def ring_out(coords, seam_box=None, dens=None):
    """Project a ring; flag edges that are artificial (seams) so they are not stroked."""
    coords = np.asarray(coords)
    lon, lat = coords[:, 0], coords[:, 1]
    if dens:
        # densify long edges so the projection bends them correctly
        L, P = [lon[0]], [lat[0]]
        for i in range(1, len(lon)):
            dx, dy = lon[i] - lon[i - 1], lat[i] - lat[i - 1]
            n = int(max(abs(dx), abs(dy)) / dens)
            for k in range(1, n + 1):
                L.append(lon[i - 1] + dx * k / (n + 1))
                P.append(lat[i - 1] + dy * k / (n + 1))
            L.append(lon[i]); P.append(lat[i])
        lon, lat = np.array(L), np.array(P)
    x, y = aeqd(lon, lat)
    seam = []
    for i in range(len(lon) - 1):
        a = (lon[i], lat[i]); b = (lon[i + 1], lat[i + 1])
        s = False
        if abs(a[0]) >= 179.999 and abs(b[0]) >= 179.999:
            s = True
        if a[1] <= -89.9 or b[1] <= -89.9:
            s = True
        if seam_box is not None:
            boxes = seam_box if isinstance(seam_box[0], (tuple, list)) else [seam_box]
            for (x0, y0, x1, y1) in boxes:
                def onb(p):
                    return (abs(p[0] - x0) < 1e-6 or abs(p[0] - x1) < 1e-6 or
                            abs(p[1] - y0) < 1e-6 or abs(p[1] - y1) < 1e-6)
                if onb(a) and onb(b):
                    s = True
        seam.append(1 if s else 0)
    return {"x": rnd(x, 2), "y": rnd(y, 2), "s": seam}


WIN = box(54.6, 24.8, 58.4, 28.2)   # hi-res coastline window around the strait
SEAMS = [REGION.bounds, WIN.bounds]


def pack(geom, simp, min_area):
    out = []
    for p in polys_of(geom.simplify(simp, preserve_topology=True)):
        if p.area < min_area:
            continue
        out.append({"outer": ring_out(p.exterior.coords, SEAMS),
                    "holes": [ring_out(h.coords, SEAMS) for h in p.interiors]})
    return out


wx0, wy0, wx1, wy1 = WIN.bounds
rx0, ry0, rx1, ry1 = REGION.bounds
strips = [box(rx0, ry0, wx0, ry1), box(wx1, ry0, rx1, ry1), box(wx0, ry0, wx1, wy0), box(wx0, wy1, wx1, ry1)]
land_hi = []
for sb in strips:
    land_hi += pack(region_land.intersection(sb), 0.004, 2e-5)
SEAMS.extend(sb.bounds for sb in strips)
land_hi_in = pack(region_land.intersection(WIN), 0.004, 2e-5)

land_lo = []
for g in world50:
    g2 = g.difference(REGION)
    for p in polys_of(g2.simplify(0.05, preserve_topology=True)):
        if p.area < 0.02:
            continue
        land_lo.append({"outer": ring_out(p.exterior.coords, REGION.bounds, dens=1.0),
                        "holes": [ring_out(h.coords, REGION.bounds, dens=1.0) for h in p.interiors]})

# country borders (subtle dotted)
borders = []
for f in load("ne_10m_admin_0_boundary_lines_land")["features"]:
    g = shape(f["geometry"])
    if not g.intersects(REGION):
        continue
    g = g.intersection(REGION)
    lines = [g] if isinstance(g, LineString) else list(getattr(g, "geoms", []))
    for ln in lines:
        if ln.length < 0.2:
            continue
        c = np.asarray(ln.simplify(0.01).coords)
        x, y = aeqd(c[:, 0], c[:, 1])
        borders.append({"x": rnd(x), "y": rnd(y)})

# ---------------------------------------------------------------- terrain


def tile_xy(lon, lat, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def fetch_tile(z, x, y):
    p = os.path.join(TILES, f"{z}_{x}_{y}.png")
    if not os.path.exists(p):
        url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
        with urllib.request.urlopen(url, timeout=60) as r:
            open(p, "wb").write(r.read())
    im = np.asarray(Image.open(p).convert("RGB")).astype(np.float64)
    return im[:, :, 0] * 256 + im[:, :, 1] + im[:, :, 2] / 256 - 32768


def dem(lon0, lat0, lon1, lat1, z):
    tx0, ty0 = tile_xy(lon0, lat1, z)
    tx1, ty1 = tile_xy(lon1, lat0, z)
    X0, Y0, X1, Y1 = int(tx0), int(ty0), int(tx1), int(ty1)
    rows = []
    for ty in range(Y0, Y1 + 1):
        rows.append(np.hstack([fetch_tile(z, tx, ty) for tx in range(X0, X1 + 1)]))
    E = np.vstack(rows)
    n = 2 ** z
    h, w = E.shape
    px = X0 + (np.arange(w) + 0.5) / 256
    py = Y0 + (np.arange(h) + 0.5) / 256
    lons = px / n * 360 - 180
    lats = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * py / n))))
    return E, lons, lats


def contours(E, lons, lats, levels, sigma, simp_km, min_len_km):
    Es = gaussian_filter(E, sigma)
    gen = contourpy.contour_generator(z=Es)
    out = []
    for lv in levels:
        for seg in gen.lines(lv):
            if len(seg) < 4:
                continue
            ci, ri = seg[:, 0], seg[:, 1]
            lon = np.interp(ci, np.arange(len(lons)), lons)
            lat = np.interp(ri, np.arange(len(lats)), lats)
            x, y = aeqd(lon, lat)
            ls = LineString(np.c_[x, y]).simplify(simp_km)
            if ls.length < min_len_km:
                continue
            c = np.asarray(ls.coords)
            out.append({"e": float(lv), "x": rnd(c[:, 0], 2), "y": rnd(c[:, 1], 2)})
    return out


print("coast DEM ...")
Ec, lonc, latc = dem(WIN.bounds[0], WIN.bounds[1], WIN.bounds[2], WIN.bounds[3], 10)
Ecs = gaussian_filter(Ec, 1.2)
genc = contourpy.contour_generator(z=Ecs, fill_type="OuterOffset")
polys, offs = genc.filled(0.0, 1e6)
dem_land = []
for pts, off in zip(polys, offs):
    rings = []
    for a, b in zip(off[:-1], off[1:]):
        r = pts[a:b]
        lon = np.interp(r[:, 0], np.arange(len(lonc)), lonc)
        lat = np.interp(r[:, 1], np.arange(len(latc)), latc)
        rings.append(np.c_[lon, lat])
    if len(rings[0]) < 4:
        continue
    pg = Polygon(rings[0], [h for h in rings[1:] if len(h) >= 4]).buffer(0)
    dem_land.append(pg)
dem_land = unary_union(dem_land).intersection(WIN)
land_strait = pack(dem_land, 0.0012, 1.5e-6)
print("landStrait", len(land_strait), sum(len(p["outer"]["x"]) for p in land_strait))

print("regional DEM ...")
E, lons, lats = dem(46.5, 21.0, 62.5, 31.5, 7)
land_levels = list(range(250, 4001, 250))
sea_levels = [-30, -60, -90, -200, -1000, -2000, -3000]
topo_region = contours(E, lons, lats, land_levels + sea_levels, 1.3, 0.6, 8)

print("strait DEM ...")
E2, lons2, lats2 = dem(55.7, 25.7, 57.1, 27.2, 10)
topo_strait = contours(E2, lons2, lats2, list(range(100, 2101, 100)) + [-25, -50, -75, -100, -150, -200],
                       2.0, 0.08, 1.5)

print("world DEM ...")
E3, lons3, lats3 = dem(-179.9, -80, 179.9, 80, 3)
topo_world = contours(E3, lons3, lats3, [1000, 2000, 3000, 4000], 1.2, 15, 200)
# drop contours far on the other side of the planet (AEQD edge distortion)
topo_world = [c for c in topo_world
              if max(math.hypot(a, b) for a, b in zip(c["x"], c["y"])) < 15000]

geo = {
    "center": [LON0, LAT0],
    "landHi": land_hi,
    "landHiIn": land_hi_in,
    "landStrait": land_strait,
    "landLo": land_lo,
    "borders": borders,
    "topoRegion": topo_region,
    "topoStrait": topo_strait,
    "topoWorld": topo_world,
}
with open(os.path.join(HERE, "geo.json"), "w") as f:
    json.dump(geo, f, separators=(",", ":"))
print("landHi", len(land_hi), "landLo", len(land_lo), "borders", len(borders))
print("topoRegion", len(topo_region), sum(len(c["x"]) for c in topo_region))
print("topoStrait", len(topo_strait), sum(len(c["x"]) for c in topo_strait))
print("topoWorld", len(topo_world), sum(len(c["x"]) for c in topo_world))
print("size MB", os.path.getsize(os.path.join(HERE, "geo.json")) / 1e6)
