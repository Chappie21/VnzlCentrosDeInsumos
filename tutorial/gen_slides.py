#!/usr/bin/env python3
# ponytail: compone los slides 1080p como HTML (luego Chrome los screenshotea).
# Evita drawtext de ffmpeg (acentos/fuentes). ffmpeg solo concatena PNGs iguales.
# Cada slide trae texto de narracion (TTS) -> manifest.json lo lleva a synth_audio.py.
import os, html, json

BASE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(BASE, "shots")
OUT = os.path.join(BASE, "slides")
os.makedirs(OUT, exist_ok=True)

GREEN = "#3f7d56"; BROWN = "#7a5b34"; CREAM = "#f5f1e8"; INK = "#2b2b2b"

# (tipo, archivo|None, titulo, subtitulo, dur_seg_fallback, narracion)
SLIDES = [
    ("cover", None, "Red Acopio Venezuela", "Guía de uso de la aplicación · Centros de acopio", 4,
     "Bienvenido a Red Acopio Venezuela. En este tutorial vas a ver, paso a paso, cómo usar la aplicación para donar, buscar centros y administrar un centro de acopio."),

    ("section", None, "1 · Uso público", "Sin necesidad de cuenta", 2.5,
     "Primero, lo que cualquier persona puede hacer sin necesidad de crear una cuenta."),
    ("shot", "01-landing.png", "Pantalla de inicio", "Donar o buscar centros no requiere cuenta.", 4,
     "Esta es la pantalla de inicio. Desde aquí puedes donar o buscar un centro sin registrarte. Solo necesitas una cuenta si vas a administrar un centro o ser voluntario."),
    ("shot", "02-registro.png", "Crear cuenta", "Registro con cédula y teléfono.", 4,
     "Para crear una cuenta ingresas tu cédula y tu teléfono. El nombre se toma automáticamente del registro de cédula, así que no necesitas escribirlo."),
    ("shot", "03-login.png", "Iniciar sesión", "Para administrar un centro o ser voluntario.", 3.5,
     "Si ya tienes cuenta, inicias sesión con tu cédula y tu contraseña."),
    ("shot", "04-centros.png", "Buscar centros", "Directorio con búsqueda y filtros.", 4,
     "En el directorio de centros puedes buscar por nombre o ciudad, y filtrar por cercanía, centros abiertos o nivel de urgencia."),
    ("shot", "05-mapa.png", "Mapa de centros", "Todos los centros de la red sobre el mapa.", 3.5,
     "El mapa muestra todos los centros de la red. Tocando un punto vas directo al detalle de ese centro."),
    ("shot", "06-centro-detalle.png", "Detalle de un centro", "Qué necesita y dónde queda.", 4,
     "En el detalle de cada centro ves su dirección, si está recibiendo, y qué insumos necesita con sus cantidades."),
    ("shot", "07-donar.png", "Armar una donación", "Elegí insumos y cantidades.", 4,
     "Para donar, armas una lista con los insumos y las cantidades que vas a entregar. No necesitas una cuenta."),
    ("shot", "08-donar-qr.png", "QR de la donación", "Se muestra al voluntario al llegar.", 4,
     "Al confirmar, la aplicación genera un código QR. Se lo muestras al voluntario del centro cuando llegues con la donación."),
    ("shot", "09-faq.png", "Ayuda / Cómo funciona", "Preguntas frecuentes.", 3.5,
     "En la sección de ayuda encuentras las preguntas frecuentes sobre cómo funciona todo."),

    ("section", None, "2 · Operar un centro", "Rol Jefe (dueño del centro)", 2.5,
     "Ahora veamos cómo se administra un centro, desde el rol de jefe, que es el dueño del centro."),
    ("shot", "12-mis-centros-vacio.png", "Mis Centros", "Crear uno o sumarse como voluntario.", 4,
     "Al entrar con tu cuenta, la sección Mis Centros aparece vacía. Desde aquí puedes crear un centro nuevo o sumarte como voluntario a uno existente."),
    ("shot", "14-crear-centro-paso1.png", "Crear centro · datos", "Datos y ubicación en el mapa.", 4.5,
     "Para crear un centro completas el nombre, el estado, la ciudad y la dirección, y fijas la ubicación tocando el mapa."),
    ("shot", "15-crear-centro-paso2.png", "Crear centro · inventario", "Inventario inicial o importar desde Excel.", 4.5,
     "En el segundo paso puedes cargar el inventario que el centro ya tiene. También puedes importarlo desde un archivo de Excel."),
    ("shot", "17-crear-centro-exito.png", "Centro registrado", "Queda activo y listo para recibir.", 3.5,
     "Listo: el centro queda registrado y activo, preparado para recibir donaciones."),
    ("shot", "13-mis-centros-lista.png", "Tus centros", "Separados como Dueño o Voluntario.", 4,
     "Ahora Mis Centros muestra tus centros, separados según seas el dueño o un voluntario."),
    ("shot", "18-dashboard-jefe.png", "Panel del centro (Jefe)", "Estadísticas y acciones de gestión.", 4.5,
     "Este es el panel del centro como jefe. Tienes las estadísticas y todas las acciones de gestión: voluntarios, umbrales, reportes y más."),
    ("shot", "19-ajuste-stock.png", "Ajustar stock", "Sumar o restar unidades con motivo.", 4,
     "Puedes ajustar el stock de cada insumo, sumando o restando unidades, y dejando un motivo del ajuste."),
    ("shot", "20-voluntarios.png", "Gestionar voluntarios", "Lista de miembros del centro.", 3.5,
     "Desde gestionar voluntarios ves la lista de miembros del centro."),
    ("shot", "21-invitar-qr.png", "Invitar voluntarios", "QR o enlace de invitación.", 4,
     "Para sumar gente, generas una invitación: un código QR o un enlace que puedes compartir. La invitación caduca en una hora."),
    ("shot", "22-umbrales.png", "Configurar umbrales", "Nivel automático según el stock.", 4,
     "Configurando umbrales, el nivel de cada insumo, urgente, normal o suficiente, se calcula solo según el stock disponible."),
    ("shot", "23-editar-centro.png", "Editar el centro", "Actualizar los datos.", 3.5,
     "También puedes editar en cualquier momento los datos del centro."),
    ("shot", "24-reporte.png", "Reporte de inventario", "Vista imprimible o PDF.", 4,
     "Y puedes generar un reporte del inventario, listo para imprimir o guardar como PDF."),

    ("section", None, "3 · Voluntario", "Sumarse y operar un centro", 2.5,
     "Veamos ahora el rol de voluntario."),
    ("shot", "25-unirse-aceptar.png", "Aceptar invitación", "Se une como voluntario.", 4,
     "Cuando una persona abre el enlace de invitación, se une al centro como voluntario automáticamente."),
    ("shot", "26-dashboard-voluntario.png", "Panel (Voluntario)", "Sin las acciones exclusivas del jefe.", 4,
     "El voluntario ve el mismo panel del centro, pero sin las acciones exclusivas del jefe, como invitar o configurar umbrales."),
    ("shot", "27-scanning.png", "Escanear donación", "Recibir donaciones por QR.", 3.5,
     "Con la opción de escanear, el voluntario usa la cámara para recibir las donaciones leyendo su código QR."),

    ("section", None, "4 · Envíos entre centros", "Despachar carga a otro destino", 2.5,
     "La aplicación también permite enviar insumos de un centro a otro."),
    ("shot", "28-envio-nuevo.png", "Nuevo envío", "Destino, insumos y transporte.", 4,
     "Para crear un envío eliges el destino, los insumos a despachar y los datos del transporte."),
    ("shot", "29-envio-confirmado.png", "Envío confirmado", "Se genera guía y QR de seguimiento.", 4,
     "Al confirmar, se genera la guía del envío con un código QR para el seguimiento de la carga."),
    ("shot", "30-guia.png", "Guía de carga", "Enlace público del QR.", 4,
     "La guía de carga es una página pública que se abre con ese QR, con todo el detalle del despacho."),

    ("section", None, "5 · Moderación", "Equipo que verifica los centros", 2.5,
     "Por último, el panel de moderación, usado por el equipo que verifica los centros."),
    ("shot", "32-moderacion-cola.png", "Verificar centros", "Verificar o rechazar pendientes.", 4.5,
     "Aquí el equipo revisa los centros pendientes. Puede ver si la cédula del responsable está verificada en el registro, y decidir entre verificar o rechazar cada centro."),

    ("cover", None, "Red Acopio Venezuela", "🇻🇪 Iniciativa Build4Venezuela", 3.5,
     "Y eso es todo. Red Acopio Venezuela, una iniciativa de Build for Venezuela. Gracias por ayudar."),
]

def slide_div(body, bg=CREAM):
    return (f'<div style="width:1920px;height:1080px;background:{bg};'
            f'display:flex;align-items:center;justify-content:center;overflow:hidden">'
            f'{body}</div>')

def cover_slide(title, sub):
    body = f"""<div style="text-align:center;color:#fff">
      <div style="font-size:120px">📦</div>
      <h1 style="font-size:84px;color:#fff;letter-spacing:2px;margin-top:20px">{html.escape(title)}</h1>
      <p style="font-size:38px;margin-top:24px;opacity:.92">{html.escape(sub)}</p>
    </div>"""
    return slide_div(body, bg=GREEN)

def section_slide(title, sub):
    body = f"""<div style="text-align:center;color:#fff">
      <h1 style="font-size:96px;color:#fff">{html.escape(title)}</h1>
      <p style="font-size:40px;margin-top:20px;opacity:.9">{html.escape(sub)}</p>
    </div>"""
    return slide_div(body, bg=BROWN)

def shot_slide(fname, title, sub):
    src = "file://" + os.path.join(SHOTS, fname)
    body = f"""<div style="display:flex;width:1920px;height:1080px">
      <div style="flex:0 0 760px;display:flex;align-items:center;justify-content:center;background:#e9e3d6">
        <img src="{src}" style="max-height:980px;max-width:680px;border-radius:28px;
             box-shadow:0 18px 50px rgba(0,0,0,.28);border:8px solid #fff"/>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 90px">
        <div style="width:90px;height:10px;background:{GREEN};border-radius:6px;margin-bottom:34px"></div>
        <h1 style="font-size:66px;color:{INK};line-height:1.1">{html.escape(title)}</h1>
        <p style="font-size:36px;color:#555;margin-top:30px;line-height:1.45">{html.escape(sub)}</p>
      </div>
    </div>"""
    return slide_div(body)

HEAD = ("<!doctype html><html><head><meta charset='utf-8'><style>"
        "*{margin:0;padding:0;box-sizing:border-box;"
        "font-family:'Segoe UI',system-ui,sans-serif}"
        "html,body{width:1920px}</style></head><body>")

if __name__ == "__main__":
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
        manifest.append({"band": band, "png": f"{band:02d}.png", "dur": dur, "nar": nar})
        band += 1

    CHUNK = 6
    chunks = []
    for c, start in enumerate(range(0, len(divs), CHUNK)):
        group = divs[start:start+CHUNK]
        fn = f"chunk_{c}.html"
        with open(os.path.join(OUT, fn), "w") as f:
            f.write(HEAD + "".join(group) + "</body></html>")
        chunks.append({"file": fn, "png": f"chunk_{c}.png", "count": len(group)})
        for j in range(len(group)):
            manifest[start+j]["chunk"] = c
            manifest[start+j]["row"] = j

    with open(os.path.join(OUT, "chunks.json"), "w") as f:
        json.dump(chunks, f, indent=2)
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"{len(manifest)} bands in {len(chunks)} chunks (CHUNK={CHUNK})")
