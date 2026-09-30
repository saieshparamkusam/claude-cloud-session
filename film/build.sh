#!/usr/bin/env bash
# Full pipeline: frames (headless Chromium) → sound design (numpy/scipy) → final mux.
# Requires: node + playwright (global), python3 with numpy scipy imageio-ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"
BUILD=${BUILD:-build}
OUT=${OUT:-../out/portugal-wales-attention-study.mp4}
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
node render.mjs "$BUILD" "${WORKERS:-4}"
python3 audio.py "$BUILD/sfx.json" "$BUILD/audio.wav"
mkdir -p "$(dirname "$OUT")"
"$FF" -loglevel error -y -f concat -safe 0 -i "$BUILD/segments.txt" -i "$BUILD/audio.wav" \
  -vf "noise=c0s=5:c0f=t+u,format=yuv420p" -c:v libx264 -preset slow -crf 17 -profile:v high -tune film -r 60 \
  -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart "$OUT"
echo "wrote $OUT"
