import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import CentroCard from "./CentroCard";
import type { CentroCard as Centro } from "../../../_hooks";

const base: Centro = {
  id: "c1",
  nombre: "Centro Uno",
  ciudad: "Caracas",
  estado: "DC",
  direccion: "Av 1",
  recibiendoAhora: true,
  horarioCierre: null,
  distanciaKm: null,
  prioridadAlta: false,
  necesidades: [],
};

describe("CentroCard", () => {
  it("muestra distancia cuando hay distanciaKm, la oculta cuando es null", () => {
    const { rerender } = render(<CentroCard centro={{ ...base, distanciaKm: 2.54 }} />);
    expect(screen.getByText("A 2.5km")).toBeTruthy();

    rerender(<CentroCard centro={{ ...base, distanciaKm: null }} />);
    expect(screen.queryByText(/A .*km/)).toBeNull();
  });

  it("footer: 'Recibiendo ahora' si abierto; 'Cierra a las HH:MM' / 'Cerrado' si no", () => {
    const { rerender } = render(<CentroCard centro={base} />);
    expect(screen.getByText(/Recibiendo ahora/i)).toBeTruthy();

    rerender(<CentroCard centro={{ ...base, recibiendoAhora: false, horarioCierre: "20:00" }} />);
    expect(screen.getByText(/Cierra a las 20:00/)).toBeTruthy();

    rerender(<CentroCard centro={{ ...base, recibiendoAhora: false, horarioCierre: null }} />);
    expect(screen.getByText(/Cerrado/)).toBeTruthy();
  });

  it("barra roja de prioridad solo si prioridadAlta", () => {
    // la barra es el span absoluto de ancho w-1 (no confundir con el pulse dot)
    const { container, rerender } = render(<CentroCard centro={base} />);
    expect(container.querySelector(".absolute.w-1")).toBeNull();

    rerender(<CentroCard centro={{ ...base, prioridadAlta: true }} />);
    expect(container.querySelector(".absolute.w-1")).not.toBeNull();
  });
});
