#!/usr/bin/env bash
# Encode rendered frames + score to the delivery master (1920x1080, 30 fps, H.264 + AAC).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-out/HORMUZ_1080p30.mp4}
# measure the score and normalise to -16 LUFS integrated with a linear gain (dynamics preserved)
I=$(ffmpeg -hide_banner -nostats -i audio/hormuz_score.wav -af ebur128 -f null - 2>&1 | awk '/I:/{v=$2} END{print v}')
G=$(python3 -c "print(round(-16.0 - ($I), 2))")
echo "score integrated ${I} LUFS -> gain ${G} dB"
ffmpeg -y -hide_banner -loglevel error -nostats \
  -framerate 30 -i out/frames/f_%05d.png -i audio/hormuz_score.wav \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -profile:v high -level 4.2 \
  -x264-params "aq-mode=3:aq-strength=0.9:deblock=-1,-1" -tune film \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -af "volume=${G}dB,alimiter=limit=0.89:level=false" -c:a aac -b:a 320k -ar 48000 \
  -movflags +faststart -shortest "$OUT"
ffmpeg -hide_banner -i "$OUT" 2>&1 | grep -E "Duration|Stream" || true
