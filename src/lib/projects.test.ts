import { describe, expect, it } from "vitest";
import { sortProjects } from "./projects";

describe("sortProjects", () => {
  it("frist først, uten frist nederst, så navn", () => {
    const rows = [
      { id: "1", name: "Ølbrygging", due_date: null },
      { id: "2", name: "Bryllupsvideo", due_date: "2027-08-01" },
      { id: "3", name: "Årsrapport", due_date: null },
      { id: "4", name: "UKErevyen", due_date: "2026-11-22" },
      { id: "5", name: "Arkiv", due_date: null },
    ];
    expect(sortProjects(rows).map((r) => r.name)).toEqual(["UKErevyen", "Bryllupsvideo", "Arkiv", "Ølbrygging", "Årsrapport"]);
  });
});

import { nextUp, type NextItem } from "./projects";

describe("nextUp", () => {
  const now = "2026-11-16T12:00:00Z";
  const today = "2026-11-16";
  let n = 0;
  const it_ = (p: Partial<NextItem> & Pick<NextItem, "kind" | "title">): NextItem => ({
    status: "ready",
    due_date: null,
    starts_at: null,
    sort_order: n++,
    created_at: "2026-11-16T10:00:00Z",
    ...p,
  });

  it("forfalte vinner", () => {
    expect(nextUp([it_({ kind: "task", title: "A", due_date: "2026-11-10" }), it_({ kind: "task", title: "B", status: "in_progress" })], now, today)).toEqual({
      kind: "overdue",
      count: 1,
    });
  });

  it("så det som er under arbeid", () => {
    expect(nextUp([it_({ kind: "task", title: "Finklipp" }), it_({ kind: "task", title: "Grovklipp", status: "in_progress" })], now, today)).toEqual({
      kind: "task",
      title: "Grovklipp",
      inProgress: true,
    });
  });

  it("så neste avtale (ikke passerte)", () => {
    const items = [
      it_({ kind: "appointment", title: "Ferdig", starts_at: "2026-11-15T10:00:00Z" }),
      it_({ kind: "appointment", title: "Redigering", starts_at: "2026-11-22T09:00:00Z" }),
      it_({ kind: "appointment", title: "Skrivekurs", starts_at: "2026-11-21T11:00:00Z" }),
    ];
    expect(nextUp(items, now, today)).toEqual({ kind: "appointment", title: "Skrivekurs", startsAt: "2026-11-21T11:00:00Z" });
  });

  it("så første åpne oppgave, med frist før uten", () => {
    const items = [it_({ kind: "task", title: "Uten frist" }), it_({ kind: "task", title: "Med frist", due_date: "2026-12-01" }), it_({ kind: "task", title: "Ferdig", status: "done" })];
    expect(nextUp(items, now, today)).toEqual({ kind: "task", title: "Med frist", inProgress: false });
  });

  it("ingenting igjen", () => {
    expect(nextUp([it_({ kind: "task", title: "Ferdig", status: "done" })], now, today)).toBeNull();
  });
});
