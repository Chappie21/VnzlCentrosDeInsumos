import { flag } from "flags/next";

// Feature flags del frontend. Se declaran con el Flags SDK (dashboard de Vercel,
// Flags Explorer, observabilidad) pero SIN proveedor: el valor sale de la API,
// que a su vez lo lee del registro de Railway.
//
// Por qué no una copia del flag en Vercel: la decisión gobierna los dos lados a
// la vez (la API exige el nombre / el formulario lo pide). Con dos registros
// independientes, apagar el portón en Railway y olvidarse de Vercel deja el
// registro venezolano en un 400 en loop. Una sola verdad, un solo interruptor.

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Valor seguro si la API no responde: portón activo = el formulario NO pide el
// nombre. Es el estado normal, y si nos equivocamos la API responde 400 pidiendo
// el nombre en vez de crear una cuenta sin él.
const DEFAULT_CEDULA_VE = true;

export const cedulaValidacionVe = flag<boolean>({
  key: "cedula-validacion-ve",
  description:
    "Portón de verificación de cédula venezolana. Activo: el nombre lo pone el registro civil y el formulario no lo pide. Fuente de verdad: Railway.",
  async decide() {
    try {
      // revalidate 30s: alinea con el s-maxage del endpoint. El kill switch tarda
      // a lo sumo medio minuto en llegar a la UI.
      const res = await fetch(`${API}/config/flags`, { next: { revalidate: 30 } });
      if (!res.ok) return DEFAULT_CEDULA_VE;
      const data = (await res.json()) as { cedulaValidacionVe?: boolean };
      return data.cedulaValidacionVe ?? DEFAULT_CEDULA_VE;
    } catch {
      return DEFAULT_CEDULA_VE;
    }
  },
});
