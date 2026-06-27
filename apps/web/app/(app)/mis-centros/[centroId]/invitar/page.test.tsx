import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({ useParams: () => ({ centroId: "c1" }) }));
vi.mock("../../../../lib/api", () => ({
  crearInvitacion: vi.fn().mockResolvedValue({ token: "tok-123", expiresInMin: 60 }),
}));
// Expone el value del QR como texto para poder aseverarlo.
vi.mock("../../../../_components", () => ({
  Icon: () => null,
  Qr: ({ value }: { value: string }) => <div data-testid="qr">{value}</div>,
}));

import InvitarPage from "./page";

function renderWithClient() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <InvitarPage />
    </QueryClientProvider>,
  );
}

describe("InvitarPage", () => {
  it("renderiza un QR cuyo valor apunta a /unirse/", async () => {
    renderWithClient();
    const qr = await waitFor(() => screen.getByTestId("qr"));
    expect(qr.textContent).toContain("/unirse/tok-123");
  });
});
