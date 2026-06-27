import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DonacionForm from "./DonacionForm";

describe("DonacionForm", () => {
  it("deshabilita 'Generar' hasta que haya un insumo válido", () => {
    render(<DonacionForm />);
    const generar = screen.getByRole("button", { name: /generar qr/i });
    expect((generar as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/nombre del insumo/i), {
      target: { value: "Agua embotellada" },
    });
    expect((generar as HTMLButtonElement).disabled).toBe(false);
  });

  it("genera el QR con el resumen exacto de la donación", () => {
    render(<DonacionForm />);
    fireEvent.change(screen.getByLabelText(/nombre del insumo/i), {
      target: { value: "Agua embotellada" },
    });
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /generar qr/i }));

    expect(document.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("Agua embotellada")).toBeTruthy();
    expect(screen.getByText("5×")).toBeTruthy();
  });

  it("suma el total de unidades de todos los insumos", () => {
    render(<DonacionForm />);
    fireEvent.change(screen.getByLabelText(/nombre del insumo/i), {
      target: { value: "Agua" },
    });
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /agregar.*insumo/i }));

    const nombres = screen.getAllByLabelText(/nombre del insumo/i);
    fireEvent.change(nombres[1], { target: { value: "Mantas" } });
    const cantidades = screen.getAllByLabelText(/cantidad/i);
    fireEvent.change(cantidades[1], { target: { value: "4" } });

    expect(screen.getByTestId("total-unidades").textContent).toContain("7");
  });
});
