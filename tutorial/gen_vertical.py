#!/usr/bin/env python3
# Genera slides 1080x1920 (9:16, redes) reusando SLIDES de gen_slides.
# Toma adur (duración de narración) del manifest horizontal ya sintetizado.
import os, html, json
from gen_slides import SLIDES, GREEN, BROWN, CREAM, INK, SHOTS

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "slides_v")
os.makedirs(OUT, exist_ok=True)
W, H = 1080, 1920

# adur por banda desde el manifest horizontal
hman = {m["band"]: m for m in json.load(open(os.path.join(BASE, "slides", "manifest.json")))}

def frame(body, bg=CREAM):
    return (f'<div style="width:{W}px;height:{H}px;background:{bg};'
            f'display:flex;align-items:center;justify-content:center;overflow:hidden">{body}</div>')

def cover_slide(title, sub):
    return frame(f"""<div style="text-align:center;color:#fff;padding:0 70px">
      <div style="font-size:150px">📦</div>
      <h1 style="font-size:96px;color:#fff;letter-spacing:2px;margin-top:30px;line-height:1.05">{html.escape(title)}</h1>
      <p style="font-size:46px;margin-top:34px;opacity:.92;line-height:1.3">{html.escape(sub)}</p>
    </div>""", bg=GREEN)

def section_slide(title, sub):
    return frame(f"""<div style="text-align:center;color:#fff;padding:0 70px">
      <h1 style="font-size:110px;color:#fff;line-height:1.05">{html.escape(title)}</h1>
      <p style="font-size:50px;margin-top:28px;opacity:.9">{html.escape(sub)}</p>
    </div>""", bg=BROWN)

def shot_slide(fname, title, sub):
    src = "file://" + os.path.join(SHOTS, fname)
    return frame(f"""<div style="display:flex;flex-direction:column;align-items:center;
         width:{W}px;height:{H}px;padding:70px 60px 80px">
      <div style="text-align:center;margin-bottom:34px">
        <div style="width:110px;height:12px;background:{GREEN};border-radius:7px;margin:0 auto 26px"></div>
        <h1 style="font-size:62px;color:{INK};line-height:1.1">{html.escape(title)}</h1>
        <p style="font-size:38px;color:#555;margin-top:20px;line-height:1.35">{html.escape(sub)}</p>
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;min-height:0">
        <img src="{src}" style="max-height:100%;max-width:560px;border-radius:30px;
             box-shadow:0 20px 55px rgba(0,0,0,.28);border:9px solid #fff"/>
      </div>
    </div>""")

HEAD = ("<!doctype html><html><head><meta charset='utf-8'><style>"
        "*{margin:0;padding:0;box-sizing:border-box;"
        "font-family:'Segoe UI',system-ui,sans-serif}"
        f"html,body{{width:{W}px}}</style></head><body>")

divs, manifest, band = [], [], 0
for typ, fname, title, sub, dur, nar in SLIDES:
    if typ == "cover":
        h = cover_slide(title, sub)
    elif typ == "section":
        h = section_slide(title, sub)
    else:
        if not os.path.exists(os.path.join(SHOTS, fname)):
            print("MISSING", fname); continue
        h = shot_slide(fname, title, sub)
    divs.append(h)
    manifest.append({"band": band, "png": f"{band:02d}.png",
                     "dur": dur, "nar": nar, "adur": hman[band].get("adur")})
    band += 1

CHUNK = 4  # 4*1920 = 7680px por chunk (bajo el límite de PNG de ImageMagick)
chunks = []
for c, start in enumerate(range(0, len(divs), CHUNK)):
    group = divs[start:start+CHUNK]
    with open(os.path.join(OUT, f"chunk_{c}.html"), "w") as f:
        f.write(HEAD + "".join(group) + "</body></html>")
    chunks.append({"png": f"chunk_{c}.png", "count": len(group)})
    for j in range(len(group)):
        manifest[start+j]["chunk"] = c
        manifest[start+j]["row"] = j

json.dump(chunks, open(os.path.join(OUT, "chunks.json"), "w"), indent=2)
json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), ensure_ascii=False, indent=2)
print(f"{len(manifest)} bands, {len(chunks)} chunks (CHUNK={CHUNK}), {W}x{H}")
