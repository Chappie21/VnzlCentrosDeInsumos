import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import MiCentroCard from "./MiCentroCard";
import type { MiCentro } from "../../../lib/api";

const base: Omit<MiCentro, "rol"> = {
  id: "c1",
  nombre: "Centro Norte",
  ciudad: "Maracaibo",
  estado: "Zulia",
  direccion: "Av. 5",
  recibiendoAhora: true,
  horarioCierre: null,
  voluntarios: 3,
  insumos: [],
};

describe("MiCentroCard", () => {
  it("muestra badge 'Dueño' cuando el rol es JEFE", () => {
    render(<MiCentroCard centro={{ ...base, rol: "JEFE" }} />);
    expect(screen.getByText("Dueño")).toBeTruthy();
  });

  it("muestra badge 'Voluntario' cuando el rol es VOLUNTARIO", () => {
    render(<MiCentroCard centro={{ ...base, rol: "VOLUNTARIO" }} />);
    expect(screen.getByText("Voluntario")).toBeTruthy();
  });

  it("linkea al detalle del centro", () => {
    render(<MiCentroCard centro={{ ...base, rol: "JEFE" }} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/mis-centros/c1");
  });
});
