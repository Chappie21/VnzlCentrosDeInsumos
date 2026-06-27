import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Qr from "./Qr";

describe("Qr", () => {
  it("renderiza un svg para el valor dado", () => {
    const { container } = render(<Qr value="hola-mundo" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
