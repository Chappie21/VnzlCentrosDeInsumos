import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ImportarExcel from "./ImportarExcel";
import type { Sheet } from "../../../../lib/excel";
import type { InsumoRowItem } from "../../../../_components";

const sheets: Sheet[] = [
  {
    nombre: "Hoja1",
    filas: [
      ["Producto", "Stock", "Categoría"],
      ["Agua embotellada", "10", "agua"],
      ["Mantas", "5", "ropa"],
    ],
  },
];

describe("ImportarExcel", () => {
  it("prefija los dropdowns desde detectColumns", () => {
    render(<ImportarExcel sheets={sheets} onImport={() => {}} onCancel={() => {}} />);
    expect((screen.getByLabelText("Nombre *") as HTMLSelectElement).value).toBe("0");
    expect((screen.getByLabelText("Cantidad *") as HTMLSelectElement).value).toBe("1");
    expect((screen.getByLabelText("Categoría") as HTMLSelectElement).value).toBe("2");
  });

  it("al importar llama onImport con los items mapeados", () => {
    const onImport = vi.fn<(items: InsumoRowItem[]) => void>();
    render(<ImportarExcel sheets={sheets} onImport={onImport} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /importar 2 insumos/i }));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport.mock.calls[0][0]).toEqual([
      { nombre: "Agua embotellada", categoria: "AGUA", cantidad: 10 },
      { nombre: "Mantas", categoria: "ROPA", cantidad: 5 },
    ]);
  });

  it("Cancelar llama onCancel", () => {
    const onCancel = vi.fn();
    render(<ImportarExcel sheets={sheets} onImport={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
