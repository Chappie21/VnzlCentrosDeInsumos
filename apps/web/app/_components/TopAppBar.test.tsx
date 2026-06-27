import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TopAppBar from "./TopAppBar";

describe("TopAppBar", () => {
  it("muestra el título y dispara onMenu", () => {
    const onMenu = vi.fn();
    render(<TopAppBar onMenu={onMenu} />);
    expect(screen.getByText("RESPONSE CORE")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Menú"));
    expect(onMenu).toHaveBeenCalledOnce();
  });
});
