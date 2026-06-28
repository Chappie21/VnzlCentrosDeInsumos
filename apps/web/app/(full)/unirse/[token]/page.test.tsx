import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "tok-123" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("../../../lib/identity", () => ({
  hasFullIdentity: () => true,
  syncIdentity: vi.fn(),
}));
vi.mock("../../../lib/api", () => ({
  aceptarInvitacion: vi.fn().mockResolvedValue({ centroId: "c1", nombre: "Centro Norte" }),
}));
vi.mock("../../../_components", () => ({ Icon: () => null }));

import UnirsePage from "./page";

function renderWithClient() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <UnirsePage />
    </QueryClientProvider>,
  );
}

describe("UnirsePage", () => {
  it("muestra el nombre del centro al aceptar la invitación", async () => {
    renderWithClient();
    await waitFor(() => expect(screen.getByText("Te uniste a Centro Norte")).toBeTruthy());
  });
});
