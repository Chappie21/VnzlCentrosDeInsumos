import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CargaInventario from "./CargaInventario";

describe("CargaInventario", () => {
  it("'Cargar' deshabilitado sin items válidos; habilitado al completar", () => {
    render(<CargaInventario onConfirmar={() => {}} />);
    const btn = () =>
      screen.getByRole("button", { name: /cargar al inventario/i }) as HTMLButtonElement;
    expect(btn().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/nombre del insumo/i), { target: { value: "Agua" } });
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: "5" } });
    expect(btn().disabled).toBe(false);
  });

  it("confirmar emite los items válidos (categoría vacía → null)", () => {
    const onConfirmar = vi.fn();
    render(<CargaInventario onConfirmar={onConfirmar} />);
    fireEvent.change(screen.getByLabelText(/nombre del insumo/i), { target: { value: "Agua" } });
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /cargar al inventario/i }));
    expect(onConfirmar).toHaveBeenCalledWith([{ nombre: "Agua", categoria: null, cantidad: 5 }]);
  });

  it("agregar fila suma otra entrada", () => {
    render(<CargaInventario onConfirmar={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /agregar fila/i }));
    expect(screen.getAllByLabelText(/nombre del insumo/i)).toHaveLength(2);
  });
});
