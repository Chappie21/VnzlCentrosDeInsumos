import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("renderiza título y subtítulo", () => {
    render(<EmptyState title="Sin resultados" subtitle="Probá de nuevo" />);
    expect(screen.getByText("Sin resultados")).toBeTruthy();
    expect(screen.getByText("Probá de nuevo")).toBeTruthy();
  });
});
