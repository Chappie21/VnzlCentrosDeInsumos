import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

let mockPath = "/centros";
vi.mock("next/navigation", () => ({ usePathname: () => mockPath }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...p }: any) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
}));
// Anónimo sin identidad completa.
vi.mock("../lib/identity", () => ({ hasFullIdentity: () => false }));

import BottomNav from "./BottomNav";

describe("BottomNav", () => {
  beforeEach(() => {
    mockPath = "/centros";
  });

  it("oculta tabs de operador (Mi Centro, Escanear) para anónimo", () => {
    render(<BottomNav />);
    expect(screen.getByText("Centros")).toBeTruthy();
    expect(screen.getByText("Mapa")).toBeTruthy();
    expect(screen.queryByText("Mi Centro")).toBeNull();
    expect(screen.queryByText("Escanear")).toBeNull();
  });

  it("marca como activa la tab de la ruta actual", () => {
    render(<BottomNav />);
    const link = screen.getByText("Centros").closest("a")!;
    expect(link.className).toContain("bg-primary-container");
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("no se renderiza en flujos enfocados como /donar", () => {
    mockPath = "/donar";
    const { container } = render(<BottomNav />);
    expect(container.querySelector("nav")).toBeNull();
  });
});
