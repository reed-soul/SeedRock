#!/usr/bin/env bash
# Compose SeedRock promo video + platform GIFs from captured screenshots.
# Lightweight pipeline (single-pass, ultrafast) — completes in ~1 min.
#
# Inputs:  promo/shots/<name>.16x9.png, promo/shots/<name>.1x1.png
# Outputs: promo/video/seedrock-30s.mp4   — ~30s 1920x1080 H.264, Ken Burns
#          promo/social/*.gif             — platform teaser loops
#
# Run:  bash scripts/promo/build-video.sh   (requires ffmpeg)
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p promo/video promo/social
SHOTS=promo/shots
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
FPS=30

# Story arc: hero → species variety → style swap → bookend.
SCENES=(karst granite basalt sandstone crystal obsidian ice marble schist river_cobble style_pbr style_lowpoly style_toon karst)
DUR=(3.0 2.0 2.0 2.0 2.0 2.0 2.0 2.0 2.0 2.0 2.0 2.0 2.0 3.0)  # sums to 30s
N=${#SCENES[@]}

echo "Composing $N segments → ~30s promo (1920x1080, Ken Burns)"

CONCAT="$TMP/concat.txt"; : > "$CONCAT"
for ((i=0;i<N;i++)); do
  s=${SCENES[$i]}; d=${DUR[$i]}
  src="$SHOTS/$s.16x9.png"
  [ -f "$src" ] || { echo "missing $src"; exit 1; }
  clip="$TMP/seg-$(printf %02d $i).mp4"
  # zoompan d=1 (one out frame per in frame); output -t truncates to segment dur.
  ffmpeg -hide_banner -loglevel error -y \
    -loop 1 -i "$src" \
    -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,\
zoompan=z='min(zoom+0.0005,1.06)':d=1:s=1920x1080:fps=${FPS},format=yuv420p" \
    -t "$d" -c:v libx264 -preset ultrafast -crf 20 -pix_fmt yuv420p "$clip"
  echo "  [$i] $s  ${d}s"
  echo "file '${clip}'" >> "$CONCAT"
done

ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$CONCAT" -c copy promo/video/seedrock-30s.mp4
echo "✓ mp4 → promo/video/seedrock-30s.mp4"

# --- GIFs (downscaled, palette-optimized). ffmpeg 7.x palettegen has no maxlen. ---
echo "Building GIFs…"

# Twitter/Reddit teaser: 6s of hero only, 800px, 10fps → small & fast to encode.
ffmpeg -hide_banner -loglevel error -y -i promo/video/seedrock-30s.mp4 \
  -t 6 -vf "fps=10,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5" \
  promo/social/seedrock-twitter.gif

# Square (IG / 小红书): 8 species, 1:1, 3s each.
SQ="$TMP/sq.txt"; : > "$SQ"
SQ_COUNT=0
LAST=""
for s in granite basalt crystal obsidian ice marble schist karst; do
  [ -f "$SHOTS/$s.1x1.png" ] || continue
  SQ_COUNT=$((SQ_COUNT + 1))
  echo "file '$PWD/$SHOTS/$s.1x1.png'" >> "$SQ"
  echo "duration 3" >> "$SQ"
  LAST="$PWD/$SHOTS/$s.1x1.png"
done
if [ "$SQ_COUNT" -eq 0 ]; then
  echo "error: no 1x1 shots found in $SHOTS (needed for square GIF)" >&2
  exit 1
fi
# concat demuxer requires a trailing duration-less entry
echo "file '$LAST'" >> "$SQ"
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$SQ" \
  -vf "scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,format=yuv420p" \
  -c:v libx264 -preset ultrafast -crf 20 -pix_fmt yuv420p -r 30 "$TMP/sq.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$TMP/sq.mp4" \
  -vf "fps=8,scale=900:900:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5" \
  -loop 0 promo/social/seedrock-square.gif

# Style-swap teaser (tweet reply sized) — 3 styles, 2s each.
ST="$TMP/st.txt"; : > "$ST"
LAST=""
for s in style_pbr style_lowpoly style_toon; do
  echo "file '$PWD/$SHOTS/$s.16x9.png'" >> "$ST"
  echo "duration 2" >> "$ST"
  LAST="$PWD/$SHOTS/$s.16x9.png"
done
echo "file '$LAST'" >> "$ST"
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$ST" \
  -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,format=yuv420p" \
  -c:v libx264 -preset ultrafast -crf 20 -pix_fmt yuv420p -r 30 "$TMP/st.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$TMP/st.mp4" \
  -vf "fps=8,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5" \
  -loop 0 promo/social/seedrock-styles.gif

echo ""
echo "=== Outputs ==="
ls -lh promo/video/*.mp4 promo/social/*.gif
echo ""
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 promo/video/seedrock-30s.mp4)
echo "mp4 duration: ${dur}s"
