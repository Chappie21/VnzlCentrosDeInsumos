import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import RecepcionList from "./RecepcionList";
import type { ScannedItem } from "../../../lib/recepcion";

const agua = (validado: boolean): ScannedItem => ({
  nombre: "Agua embotellada",
  categoria: "AGUA",
  cantidad: 5,
  validado,
});

describe("RecepcionList", () => {
  it("'Confirmar' deshabilitado sin validados, habilitado con al menos uno", () => {
    const { rerender } = render(
      <RecepcionList items={[agua(false)]} onChange={() => {}} onConfirm={() => {}} />,
    );
    const btn = () => screen.getByRole("button", { name: /confirmar e ingresar/i }) as HTMLButtonElement;
    expect(btn().disabled).toBe(true);

    rerender(<RecepcionList items={[agua(true)]} onChange={() => {}} onConfirm={() => {}} />);
    expect(btn().disabled).toBe(false);
  });

  it("togglear 'Validar' emite onChange con el item validado", () => {
    const onChange = vi.fn();
    render(<RecepcionList items={[agua(false)]} onChange={onChange} onConfirm={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /^validar/i }));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ validado: true })]);
  });

  it("muestra el resumen de los validados (unidades y categorías)", () => {
    render(<RecepcionList items={[agua(true)]} onChange={() => {}} onConfirm={() => {}} />);
    const resumen = screen.getByTestId("resumen-recepcion").textContent ?? "";
    expect(resumen).toContain("5");
    expect(resumen).toContain("1");
  });

  it("'Confirmar' dispara onConfirm", () => {
    const onConfirm = vi.fn();
    render(<RecepcionList items={[agua(true)]} onChange={() => {}} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: /confirmar e ingresar/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("quitar un item emite onChange sin ese item", () => {
    const onChange = vi.fn();
    render(<RecepcionList items={[agua(true)]} onChange={onChange} onConfirm={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /quitar/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
