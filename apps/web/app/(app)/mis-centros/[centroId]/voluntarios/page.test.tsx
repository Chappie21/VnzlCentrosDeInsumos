import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { VOLUNTARIOS } from "../../../../constants";

vi.mock("next/navigation", () => ({ useParams: () => ({ centroId: "c1" }) }));

// Hooks controlados por test. useDebouncedValue es identidad para filtrar al toque.
const mocks = vi.hoisted(() => ({ useVoluntarios: vi.fn(), useCentroDetalle: vi.fn() }));
vi.mock("../../../../_hooks", () => ({
  useVoluntarios: mocks.useVoluntarios,
  useCentroDetalle: mocks.useCentroDetalle,
  useDebouncedValue: (v: string) => v,
}));

// Card simplificada: expone el nombre para aseverar el filtrado.
vi.mock("./_components", () => ({
  VoluntarioCard: ({ voluntario }: { voluntario: { nombre: string } }) => (
    <li>{voluntario.nombre}</li>
  ),
}));

import VoluntariosPage from "./page";

const lista = [
  { id: "v-jefe", nombre: "Ana", cedula: "V-1", telefono: "0414-1", rol: "JEFE", asignadoEn: "x" },
  { id: "v-vol", nombre: "Beto", cedula: "V-2", telefono: "0424-2", rol: "VOLUNTARIO", asignadoEn: "x" },
];

function setup({ rol = "JEFE", data = lista }: { rol?: string; data?: unknown } = {}) {
  mocks.useCentroDetalle.mockReturnValue({ data: { rol } });
  mocks.useVoluntarios.mockReturnValue({ data, isLoading: false, isError: false });
  return render(<VoluntariosPage />);
}

describe("VoluntariosPage", () => {
  it("bloquea la vista si el usuario no es JEFE", () => {
    setup({ rol: "VOLUNTARIO" });
    expect(screen.getByText(VOLUNTARIOS.soloJefeTitulo)).toBeTruthy();
    expect(screen.queryByText("Ana")).toBeNull();
  });

  it("lista a los voluntarios para el JEFE", () => {
    setup();
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Beto")).toBeTruthy();
    expect(screen.getByText(VOLUNTARIOS.subtitulo(2))).toBeTruthy();
  });

  it("filtra la lista por el término de búsqueda", () => {
    setup();
    fireEvent.change(screen.getByLabelText(VOLUNTARIOS.buscar), { target: { value: "bet" } });
    expect(screen.getByText("Beto")).toBeTruthy();
    expect(screen.queryByText("Ana")).toBeNull();
  });

  it("muestra el estado vacío cuando no hay voluntarios", () => {
    setup({ data: [] });
    expect(screen.getByText(VOLUNTARIOS.vacioTitulo)).toBeTruthy();
  });
});
