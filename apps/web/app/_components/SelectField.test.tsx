import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SelectField from "./SelectField";

describe("SelectField", () => {
  it("renderiza label, placeholder y opciones", () => {
    render(
      <SelectField
        label="Estado"
        icon="map"
        placeholder="Elegí un estado"
        options={["Zulia", "Miranda"]}
      />,
    );
    expect(screen.getByLabelText("Estado")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Elegí un estado" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Zulia" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Miranda" })).toBeTruthy();
  });

  it("muestra el error cuando se pasa", () => {
    render(<SelectField label="Estado" icon="map" options={[]} error="Requerido" />);
    expect(screen.getByText("Requerido")).toBeTruthy();
  });
});
