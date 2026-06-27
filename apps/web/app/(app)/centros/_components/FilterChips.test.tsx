import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import FilterChips from "./FilterChips";
import { FILTERS } from "../../../constants";

const allOff = {
  [FILTERS.cerca]: false,
  [FILTERS.abiertos]: false,
  [FILTERS.urgencia]: false,
};

describe("FilterChips", () => {
  it("click en un chip llama onToggle con su id", () => {
    const onToggle = vi.fn();
    render(<FilterChips active={allOff} onToggle={onToggle} />);
    fireEvent.click(screen.getByText("Cerca de mí"));
    expect(onToggle).toHaveBeenCalledWith(FILTERS.cerca);
  });

  it("chip activo recibe el estilo activo", () => {
    render(<FilterChips active={{ ...allOff, [FILTERS.urgencia]: true }} onToggle={() => {}} />);
    const chip = screen.getByText("Urgencia Alta").closest("button")!;
    expect(chip.className).toContain("bg-primary-container");
    expect(chip.getAttribute("aria-pressed")).toBe("true");
  });
});
