import type { MetadataRoute } from "next";
import { SITE_URL } from "./constants/site";

// Rutas públicas estáticas. Los detalles de centro (/centros/:id) no se listan:
// requerirían leer todos los ids en build. ponytail: agregar si interesa indexarlos.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/centros`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/mapa`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
  ];
}
