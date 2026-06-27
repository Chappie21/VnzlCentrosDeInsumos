import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SearchBar from "./SearchBar";

describe("SearchBar", () => {
  it("escribir dispara onChange con el valor", () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "mara" } });
    expect(onChange).toHaveBeenCalledWith("mara");
  });
});
