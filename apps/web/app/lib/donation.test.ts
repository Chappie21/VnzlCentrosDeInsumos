import { describe, expect, test } from "vitest";
import {
  encodeDonation,
  decodeDonation,
  totalUnidades,
  type DonationItem,
} from "./donation";

const items: DonationItem[] = [
  { nombre: "Agua embotellada", categoria: "AGUA", cantidad: 5 },
  { nombre: "Cajas de Analgésicos", categoria: "MEDICAMENTOS", cantidad: 2 },
];

describe("donation payload", () => {
  test("encode→decode round-trips the exact items", () => {
    expect(decodeDonation(encodeDonation(items))).toEqual(items);
  });

  test("acepta categoria null", () => {
    const sinCat: DonationItem[] = [{ nombre: "Varios", categoria: null, cantidad: 1 }];
    expect(decodeDonation(encodeDonation(sinCat))).toEqual(sinCat);
  });

  test("totalUnidades suma las cantidades", () => {
    expect(totalUnidades(items)).toBe(7);
  });

  test("decode rechaza JSON inválido", () => {
    expect(() => decodeDonation("no-json")).toThrow();
  });

  test("decode rechaza versión desconocida", () => {
    expect(() => decodeDonation(JSON.stringify({ v: 99, items: [] }))).toThrow();
  });

  test("decode rechaza cantidad < 1", () => {
    const bad = JSON.stringify({ v: 1, items: [{ n: "X", c: null, q: 0 }] });
    expect(() => decodeDonation(bad)).toThrow();
  });

  test("decode rechaza cantidad no entera", () => {
    const bad = JSON.stringify({ v: 1, items: [{ n: "X", c: null, q: 1.5 }] });
    expect(() => decodeDonation(bad)).toThrow();
  });

  test("decode rechaza nombre vacío", () => {
    const bad = JSON.stringify({ v: 1, items: [{ n: " ", c: null, q: 1 }] });
    expect(() => decodeDonation(bad)).toThrow();
  });

  test("decode rechaza categoria desconocida", () => {
    const bad = JSON.stringify({ v: 1, items: [{ n: "X", c: "ORO", q: 1 }] });
    expect(() => decodeDonation(bad)).toThrow();
  });

  test("decode rechaza lista vacía", () => {
    expect(() => decodeDonation(JSON.stringify({ v: 1, items: [] }))).toThrow();
  });
});
