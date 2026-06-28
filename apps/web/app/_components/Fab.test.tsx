import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Fab from "./Fab";

describe("Fab", () => {
  it("muestra el label y dispara onClick", () => {
    const onClick = vi.fn();
    render(<Fab icon="add" label="Agregar" onClick={onClick} />);
    fireEvent.click(screen.getByText("Agregar"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
