import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import TextAreaField from "./TextAreaField";

describe("TextAreaField", () => {
  it("renderiza label y placeholder", () => {
    render(<TextAreaField label="Dirección completa" placeholder="Calle, Número" />);
    expect(screen.getByText("Dirección completa")).toBeTruthy();
    expect(screen.getByPlaceholderText("Calle, Número")).toBeTruthy();
  });

  it("muestra el texto de error cuando se pasa error", () => {
    render(<TextAreaField label="Dirección completa" error="Demasiado corta." />);
    expect(screen.getByText("Demasiado corta.")).toBeTruthy();
  });
});
