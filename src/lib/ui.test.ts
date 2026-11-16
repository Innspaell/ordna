import { describe, expect, it } from "vitest";
import { GROUP_COLORS, NO_PROJECT_COLOR, projectColor, STATUS, taskStatusKey } from "./ui";

describe("taskStatusKey", () => {
  const today = "2026-11-16";
  it("status fra databasen", () => {
    expect(taskStatusKey("ready", null, today)).toBe("ready");
    expect(taskStatusKey("in_progress", null, today)).toBe("in_progress");
    expect(taskStatusKey("waiting", null, today)).toBe("waiting");
    expect(taskStatusKey("done", null, today)).toBe("done");
  });
  it("forfalt vinner over klar og under arbeid, men ikke over fullført", () => {
    expect(taskStatusKey("ready", "2026-11-15", today)).toBe("overdue");
    expect(taskStatusKey("in_progress", "2026-11-01", today)).toBe("overdue");
    expect(taskStatusKey("done", "2026-11-01", today)).toBe("done");
  });
  it("frist i dag er ikke forfalt", () => {
    expect(taskStatusKey("ready", today, today)).toBe("ready");
  });
  it("avbrutt vises som avbrutt", () => {
    expect(taskStatusKey("cancelled", "2026-11-01", today)).toBe("cancelled");
  });
});

describe("STATUS", () => {
  it("har norske navn og farger", () => {
    expect(STATUS.ready.label).toBe("Klar");
    expect(STATUS.in_progress.label).toBe("Under arbeid");
    expect(STATUS.waiting.label).toBe("Venter");
    expect(STATUS.done.label).toBe("Fullført");
    expect(STATUS.overdue.label).toBe("Forfalt");
    for (const s of Object.values(STATUS)) expect(s.bg).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("projectColor", () => {
  it("samme id gir alltid samme farge fra paletten", () => {
    const a = projectColor("3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90");
    expect(projectColor("3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90")).toBe(a);
    expect(GROUP_COLORS).toContain(a);
  });
  it("ulike id-er sprer seg over paletten", () => {
    const ids = Array.from({ length: 40 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    expect(new Set(ids.map(projectColor)).size).toBeGreaterThan(4);
  });
  it("uten prosjekt er grå", () => {
    expect(projectColor(null)).toBe(NO_PROJECT_COLOR);
  });
});
