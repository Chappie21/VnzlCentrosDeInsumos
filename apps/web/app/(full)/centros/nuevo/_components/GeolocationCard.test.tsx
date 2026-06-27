import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import GeolocationCard from "./GeolocationCard";

describe("GeolocationCard", () => {
  it("el botón dispara onRequest", () => {
    const onRequest = vi.fn();
    render(
      <GeolocationCard
        coords={null}
        denied={false}
        onRequest={onRequest}
        lat=""
        lng=""
      />,
    );
    fireEvent.click(screen.getByText("Obtener Ubicación Actual"));
    expect(onRequest).toHaveBeenCalledOnce();
  });

  it("renderiza lat/lng de solo lectura con sus valores", () => {
    render(
      <GeolocationCard
        coords={{ lat: 10.5, lng: -71.6 }}
        denied={false}
        onRequest={vi.fn()}
        lat="10.500000"
        lng="-71.600000"
      />,
    );
    expect((screen.getByDisplayValue("10.500000") as HTMLInputElement).readOnly).toBe(
      true,
    );
    expect(screen.getByDisplayValue("-71.600000")).toBeTruthy();
  });
});
