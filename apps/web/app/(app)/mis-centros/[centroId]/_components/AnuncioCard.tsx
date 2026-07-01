"use client";

import { forwardRef } from "react";
import type { CentroDetalle } from "../../../../lib/api";
import { SITE_NAME, SITE_URL } from "../../../../constants/site";
import { seleccionarNecesidades } from "../_lib/anuncioInsumos";
import MapaTilePreview from "./MapaTilePreview";

// Paleta Terra (hex explícitos: html-to-image captura estilos calculados, así
// que no dependemos de que las clases/tokens de Tailwind resuelvan en el clon).
const CREMA = "#faf6f0";
const VERDE = "#4a7c59";
const ROJO = "#b83230";
const ON_SURFACE = "#2e3230";
const ON_VARIANT = "#4a4e4a";

// Categoría de insumo → emoji + etiqueta, para anotar cada necesidad en la lista.
const CAT_INFO: Record<string, { emoji: string; label: string }> = {
  AGUA: { emoji: "💧", label: "Agua" },
  ALIMENTOS: { emoji: "🥫", label: "Alimentos" },
  MEDICAMENTOS: { emoji: "💊", label: "Medicamentos" },
  ROPA: { emoji: "👕", label: "Ropa" },
  HERRAMIENTAS: { emoji: "🔧", label: "Herramientas" },
};

// Nodo que se captura como PNG (formato retrato IG 1080×1350). Usa ref para que
// CompartirNecesidades pueda pasarlo a html-to-image.
const AnuncioCard = forwardRef<HTMLDivElement, { centro: CentroDetalle }>(
  function AnuncioCard({ centro }, ref) {
    // Mostramos TODAS las necesidades (cap alto). La fuente se adapta al conteo
    // para que quepan sin recortarse en el lienzo fijo de 1350px.
    const necesidades = seleccionarNecesidades(centro.insumos, 20);
    const tieneMapa = centro.latitud != null && centro.longitud != null;
    const filas = necesidades.items.length + (necesidades.extra > 0 ? 1 : 0);
    const fsItem =
      filas <= 6 ? 36 : filas <= 8 ? 30 : filas <= 10 ? 26 : filas <= 12 ? 23 : 20;
    const mbItem = Math.round(fsItem * 0.28);
    const mapaH = 300; // fijo y con flexShrink:0 para que nunca lo aplaste el flex
    const tituloNecesidades =
      necesidades.nivelUsado === "NORMAL" ? "Necesidades" : "Necesidades urgentes";
    const siteHost = SITE_URL.replace(/^https?:\/\//, "");

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: 1350,
          background: CREMA,
          color: ON_SURFACE,
          display: "flex",
          flexDirection: "column",
          padding: 64,
          boxSizing: "border-box",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {/* Header: marca + titular */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span role="img" aria-label="Caja" style={{ fontSize: 64, lineHeight: 1 }}>
            📦
          </span>
          <span
            style={{ fontSize: 34, fontWeight: 700, color: VERDE, letterSpacing: 0.5 }}
          >
            {SITE_NAME}
          </span>
        </div>
        <h1
          style={{
            marginTop: 28,
            fontSize: 76,
            lineHeight: 1.05,
            fontWeight: 800,
            color: ROJO,
          }}
        >
          Necesitamos tu ayuda
        </h1>

        {/* Nombre del centro */}
        <div style={{ marginTop: 40 }}>
          <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.1 }}>
            {centro.nombre}
          </div>
          <div style={{ marginTop: 10, fontSize: 32, color: ON_VARIANT }}>
            {centro.ciudad}, {centro.estado}
          </div>
        </div>

        {/* Necesidades: zona flexible que absorbe el espacio sobrante (el mapa y el
            footer no se encogen), así entran todas sin aplastar el mapa. */}
        <div style={{ marginTop: 44, flex: 1, minHeight: 0, overflow: "hidden" }}>
          {necesidades.vacio ? (
            <div style={{ fontSize: 40, fontWeight: 600, color: VERDE }}>
              Estamos recibiendo donaciones
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  color: ON_VARIANT,
                }}
              >
                {tituloNecesidades}
              </div>
              <ul
                style={{
                  marginTop: 20,
                  paddingLeft: 40,
                  listStyleType: "disc",
                  listStylePosition: "outside",
                  color: necesidades.nivelUsado === "URGENTE" ? ROJO : VERDE,
                }}
              >
                {necesidades.items.map((i) => {
                  const cat = i.categoria ? CAT_INFO[i.categoria] : null;
                  return (
                    <li key={i.id} style={{ marginBottom: mbItem, fontSize: fsItem, lineHeight: 1.2 }}>
                      <span style={{ color: ON_SURFACE, fontWeight: 600 }}>{i.nombre}</span>
                      {cat && (
                        <span style={{ color: ON_VARIANT, fontWeight: 500 }}>
                          {" "}
                          ({cat.emoji} {cat.label})
                        </span>
                      )}
                    </li>
                  );
                })}
                {necesidades.extra > 0 && (
                  <li style={{ marginBottom: mbItem, fontSize: fsItem, lineHeight: 1.2 }}>
                    <span style={{ color: ON_VARIANT, fontWeight: 600 }}>
                      +{necesidades.extra} más
                    </span>
                  </li>
                )}
              </ul>
            </>
          )}
        </div>

        {/* Mapa (opcional) */}
        {tieneMapa && (
          <div
            style={{
              marginTop: 24,
              flexShrink: 0,
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 6px 20px rgba(0,0,0,.12)",
            }}
          >
            <MapaTilePreview
              lat={centro.latitud as number}
              lng={centro.longitud as number}
              boxW={952}
              boxH={mapaH}
            />
          </div>
        )}

        {/* Dirección + footer, anclados abajo (no se encogen) */}
        <div style={{ marginTop: 24, flexShrink: 0 }}>
          <div style={{ fontSize: 30, color: ON_SURFACE, fontWeight: 600 }}>
            {centro.direccion} · {centro.ciudad}, {centro.estado}
          </div>
          <div
            style={{
              marginTop: 24,
              paddingTop: 24,
              borderTop: `2px solid rgba(0,0,0,.1)`,
              fontSize: 26,
              color: ON_VARIANT,
            }}
          >
            Publicado desde {SITE_NAME} · {siteHost}
          </div>
        </div>
      </div>
    );
  },
);

export default AnuncioCard;
