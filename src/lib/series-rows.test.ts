import { describe, expect, it } from "vitest";
import { seriesRows, templateOf } from "./series-rows";

const appt = {
  workspace_id: "ws", project_id: null, parent_id: null, kind: "appointment" as const, title: "Fotball", notes: null, location: "Stadion",
  starts_at: "2026-11-24T16:30:00Z", ends_at: "2026-11-24T18:00:00Z", all_day: false, due_date: null, pick_context: null, is_pickable: false, in_inbox: false,
};

describe("seriesRows", () => {
  it("avtaler: samme klokkeslett i Oslo på hver dato, også over sommertid-skiftet", () => {
    const rows = seriesRows(templateOf(appt), ["2027-03-23", "2027-03-30"], "s1");
    expect(rows.map((r) => [r.starts_at, r.ends_at, r.occurrence_date])).toEqual([
      ["2027-03-23T16:30:00.000Z", "2027-03-23T18:00:00.000Z", "2027-03-23"],
      ["2027-03-30T15:30:00.000Z", "2027-03-30T17:00:00.000Z", "2027-03-30"],
    ]);
    expect(rows.every((r) => r.series_id === "s1" && r.title === "Fotball" && r.location === "Stadion" && r.status === "ready")).toBe(true);
  });

  it("hele dagen: start 00:00 Oslo, ingen slutt", () => {
    const rows = seriesRows(templateOf({ ...appt, all_day: true, starts_at: "2026-11-23T23:00:00Z", ends_at: null }), ["2027-03-05"], "s1");
    expect(rows[0]).toMatchObject({ starts_at: "2027-03-04T23:00:00.000Z", ends_at: null, all_day: true });
  });

  it("oppgaver: frist = datoen, ikke i innboksen", () => {
    const task = { ...appt, kind: "task" as const, starts_at: null, ends_at: null, due_date: "2026-11-18", in_inbox: true };
    const rows = seriesRows(templateOf(task), ["2026-11-18", "2026-11-19"], "s2");
    expect(rows.map((r) => [r.due_date, r.starts_at, r.in_inbox])).toEqual([["2026-11-18", null, false], ["2026-11-19", null, false]]);
  });
});
