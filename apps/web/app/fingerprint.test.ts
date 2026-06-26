import { beforeEach, describe, it, expect } from "vitest";
import { getFingerprint } from "./fingerprint";

beforeEach(() => {
  localStorage.clear();
});

describe("getFingerprint", () => {
  it("returns a non-empty string", () => {
    const fp = getFingerprint();
    expect(typeof fp).toBe("string");
    expect(fp.length).toBeGreaterThan(0);
  });

  it("persists the value in localStorage under 'fingerprint'", () => {
    const fp = getFingerprint();
    expect(localStorage.getItem("fingerprint")).toBe(fp);
  });

  it("is stable across calls", () => {
    const first = getFingerprint();
    const second = getFingerprint();
    expect(second).toBe(first);
  });
});
