import { describe, expect, it } from "vitest";
import { summarizeUsage, type UsageEvent } from "./usage";

const ev = (event: string, created_at: string, duration_ms: number | null = null): UsageEvent => ({ event, created_at, duration_ms });

describe("summarizeUsage", () => {
  const events: UsageEvent[] = [
    ev("open", "2026-11-16T07:00:00Z"),
    ev("open", "2026-11-16T19:00:00Z"),
    ev("open", "2026-11-17T23:30:00Z"), // 18.11 i Oslo
    ev("quick_add:sheet", "2026-11-16T07:01:00Z", 3200),
    ev("quick_add:sheet", "2026-11-16T07:02:00Z", 4100),
    ev("quick_add:shortcut", "2026-11-17T08:00:00Z", 7000),
    ev("quick_add:page", "2026-11-17T08:00:00Z", null),
    ev("open", "2026-10-01T08:00:00Z"), // utenfor 28 dager
  ];
  const s = summarizeUsage(events, "2026-11-18");

  it("teller dager brukt i Oslo-tid de siste 28 dagene", () => {
    expect(s.daysUsed).toBe(3); // 16., 17. (via quick_add) og 18.
    expect(s.windowDays).toBe(28);
  });

  it("teller registreringer og median tid", () => {
    expect(s.quickAdds).toBe(4);
    expect(s.medianMs).toBe(4100);
    expect(s.under5sShare).toBeCloseTo(2 / 3);
  });

  it("dager på rad bakover fra i dag", () => {
    expect(s.streak).toBe(3);
  });

  it("per kilde", () => {
    expect(s.bySource).toEqual({ sheet: 2, shortcut: 1, page: 1 });
  });

  it("ingen hendelser", () => {
    expect(summarizeUsage([], "2026-11-18")).toMatchObject({ daysUsed: 0, quickAdds: 0, medianMs: null, under5sShare: null, streak: 0 });
  });

  it("rekken brytes av en dag uten bruk, men i dag kan mangle ennå", () => {
    const e = [ev("open", "2026-11-16T08:00:00Z"), ev("open", "2026-11-17T08:00:00Z")];
    expect(summarizeUsage(e, "2026-11-18").streak).toBe(2);
    expect(summarizeUsage(e, "2026-11-19").streak).toBe(0);
  });
});
