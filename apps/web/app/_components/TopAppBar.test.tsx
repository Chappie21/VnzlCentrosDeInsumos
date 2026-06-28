import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...p }: any) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
}));

import TopAppBar from "./TopAppBar";

describe("TopAppBar", () => {
  it("muestra el título y dispara onMenu", () => {
    const onMenu = vi.fn();
    render(<TopAppBar onMenu={onMenu} />);
    expect(screen.getByText("Red Acopio Venezuela")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Menú"));
    expect(onMenu).toHaveBeenCalledOnce();
  });

  it("el burger abre un menú con 'Volver al inicio' hacia /", () => {
    render(<TopAppBar />);
    expect(screen.queryByRole("link", { name: /volver al inicio/i })).toBeNull();

    fireEvent.click(screen.getByLabelText("Menú"));
    const link = screen.getByRole("link", { name: /volver al inicio/i });
    expect(link.getAttribute("href")).toBe("/");
  });

  it("el menú se cierra al elegir una opción", () => {
    render(<TopAppBar />);
    fireEvent.click(screen.getByLabelText("Menú"));
    fireEvent.click(screen.getByRole("link", { name: /volver al inicio/i }));
    expect(screen.queryByRole("link", { name: /volver al inicio/i })).toBeNull();
  });
});
