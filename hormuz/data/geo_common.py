import math
import os
import numpy as np

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")
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


