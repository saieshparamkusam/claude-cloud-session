#!/usr/bin/env bash
# Download Natural Earth layers used by prep_geo.py (terrain tiles are fetched by the script itself).
set -e; cd "$(dirname "$0")"; mkdir -p raw
for f in ne_10m_land ne_10m_minor_islands ne_50m_land ne_110m_land ne_10m_admin_0_boundary_lines_land ne_50m_admin_0_boundary_lines_land; do
  curl -sSL -o raw/$f.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/$f.geojson
done
