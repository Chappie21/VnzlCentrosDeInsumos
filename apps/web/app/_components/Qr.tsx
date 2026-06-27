import { QRCodeSVG } from "qrcode.react";

// Wrapper del QR para reusar en donar (CEN-8), invitar (CEN-10) y guías de envío (CEN-17).
// SVG (no canvas) para que escale nítido y sea fácil de descargar/imprimir.
export default function Qr({ value, size = 224 }: { value: string; size?: number }) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="M"
      marginSize={2}
      className="h-auto w-full max-w-[var(--qr-size)]"
      style={{ ["--qr-size" as string]: `${size}px` }}
    />
  );
}
