import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import InventarioResumen from "./InventarioResumen";
import type { InsumoDetalle, RolCentro } from "../../../../lib/api";

const insumos: InsumoDetalle[] = [
  { id: "i1", nombre: "Agua", descripcion: null, nivel: "NORMAL", categoria: null, cantidadTotal: 10 },
];

function renderWith(rol: RolCentro) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <InventarioResumen insumos={insumos} rol={rol} centroId="c1" />
    </QueryClientProvider>,
  );
}

describe("InventarioResumen", () => {
  it("muestra el control 'Ajustar' al JEFE", () => {
    renderWith("JEFE");
    expect(screen.getByRole("button", { name: /ajustar/i })).toBeTruthy();
  });

  it("oculta el control 'Ajustar' al VOLUNTARIO", () => {
    renderWith("VOLUNTARIO");
    expect(screen.queryByRole("button", { name: /ajustar/i })).toBeNull();
  });
});
