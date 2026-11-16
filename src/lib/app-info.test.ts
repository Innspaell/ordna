import { describe, expect, it } from "vitest";
import { APP_NAME } from "./app-info";

describe("app-info", () => {
  it("har riktig navn", () => {
    expect(APP_NAME).toBe("Ordna");
  });
});
