# Tutorial — generador de video

Scripts para armar el video tutorial de Red Acopio Venezuela (horizontal 16:9 y
vertical 9:16 para redes) a partir de capturas de la app + narración opcional (TTS).

**Este repo solo trae los scripts.** Las capturas, slides, audio y `.mp4` se generan
localmente (están en `.gitignore`). Las API keys nunca se commitean.

## Qué hay acá

| Archivo | Rol |
|---|---|
| `gen_slides.py` | Define el guión (`SLIDES`) y arma los slides **horizontales** (1920×1080) en HTML. |
| `gen_vertical.py` | Reusa `SLIDES` y arma los slides **verticales** (1080×1920). |
| `synth_audio.py` | Sintetiza la narración por slide con ElevenLabs (opcional). |
| `build.sh` | Video horizontal **sin** narración (duración fija por slide). |
| `build_narrated.sh` | Video horizontal **con** narración sincronizada → `tutorial_narrado.mp4`. |
| `build_vertical.sh` | Video vertical con narración → `tutorial_redes.mp4`. |

Editar textos/duraciones del tutorial = editar la lista `SLIDES` en `gen_slides.py`.

## Requisitos

- `python3`, `ffmpeg`, ImageMagick (`convert`) — `sudo apt install ffmpeg imagemagick`
- Un navegador para capturar pantallas (capturas de la app + render de los slides HTML).
- (Opcional, para voz) cuenta de ElevenLabs.

## Flujo para regenerar

### 1. Capturar las pantallas de la app → `shots/`

Levantar la app (ver README raíz) y capturar cada flujo a **414×896** (móvil) en
`shots/NN-nombre.png`. Los nombres exactos están en la lista `SLIDES` de
`gen_slides.py` (campo `fname`): `01-landing.png`, `02-registro.png`, … `32-moderacion-cola.png`.

Tips usados al capturar (inyectar por consola antes del screenshot):
- Ocultar el overlay de Next dev y la scrollbar:
  `nextjs-portal{display:none!important} ::-webkit-scrollbar{display:none!important} html{scrollbar-width:none}`
- En pantallas con barras fijas (panel del jefe, ajustar stock): pasar los
  elementos `fixed`/`sticky` a estáticos para que no tapen contenido:
  `.fixed,.sticky{position:static!important}` y capturar página completa.
- Datos de prueba (un centro, un voluntario, un admin de moderación): crearlos
  desde la propia app o con un seed propio de Prisma según necesites.

### 2. (Opcional) Narración con ElevenLabs

```bash
printf '%s' 'TU_API_KEY'  > .eleven.key      # NO se commitea
printf '%s' 'VOICE_ID'    > .eleven.voice    # voz que tu plan permita por API
```
> Plan free de ElevenLabs: solo algunas voces premade funcionan por API
> (ej. `EXAVITQu4vr4xnSDxMaL` Sarah). Las de "Library" requieren plan pago.

### 3. Generar slides + (opcional) audio

```bash
python3 gen_slides.py      # slides/ (horizontal)  + manifest.json con el guión
python3 gen_vertical.py    # slides_v/ (vertical)  — reusa adur del manifest horizontal
python3 synth_audio.py     # slides/audio/*.mp3 + agrega 'adur' al manifest (si querés voz)
```

### 4. Renderizar los slides HTML a PNG

Abrir cada `slides/chunk_*.html` en el navegador al **ancho 1920** (vertical: `slides_v/chunk_*.html` al ancho **1080**) y guardar captura de **página completa** como
`chunk_N.png` en la misma carpeta. (Headless: `chromium --headless --screenshot` o Playwright.)

### 5. Montar el video

```bash
bash build_narrated.sh    # → tutorial_narrado.mp4  (16:9)
bash build_vertical.sh    # → tutorial_redes.mp4    (9:16)
# o, sin voz:
bash build.sh             # → tutorial.mp4
```

Cada slide dura lo que su narración + 0.7 s de cola (`PAD` en los `build_*.sh`).
