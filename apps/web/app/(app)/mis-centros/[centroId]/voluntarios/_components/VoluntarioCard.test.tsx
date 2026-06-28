import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VOLUNTARIOS } from "../../../../../constants";

const api = vi.hoisted(() => ({ removerVoluntario: vi.fn() }));
vi.mock("../../../../../lib/api", () => ({ removerVoluntario: api.removerVoluntario }));

import { VoluntarioCard } from "./index";
import type { VoluntarioItem } from "../../../../../lib/api";

const voluntario: VoluntarioItem = {
  id: "v-1", nombre: "Beto", cedula: "V-2", telefono: "0424-2",
  rol: "VOLUNTARIO", asignadoEn: "x",
};

function renderCard(v = voluntario) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ul>
        <VoluntarioCard centroId="c1" voluntario={v} />
      </ul>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("VoluntarioCard", () => {
  it("muestra el botón remover para un VOLUNTARIO", () => {
    renderCard();
    expect(screen.getByLabelText(VOLUNTARIOS.removerAria("Beto"))).toBeTruthy();
  });

  it("oculta el botón remover para el JEFE", () => {
    renderCard({ ...voluntario, nombre: "Ana", rol: "JEFE" });
    expect(screen.queryByLabelText(VOLUNTARIOS.removerAria("Ana"))).toBeNull();
  });

  it("confirmar dispara la remoción con el Voluntario.id", async () => {
    api.removerVoluntario.mockResolvedValue(undefined);
    renderCard();

    fireEvent.click(screen.getByLabelText(VOLUNTARIOS.removerAria("Beto")));
    fireEvent.click(screen.getByRole("button", { name: VOLUNTARIOS.confirmar }));

    await waitFor(() => expect(api.removerVoluntario).toHaveBeenCalledWith("c1", "v-1"));
  });
});
