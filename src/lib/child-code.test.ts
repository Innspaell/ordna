import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, formatCode, generateCode, hashCode, normalizeCode } from "./child-code";

describe("barnekoder", () => {
  it("8 tegn uten forvekslbare tegn, vist som XXXX-XXXX", () => {
    const c = generateCode();
    expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    for (const ch of c.replace("-", "")) expect(CODE_ALPHABET).toContain(ch);
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("koder er forskjellige", () => {
    expect(new Set(Array.from({ length: 50 }, generateCode)).size).toBe(50);
  });

  it("normaliserer det barnet skriver", () => {
    expect(normalizeCode(" abcd efgh ")).toBe("ABCDEFGH");
    expect(normalizeCode("abcd-efgh")).toBe("ABCDEFGH");
    expect(normalizeCode("abc")).toBeNull();
    expect(normalizeCode("ABCD-EFG0")).toBeNull();
  });

  it("formatCode og hashCode", () => {
    expect(formatCode("ABCDEFGH")).toBe("ABCD-EFGH");
    expect(hashCode("ABCDEFGH")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCode("ABCDEFGH")).toBe(hashCode("ABCDEFGH"));
    expect(hashCode("ABCDEFGH")).not.toBe(hashCode("ABCDEFGJ"));
  });
});
