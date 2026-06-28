import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import InventarioInicialForm from "./InventarioInicialForm";

function setup() {
  const onSubmit = vi.fn();
  const onBack = vi.fn();
  render(
    <InventarioInicialForm onSubmit={onSubmit} onBack={onBack} pending={false} apiError={null} />,
  );
  return { onSubmit, onBack };
}

describe("InventarioInicialForm", () => {
  it("no permite registrar mientras haya un item con nombre vacío", () => {
    setup();
    const registrar = screen.getByRole("button", { name: /registrar centro/i });
    expect((registrar as HTMLButtonElement).disabled).toBe(true);
  });

  it("habilita registrar y envía los insumos cargados", () => {
    const { onSubmit } = setup();
    fireEvent.change(screen.getByLabelText(/nombre del insumo/i), {
      target: { value: "Agua" },
    });
    const registrar = screen.getByRole("button", { name: /registrar centro/i });
    expect((registrar as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(registrar);
    expect(onSubmit).toHaveBeenCalledWith([{ nombre: "Agua", cantidad: 1 }]);
  });

  it("con min=0 la cantidad puede llegar a 0", () => {
    setup();
    fireEvent.click(screen.getByLabelText("Restar")); // 1 -> 0
    expect((screen.getByLabelText("Cantidad") as HTMLInputElement).value).toBe("0");
  });

  it("'Omitir' envía sin insumos", () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole("button", { name: /omitir/i }));
    expect(onSubmit).toHaveBeenCalledWith([]);
  });
});
