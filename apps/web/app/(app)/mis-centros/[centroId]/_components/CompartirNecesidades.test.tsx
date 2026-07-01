import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CompartirNecesidades from "./CompartirNecesidades";
import type { CentroDetalle } from "../../../../lib/api";

// Mock de html-to-image: toPng devuelve un dataURL PNG dummy (1x1 transparente).
const DUMMY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const toPng = vi.fn(async () => DUMMY_PNG);
vi.mock("html-to-image", () => ({ toPng: () => toPng() }));

const centro: CentroDetalle = {
  id: "c1",
  nombre: "Centro Prueba",
  estado: "Miranda",
  ciudad: "Los Teques",
  direccion: "Av. Bolívar 123",
  latitud: 10.34,
  longitud: -67.03,
  recibiendoAhora: true,
  horarioCierre: null,
  verificacion: "VERIFICADO",
  fotoUrl: null,
  voluntarios: 3,
  donaciones: 5,
  rol: "VOLUNTARIO",
  insumos: [
    {
      id: "i1",
      nombre: "Agua",
      descripcion: null,
      nivel: "URGENTE",
      categoria: null,
      cantidadTotal: 2,
      umbralUrgente: null,
      umbralSuficiente: null,
    },
  ],
};

describe("CompartirNecesidades", () => {
  beforeEach(() => {
    toPng.mockClear();
  });

  it("renderiza el botón", () => {
    render(<CompartirNecesidades centro={centro} />);
    expect(
      screen.getByRole("button", { name: /compartir necesidades/i }),
    ).toBeTruthy();
  });

  it("al hacer click genera el PNG y comparte", async () => {
    const share = vi.fn(async () => undefined);
    const canShare = vi.fn(() => true);
    Object.assign(navigator, { share, canShare });

    render(<CompartirNecesidades centro={centro} />);
    fireEvent.click(
      screen.getByRole("button", { name: /compartir necesidades/i }),
    );

    // esperarImagenes corta a los 4s en jsdom (las <img> no disparan load),
    // por eso damos margen extra al waitFor.
    await waitFor(() => expect(toPng).toHaveBeenCalled(), { timeout: 6000 });
    await waitFor(() => expect(share).toHaveBeenCalled(), { timeout: 6000 });
  });
});
