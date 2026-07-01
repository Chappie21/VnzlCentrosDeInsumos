#!/usr/bin/env python3
# Sintetiza narracion por slide con ElevenLabs y mide duracion de cada clip.
# Lee tutorial/.eleven.key (API key) y, opcional, tutorial/.eleven.voice (voice_id).
# Escribe slides/audio/NN.mp3 y agrega "adur" (seg) a slides/manifest.json.
import os, json, sys, subprocess, urllib.request, urllib.error

BASE = os.path.dirname(os.path.abspath(__file__))
AUDIO = os.path.join(BASE, "slides", "audio")
os.makedirs(AUDIO, exist_ok=True)
MANI = os.path.join(BASE, "slides", "manifest.json")

key = open(os.path.join(BASE, ".eleven.key")).read().strip()
vfile = os.path.join(BASE, ".eleven.voice")
MODEL = "eleven_multilingual_v2"

def api(url, data=None, accept=None):
    req = urllib.request.Request(url, data=data)
    req.add_header("xi-api-key", key)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if accept:
        req.add_header("Accept", accept)
    return urllib.request.urlopen(req, timeout=60)

# voz premade por defecto (no requiere permiso voices_read). Multilingue v2 habla ES.
DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"  # Rachel

# elegir voz: archivo .eleven.voice si existe; si no, intentar listar; si no hay permiso, default
def pick_voice():
    if os.path.exists(vfile):
        v = open(vfile).read().strip()
        if v:
            print("Voz de .eleven.voice:", v); return v
    try:
        data = json.load(api("https://api.elevenlabs.io/v1/voices"))
        voices = data.get("voices", [])
        def is_es(v):
            labs = (v.get("labels") or {})
            blob = (str(labs) + v.get("name","") + (v.get("description") or "")).lower()
            return "spanish" in blob or "español" in blob or labs.get("language")=="es"
        for v in voices:
            if is_es(v):
                print("Voz ES:", v["name"], v["voice_id"]); return v["voice_id"]
        if voices:
            print("Sin voz ES; multilingue:", voices[0]["name"], voices[0]["voice_id"])
            return voices[0]["voice_id"]
    except urllib.error.HTTPError:
        pass
    print("Sin permiso para listar voces; uso default Rachel:", DEFAULT_VOICE)
    return DEFAULT_VOICE

def dur(path):
    out = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                          "-of","default=nokey=1:noprint_wrappers=1", path],
                         capture_output=True, text=True).stdout.strip()
    return float(out)

voice = pick_voice()
man = json.load(open(MANI))
url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}"
for m in man:
    body = json.dumps({
        "text": m["nar"], "model_id": MODEL,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.0}
    }).encode()
    out = os.path.join(AUDIO, f"{m['band']:02d}.mp3")
    try:
        resp = api(url, data=body, accept="audio/mpeg")
        with open(out, "wb") as f:
            f.write(resp.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs HTTP {e.code}: {e.read().decode()[:300]}")
    m["adur"] = round(dur(out), 3)
    print(f"band {m['band']:02d}  {m['adur']:5.2f}s  {m['nar'][:48]}…")

json.dump(man, open(MANI, "w"), ensure_ascii=False, indent=2)
print(f"OK {len(man)} clips. total narracion ~{sum(m['adur'] for m in man):.0f}s")
