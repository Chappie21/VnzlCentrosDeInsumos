import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import GuiaView from "./GuiaView";
import type { Guia } from "../../../../lib/api";

const base: Guia = {
  id: "TRX-1",
  creadoEn: "2026-06-27T12:00:00Z",
  transporte: "Juan Pérez",
  despachadoPor: "Ana",
  origen: { nombre: "Centro Norte", ciudad: "Caracas", estado: "Distrito Capital" },
  destino: { nombre: "Centro Sur", ciudad: "Maracaibo" },
  items: [
    { nombre: "Agua", cantidad: 5 },
    { nombre: "Mantas", cantidad: 2 },
  ],
};

describe("GuiaView", () => {
  it("muestra origen, destino centro, transporte, quién despachó e items", () => {
    render(<GuiaView guia={base} />);
    expect(screen.getByText(/Centro Norte/)).toBeTruthy();
    expect(screen.getByText(/Centro Sur/)).toBeTruthy();
    expect(screen.getByText(/Juan Pérez/)).toBeTruthy();
    expect(screen.getByText(/Ana/)).toBeTruthy();
    expect(screen.getByText("Agua")).toBeTruthy();
    expect(screen.getByText(/TRX-1/)).toBeTruthy();
  });

  it("muestra destino de texto libre (albergue)", () => {
    render(<GuiaView guia={{ ...base, destino: { texto: "Albergue Regional Sur" } }} />);
    expect(screen.getByText(/Albergue Regional Sur/)).toBeTruthy();
  });

  it("muestra el total de bultos", () => {
    render(<GuiaView guia={base} />);
    expect(screen.getByTestId("total-bultos").textContent).toContain("7");
  });
});
