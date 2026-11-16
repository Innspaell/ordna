import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("godtar stier i appen", () => {
    expect(safeNextPath("/ny?tekst=Ring%20kunden")).toBe("/ny?tekst=Ring%20kunden");
    expect(safeNextPath("/prosjekter")).toBe("/prosjekter");
  });
  it("sender alt annet til forsiden", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
  });
});
