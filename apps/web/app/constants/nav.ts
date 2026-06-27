import { ROUTES } from "./routes";

// Tabs del BottomNav global. `requiresIdentity`: solo visibles con identidad completa
// (Mi Centro y Escanear son acciones de operador/voluntario; el directorio es público).
export const NAV_TABS: {
  href: string;
  icon: string;
  label: string;
  requiresIdentity: boolean;
}[] = [
  { href: ROUTES.miCentro, icon: "home_work", label: "Mi Centro", requiresIdentity: true },
  { href: ROUTES.centros, icon: "location_on", label: "Centros", requiresIdentity: false },
  { href: ROUTES.inventario, icon: "inventory_2", label: "Inventario", requiresIdentity: false },
  { href: ROUTES.scanning, icon: "qr_code_scanner", label: "Escanear", requiresIdentity: true },
];

// Rutas de "flujo" enfocado (donar, etc.): ocultan el BottomNav porque no son
// destinos de tab sino tareas con su propio foco. Agregar prefijos a medida que
// aparezcan (crear centro, invitar, nuevo envío).
export const NAV_HIDDEN_PREFIXES: string[] = [ROUTES.donar];
