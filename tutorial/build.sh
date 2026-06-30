#!/usr/bin/env bash
# Monta tutorial.mp4 desde slides/combined.png (1920 x N*1080) + manifest.json.
# Requiere: ImageMagick (convert) para cortar, ffmpeg para el video.
set -euo pipefail
cd "$(dirname "$0")"

FRAMES=slides/frames
OUT=tutorial.mp4
mkdir -p "$FRAMES"

command -v convert >/dev/null || { echo "falta ImageMagick (convert)"; exit 1; }
command -v ffmpeg  >/dev/null || { echo "falta ffmpeg"; exit 1; }

# 1) cortar cada slide (banda de 1080px) desde su chunk PNG
#    (chunks porque ImageMagick limita la altura de un solo PNG)
echo "Cortando frames..."
python3 - "$FRAMES" <<'PY'
import json, subprocess, sys, os
frames = sys.argv[1]
man = json.load(open("slides/manifest.json"))
for m in man:
    y = m["row"]*1080
    src = f"slides/chunk_{m['chunk']}.png"
    out = os.path.join(frames, m["png"])
    subprocess.run(["convert", src, "-crop", f"1920x1080+0+{y}", "+repage", out], check=True)
print(f"{len(man)} frames")
PY

# 2) lista para el concat demuxer (cada frame con su duración)
python3 - <<'PY'
import json
man = json.load(open("slides/manifest.json"))
with open("slides/concat.txt","w") as f:
    for m in man:
        f.write(f"file 'frames/{m['png']}'\n")
        f.write(f"duration {m['dur']}\n")
    # repetir el último frame (el concat demuxer ignora la duración del último)
    f.write(f"file 'frames/{man[-1]['png']}'\n")
print("concat.txt listo")
PY

# 3) render H.264 con fade entre slides via fps; xfade omitido por simplicidad
echo "Renderizando $OUT..."
ffmpeg -y -f concat -safe 0 -i slides/concat.txt \
  -fps_mode vfr -pix_fmt yuv420p -c:v libx264 -crf 20 \
  -movflags +faststart "$OUT"

echo "Listo: $OUT"
ffprobe -v error -show_entries format=duration:stream=width,height,codec_name \
  -of default=noprint_wrappers=1 "$OUT"
