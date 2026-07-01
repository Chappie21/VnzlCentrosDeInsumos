"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../../_components";
import type { CentroDetalle } from "../../../../lib/api";
import { SITE_NAME } from "../../../../constants/site";
import AnuncioCard from "./AnuncioCard";

// Espera a que todas las <img> dentro del nodo estén cargadas (los tiles OSM se
// piden por red). Sin esto html-to-image captura tiles a medio cargar. Corta a
// los `timeoutMs` para que un tile lento nunca bloquee el compartir.
async function esperarImagenes(node: HTMLElement, timeoutMs = 4000): Promise<void> {
  const imgs = Array.from(node.querySelectorAll("img"));
  const cargadas = Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );
  const tope = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([cargadas, tope]);
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, base64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/png";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

function slug(nombre: string): string {
  return (
    nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "centro"
  );
}

// Botón que genera un PNG (anuncio para redes) con las necesidades del centro y
// lo comparte vía Web Share API, con fallback a descarga. 100% client-side.
export default function CompartirNecesidades({ centro }: { centro: CentroDetalle }) {
  // `generando` monta la card offscreen SOLO durante la captura: así los tiles OSM
  // se piden únicamente cuando el usuario comparte, no en cada carga del dashboard.
  const [generando, setGenerando] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!generando) return;
    let cancelado = false;

    (async () => {
      try {
        const node = cardRef.current;
        if (!node) return;

        await esperarImagenes(node);
        if (cancelado) return;

        const { toPng } = await import("html-to-image");
        // skipFonts: el nodo usa fuentes de sistema + emojis + un pin SVG, ningún
        // web-font. Evita que html-to-image intente leer hojas de estilo cross-origin
        // (Google Fonts / Material Symbols) — eso disparaba warnings de CORS al generar.
        const dataUrl = await toPng(node, {
          pixelRatio: 1,
          cacheBust: true,
          skipFonts: true,
        });

        const filename = `necesidades-${slug(centro.nombre)}.png`;
        const file = dataUrlToFile(dataUrl, filename);
        const title = `${centro.nombre} necesita tu ayuda`;
        const text = `Necesidades del centro de acopio ${centro.nombre} — ${SITE_NAME}`;

        // Compartir nativo si el navegador puede compartir archivos.
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title, text });
            return;
          } catch (err) {
            // El usuario canceló: no es un error que debamos reportar.
            if (err instanceof DOMException && err.name === "AbortError") return;
            // Cualquier otro problema: caemos al fallback de descarga.
          }
        }

        // Fallback: descargar el PNG.
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (err) {
        console.error("No se pudo generar el anuncio de necesidades", err);
      } finally {
        if (!cancelado) setGenerando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [generando, centro]);

  return (
    <>
      <button
        type="button"
        onClick={() => setGenerando(true)}
        disabled={generando}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50"
      >
        <Icon name="ios_share" />
        {generando ? "Generando…" : "Compartir necesidades"}
      </button>

      {/* Nodo capturado: montado solo al generar, offscreen pero con layout real
          (no display:none, que rompería la captura). */}
      {generando && (
        <div
          aria-hidden
          style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}
        >
          <AnuncioCard ref={cardRef} centro={centro} />
        </div>
      )}
    </>
  );
}
