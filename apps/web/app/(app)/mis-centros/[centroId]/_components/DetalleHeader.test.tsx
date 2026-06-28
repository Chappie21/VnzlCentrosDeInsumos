import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DetalleHeader from "./DetalleHeader";
import type { CentroDetalle } from "../../../../lib/api";

const base: Omit<CentroDetalle, "rol"> = {
  id: "c1",
  nombre: "Centro Norte",
  estado: "Zulia",
  ciudad: "Maracaibo",
  direccion: "Av. 5",
  latitud: null,
  longitud: null,
  recibiendoAhora: true,
  horarioCierre: null,
  verificacion: "PENDIENTE",
  fotoUrl: null,
  voluntarios: 3,
  donaciones: 0,
  insumos: [],
};

describe("DetalleHeader", () => {
  it("muestra el lápiz de editar solo al JEFE", () => {
    render(<DetalleHeader centro={{ ...base, rol: "JEFE" }} />);
    expect(screen.getByLabelText("Editar datos del centro").getAttribute("href")).toBe(
      "/mis-centros/c1/editar",
    );
  });

  it("oculta el lápiz de editar al VOLUNTARIO", () => {
    render(<DetalleHeader centro={{ ...base, rol: "VOLUNTARIO" }} />);
    expect(screen.queryByLabelText("Editar datos del centro")).toBeNull();
  });
});
