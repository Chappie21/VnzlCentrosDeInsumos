import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ReportarSheet from "./ReportarSheet";

describe("ReportarSheet", () => {
  it("muestra los 3 motivos", () => {
    render(<ReportarSheet nombre="Centro X" onConfirmar={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Ya no está")).toBeTruthy();
    expect(screen.getByText("Info incorrecta")).toBeTruthy();
    expect(screen.getByText("Engañoso / falso")).toBeTruthy();
  });

  it("'Enviar' deshabilitado hasta elegir un motivo", () => {
    render(<ReportarSheet nombre="Centro X" onConfirmar={vi.fn()} onClose={vi.fn()} />);
    const btn = () => screen.getByRole("button", { name: /enviar reporte/i }) as HTMLButtonElement;
    expect(btn().disabled).toBe(true);
    fireEvent.click(screen.getByText("Ya no está"));
    expect(btn().disabled).toBe(false);
  });

  it("enviar llama onConfirmar con el motivo elegido", async () => {
    const onConfirmar = vi.fn().mockResolvedValue(undefined);
    render(<ReportarSheet nombre="Centro X" onConfirmar={onConfirmar} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Engañoso / falso"));
    fireEvent.click(screen.getByRole("button", { name: /enviar reporte/i }));
    await waitFor(() => expect(onConfirmar).toHaveBeenCalledWith("ENGANOSO", ""));
  });
});
