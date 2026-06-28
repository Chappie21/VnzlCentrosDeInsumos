import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { VOLUNTARIOS } from "../../../../../constants";
import { RemoveConfirm } from "./index";

function renderConfirm(props: Partial<React.ComponentProps<typeof RemoveConfirm>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <RemoveConfirm
      nombre="Beto"
      pending={false}
      error={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
}

describe("RemoveConfirm", () => {
  it("confirmar invoca onConfirm", () => {
    const { onConfirm } = renderConfirm();
    fireEvent.click(screen.getByRole("button", { name: VOLUNTARIOS.confirmar }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancelar invoca onCancel sin confirmar", () => {
    const { onConfirm, onCancel } = renderConfirm();
    fireEvent.click(screen.getByRole("button", { name: VOLUNTARIOS.cancelar }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("muestra el error de remoción cuando error=true", () => {
    renderConfirm({ error: true });
    expect(screen.getByText(VOLUNTARIOS.errorRemover)).toBeTruthy();
  });
});
