import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SuccessView from "./SuccessView";

describe("SuccessView", () => {
  it("muestra el nombre del centro y el badge ACTIVO", () => {
    render(
      <SuccessView
        centroNombre="Centro Deportivo Municipal"
        onVerCentro={vi.fn()}
        onInvitar={vi.fn()}
      />,
    );
    expect(screen.getByText("Centro Deportivo Municipal")).toBeTruthy();
    expect(screen.getByText("Activo")).toBeTruthy();
  });

  it("ambos botones disparan sus callbacks", () => {
    const onVerCentro = vi.fn();
    const onInvitar = vi.fn();
    render(
      <SuccessView
        centroNombre="Centro Deportivo Municipal"
        onVerCentro={onVerCentro}
        onInvitar={onInvitar}
      />,
    );
    fireEvent.click(screen.getByText("Ver mi Centro de Acopio"));
    fireEvent.click(screen.getByText("Invitar Ayudantes"));
    expect(onVerCentro).toHaveBeenCalledOnce();
    expect(onInvitar).toHaveBeenCalledOnce();
  });
});
