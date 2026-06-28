import type { MetadataRoute } from "next";
import { SITE_URL } from "./constants/site";

// Indexable el directorio público; bloqueadas las rutas de operador/flujos privados.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/mis-centros", "/scanning", "/envios", "/donar", "/reporte", "/unirse"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
