import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";

// Mock de Leaflet y assets: jsdom no puede inicializar un mapa real.
vi.mock("leaflet/dist/leaflet.css", () => ({}));
vi.mock("leaflet", () => ({
  default: { divIcon: vi.fn(() => ({})) },
}));
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile" />,
  Marker: () => <div data-testid="marker" />,
  useMap: () => ({ setView: vi.fn(), getZoom: () => 13 }),
  useMapEvents: () => null,
}));

import Map from "./Map";

describe("Map", () => {
  it("muestra el marcador solo cuando hay un punto", () => {
    const { rerender } = render(<Map value={null} onChange={vi.fn()} />);
    expect(screen.getByTestId("map")).toBeTruthy();
    expect(screen.queryByTestId("marker")).toBeNull();

    rerender(<Map value={{ lat: 10.5, lng: -66.9 }} onChange={vi.fn()} />);
    expect(screen.getByTestId("marker")).toBeTruthy();
  });
});
