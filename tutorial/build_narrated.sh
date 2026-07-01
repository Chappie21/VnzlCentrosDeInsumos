#!/usr/bin/env bash
# Monta tutorial_narrado.mp4: cada slide dura lo que su narracion + pad,
# con el audio TTS sincronizado. Requiere synth_audio.py corrido antes (adur en manifest).
set -euo pipefail
cd "$(dirname "$0")"

FRAMES=slides/frames
AUDIO=slides/audio
SEG=slides/seg
OUT=tutorial_narrado.mp4
PAD=0.7   # segundos de silencio tras cada narracion
mkdir -p "$FRAMES" "$SEG"

command -v convert >/dev/null || { echo "falta ImageMagick"; exit 1; }
command -v ffmpeg  >/dev/null || { echo "falta ffmpeg"; exit 1; }
python3 -c "import json;m=json.load(open('slides/manifest.json'));assert all('adur' in x for x in m)" \
  || { echo "Falta 'adur' en manifest -> corré synth_audio.py primero"; exit 1; }

# 1) cortar frames desde los chunks (idempotente)
echo "Cortando frames..."
python3 - "$FRAMES" <<'PY'
import json, subprocess, sys, os
frames = sys.argv[1]
for m in json.load(open("slides/manifest.json")):
    subprocess.run(["convert", f"slides/chunk_{m['chunk']}.png",
        "-crop", f"1920x1080+0+{m['row']*1080}", "+repage",
        os.path.join(frames, m["png"])], check=True)
print("frames ok")
PY

# 2) un segmento mp4 por slide (frame fijo + audio TTS + cola de silencio)
echo "Renderizando segmentos..."
python3 - "$FRAMES" "$AUDIO" "$SEG" "$PAD" <<'PY'
import json, subprocess, sys, os
frames, audio, seg, pad = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
man = json.load(open("slides/manifest.json"))
listf = open(os.path.join(seg, "list.txt"), "w")
for m in man:
    dur = round(m["adur"] + pad, 3)
    png = os.path.join(frames, m["png"])
    mp3 = os.path.join(audio, f"{m['band']:02d}.mp3")
    out = os.path.join(seg, f"{m['band']:02d}.mp4")
    subprocess.run([
        "ffmpeg","-y","-loop","1","-i",png,"-i",mp3,
        "-af","apad",                      # silencio al final
        "-t",str(dur),
        "-r","30","-pix_fmt","yuv420p","-c:v","libx264","-crf","20",
        "-c:a","aac","-b:a","128k","-ar","44100","-shortest","-movflags","+faststart",
        out], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    listf.write(f"file '{m['band']:02d}.mp4'\n")
listf.close()
print(f"{len(man)} segmentos")
PY

# 3) concatenar segmentos (mismos params -> stream copy)
echo "Concatenando -> $OUT"
ffmpeg -y -f concat -safe 0 -i "$SEG/list.txt" -c copy -movflags +faststart "$OUT" \
  2>/dev/null || \
ffmpeg -y -f concat -safe 0 -i "$SEG/list.txt" -c:v libx264 -crf 20 -c:a aac "$OUT"

echo "Listo: $OUT"
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height \
  -of default=noprint_wrappers=1 "$OUT"
