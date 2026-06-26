import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Centros de Acopio · Venezuela",
  description: "Directorio de centros de acopio y donaciones de emergencia",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
