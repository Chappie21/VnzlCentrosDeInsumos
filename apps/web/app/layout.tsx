import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import Providers from "./providers";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, THEME_COLOR } from "./constants/site";
import { ICON_NAMES } from "./constants/icons";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// `icon_names=` hace que Google sirva solo los glifos que usamos (~78 KB) en vez del
// variable font completo (~3.9 MB). next/font/google no puede generar este parámetro
// (su getGoogleFontsUrl solo arma family/axes/display), así que el <link> se queda.
const MATERIAL_SYMBOLS_HREF =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" +
  `&icon_names=${ICON_NAMES.join(",")}` +
  "&display=swap";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "centros de acopio",
    "donaciones",
    "Venezuela",
    "Colombia",
    "LATAM",
    "emergencia",
    "ayuda humanitaria",
    "voluntarios",
    "insumos",
  ],
  authors: [{ name: SITE_NAME }],
  category: "nonprofit",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "es_419", // español latinoamericano: la app ya no es de un solo país
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} font-sans`}>
      <head>
        {/* Material Symbols: preconnect + display=swap para no bloquear el render. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={MATERIAL_SYMBOLS_HREF} />
      </head>
      <body className="bg-surface text-on-surface font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
