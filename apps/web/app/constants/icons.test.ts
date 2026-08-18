import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ICON_NAMES } from "./icons";

// layout.tsx pide a Google solo los glifos de ICON_NAMES. Si alguien agrega un
// <Icon name="foo" /> sin sumarlo a la lista, el subset no lo trae y en pantalla
// aparece el texto "foo". El tipo IconName agarra la mayoría de los casos; este
// test cubre el resto (constantes con `icon:`, spans crudos con la clase).
// jsdom reescribe import.meta.url a http://, así que se ancla en el cwd de vitest.
const APP_DIR = join(process.cwd(), "app") + "/";

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

function usedIcons(): Map<string, string> {
  const used = new Map<string, string>();
  for (const file of sourceFiles(APP_DIR)) {
    const src = readFileSync(file, "utf8");
    const rel = file.slice(APP_DIR.length);
    // <Icon ... /> incluyendo ternarios: name={x ? "a" : "b"}
    for (const tag of src.matchAll(/<Icon\b[\s\S]*?\/?>/g)) {
      for (const lit of tag[0].matchAll(/"([a-z0-9_]+)"/g)) used.set(lit[1], rel);
    }
    // prop o campo `icon`/`icono`: icon: "x", icon="x", icon = "x"
    for (const m of src.matchAll(/\bicon[oa]?\??\s*[:=]\s*"([a-z0-9_]+)"/g)) used.set(m[1], rel);
    // mapas de iconos (CATEGORIA_ICON, ...): todo literal dentro de un const con ICON
    // en el nombre cuenta como icono, sin importar la clave.
    for (const decl of src.split(/\n(?=(?:export )?const )/)) {
      const name = decl.match(/^(?:export )?const (\w+)/)?.[1];
      if (!name || !/ICON/i.test(name)) continue;
      for (const lit of decl.matchAll(/"([a-z0-9_]+)"/g)) used.set(lit[1], rel);
    }
    // spans crudos con la clase, sin pasar por <Icon />
    for (const m of src.matchAll(/material-symbols-outlined[^>]*>\s*([a-z0-9_]+)\s*</g)) {
      used.set(m[1], rel);
    }
  }
  return used;
}

describe("ICON_NAMES", () => {
  it("cubre todos los iconos que usa el código", () => {
    const allowed = new Set<string>(ICON_NAMES);
    const missing = [...usedIcons()]
      .filter(([name]) => !allowed.has(name))
      .map(([name, file]) => `${name} (${file})`);
    expect(missing, "agregalos a app/constants/icons.ts").toEqual([]);
  });

  it("está ordenada y sin duplicados", () => {
    expect([...ICON_NAMES]).toEqual([...new Set(ICON_NAMES)].sort());
  });
});
