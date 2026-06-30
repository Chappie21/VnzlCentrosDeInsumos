#!/usr/bin/env bash
# Monta tutorial_redes.mp4 (vertical 1080x1920) con narración sincronizada.
# Reusa el audio TTS de slides/audio (mismo por banda). Requiere gen_vertical.py + chunks renderizados.
set -euo pipefail
cd "$(dirname "$0")"

DIR=slides_v
FRAMES=$DIR/frames
AUDIO=slides/audio
SEG=$DIR/seg
OUT=tutorial_redes.mp4
PAD=0.7
mkdir -p "$FRAMES" "$SEG"

command -v convert >/dev/null || { echo "falta ImageMagick"; exit 1; }
command -v ffmpeg  >/dev/null || { echo "falta ffmpeg"; exit 1; }
python3 -c "import json;m=json.load(open('$DIR/manifest.json'));assert all('adur' in x for x in m)" \
  || { echo "Falta adur en $DIR/manifest.json"; exit 1; }

echo "Cortando frames verticales..."
python3 - "$DIR" "$FRAMES" <<'PY'
import json, subprocess, sys, os
d, frames = sys.argv[1], sys.argv[2]
for m in json.load(open(f"{d}/manifest.json")):
    subprocess.run(["convert", f"{d}/chunk_{m['chunk']}.png",
        "-crop", f"1080x1920+0+{m['row']*1920}", "+repage",
        os.path.join(frames, m["png"])], check=True)
print("frames ok")
PY

echo "Renderizando segmentos..."
python3 - "$FRAMES" "$AUDIO" "$SEG" "$PAD" "$DIR" <<'PY'
import json, subprocess, sys, os
frames, audio, seg, pad, d = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), sys.argv[5]
man = json.load(open(f"{d}/manifest.json"))
listf = open(os.path.join(seg, "list.txt"), "w")
for m in man:
    dur = round(m["adur"] + pad, 3)
    subprocess.run([
        "ffmpeg","-y","-loop","1","-i",os.path.join(frames, m["png"]),
        "-i",os.path.join(audio, f"{m['band']:02d}.mp3"),
        "-af","apad","-t",str(dur),
        "-r","30","-pix_fmt","yuv420p","-c:v","libx264","-crf","20",
        "-c:a","aac","-b:a","128k","-ar","44100","-shortest","-movflags","+faststart",
        os.path.join(seg, f"{m['band']:02d}.mp4")], check=True,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    listf.write(f"file '{m['band']:02d}.mp4'\n")
listf.close()
print(f"{len(man)} segmentos")
PY

echo "Concatenando -> $OUT"
ffmpeg -y -f concat -safe 0 -i "$SEG/list.txt" -c copy -movflags +faststart "$OUT" 2>/dev/null || \
ffmpeg -y -f concat -safe 0 -i "$SEG/list.txt" -c:v libx264 -crf 20 -c:a aac "$OUT"

echo "Listo: $OUT"
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height \
  -of default=noprint_wrappers=1 "$OUT"
