import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import NeedBadge from "./NeedBadge";

describe("NeedBadge", () => {
  it("URGENTE -> rojo (emergency) y muestra label + ícono de categoría", () => {
    const { container } = render(
      <NeedBadge necesidad={{ nombre: "Agua", nivel: "URGENTE", categoria: "AGUA" }} />,
    );
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-emergency");
    expect(badge.textContent).toContain("Agua");
    expect(badge.textContent).toContain("water_drop"); // ícono Material
  });

  it("SUFICIENTE -> azul (safety)", () => {
    const { container } = render(
      <NeedBadge necesidad={{ nombre: "Ropa", nivel: "SUFICIENTE", categoria: "ROPA" }} />,
    );
    expect((container.firstChild as HTMLElement).className).toContain("bg-safety");
  });

  it("categoría desconocida/null -> ícono fallback", () => {
    const { container } = render(
      <NeedBadge necesidad={{ nombre: "Otro", nivel: "NORMAL", categoria: null }} />,
    );
    expect(container.textContent).toContain("inventory_2");
  });
});
