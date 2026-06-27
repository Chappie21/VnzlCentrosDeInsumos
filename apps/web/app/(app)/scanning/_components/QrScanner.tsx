"use client";

import { useEffect, useId, useRef, useState } from "react";

// Cámara de escaneo (html5-qrcode). Import dinámico: la lib toca navigator/DOM,
// así no corre en SSR. La cámara se detiene al desmontar.
export default function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const id = "qr-" + useId().replace(/[:]/g, "");
  const [error, setError] = useState<string | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let cancelled = false;
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const s = new Html5Qrcode(id);
        scanner = s;
        await s.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text: string) => onScanRef.current(text),
          () => {}, // ignora frames sin QR
        );
        if (cancelled) await s.stop().catch(() => {});
      } catch {
        if (!cancelled) setError("No se pudo acceder a la cámara. Revisá los permisos del navegador.");
      }
    })();

    return () => {
      cancelled = true;
      if (scanner) scanner.stop().then(() => scanner?.clear()).catch(() => {});
    };
  }, [id]);

  if (error) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center text-on-surface-variant">
        {error}
      </div>
    );
  }

  return (
    <div
      id={id}
      className="mx-auto w-full max-w-sm overflow-hidden rounded-xl border-2 border-emergency bg-black"
    />
  );
}
