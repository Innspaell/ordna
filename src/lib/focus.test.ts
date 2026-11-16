import { describe, expect, it } from "vitest";
import { FOCUS_LIMIT, focusDecision, parseContextFilter } from "./focus";

describe("focusDecision", () => {
  it("under grensen: lov å plukke", () => {
    expect(focusDecision([], "a")).toBe("ok");
    expect(focusDecision(["a", "b"], "c")).toBe("ok");
  });

  it("allerede i fokus: ingenting å gjøre", () => {
    expect(focusDecision(["a", "b", "c"], "a")).toBe("already");
  });

  it("tre i fokus: fullt", () => {
    expect(FOCUS_LIMIT).toBe(3);
    expect(focusDecision(["a", "b", "c"], "d")).toBe("full");
  });
});

describe("parseContextFilter", () => {
  it("kjente steder godtas, alt annet betyr alle", () => {
    expect(parseContextFilter("home")).toBe("home");
    expect(parseContextFilter("outside")).toBe("outside");
    expect(parseContextFilter("kjeller")).toBeNull();
    expect(parseContextFilter(undefined)).toBeNull();
  });
});
