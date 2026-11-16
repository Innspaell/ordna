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
