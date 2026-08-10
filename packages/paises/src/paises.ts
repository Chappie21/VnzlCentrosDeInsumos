// ponytail: dos países, en un `as const`. Sin registry ni plugins hasta que haya un tercero.
export const PAISES = ["VE", "CO"] as const;
export type Pais = (typeof PAISES)[number];

export interface PaisMeta {
  label: string;
  bandera: string;
  // Los niveles administrativos no se llaman igual en cada país: un colombiano
  // no busca "Estado", busca "Departamento".
  labelEstado: string;
  labelCiudad: string;
  // Vista por defecto del mapa cuando todavía no hay puntos que encuadrar.
  mapa: { lat: number; lng: number; zoom: number };
  // Ejemplos para los placeholders de los formularios.
  ejemploDocumento: string;
  ejemploTelefono: string;
}

export const PAIS_META: Record<Pais, PaisMeta> = {
  VE: {
    label: "Venezuela",
    bandera: "🇻🇪",
    labelEstado: "Estado",
    labelCiudad: "Ciudad",
    mapa: { lat: 8, lng: -66, zoom: 6 },
    ejemploDocumento: "V12345678",
    ejemploTelefono: "04141234567",
  },
  CO: {
    label: "Colombia",
    bandera: "🇨🇴",
    labelEstado: "Departamento",
    labelCiudad: "Municipio",
    mapa: { lat: 4.57, lng: -74.3, zoom: 6 },
    ejemploDocumento: "1020304050",
    ejemploTelefono: "3001234567",
  },
};

export function esPaisValido(value: unknown): value is Pais {
  return typeof value === "string" && (PAISES as readonly string[]).includes(value);
}
