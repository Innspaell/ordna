import { describe, expect, it } from "vitest";
import { buildWeek, isoWeek, parseWeekParam, weekStart, type WeekItem } from "./week";

let n = 0;
const item = (p: Partial<WeekItem> & Pick<WeekItem, "kind" | "title">): WeekItem => ({
  id: `i${++n}`,
  status: "ready",
  due_date: null,
  focus_date: null,
  starts_at: null,
  ends_at: null,
  all_day: false,
  project_id: null,
  project_name: null,
  ...p,
});

describe("hjelpere", () => {
  it("weekStart gir mandagen", () => {
    expect(weekStart("2026-11-16")).toBe("2026-11-16");
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
    expect(weekStart("2026-11-19")).toBe("2026-11-16");
  });
  it("isoWeek", () => {
    expect(isoWeek("2026-11-16")).toBe(47);
    expect(isoWeek("2027-01-01")).toBe(53);
    expect(isoWeek("2027-01-04")).toBe(1);
  });
  it("parseWeekParam godtar en dato og går til mandagen, ellers denne uka", () => {
    expect(parseWeekParam("2026-11-20", "2026-11-16")).toBe("2026-11-16");
    expect(parseWeekParam("tull", "2026-11-18")).toBe("2026-11-16");
    expect(parseWeekParam(undefined, "2026-11-18")).toBe("2026-11-16");
  });
});

describe("buildWeek", () => {
  const start = "2026-11-16";
  const today = "2026-11-16";

  it("sju dager, i dag markert", () => {
    const w = buildWeek([], start, today);
    expect(w.days.map((d) => d.num)).toEqual([16, 17, 18, 19, 20, 21, 22]);
    expect(w.days.map((d) => d.wd)).toEqual(["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"]);
    expect(w.days[0].isToday).toBe(true);
    expect(w.week).toBe(47);
  });

  it("avtaler havner på riktig dag i Oslo-tid", () => {
    const w = buildWeek(
      [
        item({ kind: "appointment", title: "Skrivekurs", starts_at: "2026-11-21T11:00:00Z", ends_at: "2026-11-21T19:00:00Z", project_id: "p1", project_name: "UKErevyen 2027" }),
        item({ kind: "appointment", title: "Sen kveld", starts_at: "2026-11-17T23:30:00Z" }), // 18.11 kl 00:30 i Oslo
      ],
      start,
      today,
    );
    expect(w.days[5].entries.map((e) => [e.title, e.top, e.tone])).toEqual([["Skrivekurs", "12:00–20:00", "appt"]]);
    expect(w.days[2].entries.map((e) => e.title)).toEqual(["Sen kveld"]);
  });

  it("frister og fokus; fokus vinner samme dag", () => {
    const w = buildWeek(
      [
        item({ kind: "task", title: "Ring kunden", due_date: "2026-11-19" }),
        item({ kind: "task", title: "Grovklipp", focus_date: "2026-11-16", due_date: "2026-11-16", status: "in_progress" }),
      ],
      start,
      today,
    );
    expect(w.days[3].entries.map((e) => [e.title, e.top, e.tone])).toEqual([["Ring kunden", "Frist", "due"]]);
    expect(w.days[0].entries.map((e) => [e.title, e.top, e.tone])).toEqual([["Grovklipp", "Fokus", "focus"]]);
  });

  it("forfalte fra før uka vises på i dag", () => {
    const w = buildWeek([item({ kind: "task", title: "Send faktura", due_date: "2026-11-14" })], start, "2026-11-18");
    expect(w.days[2].entries.map((e) => [e.title, e.tone, e.top])).toEqual([["Send faktura", "overdue", "Forfalt 14.11"]]);
  });

  it("forfalte vises ikke når uka ikke inneholder i dag", () => {
    const w = buildWeek([item({ kind: "task", title: "Gammel", due_date: "2026-11-01" })], "2026-11-23", "2026-11-18");
    expect(w.days.flatMap((d) => d.entries)).toEqual([]);
  });

  it("fullførte oppgaver vises ikke", () => {
    const w = buildWeek([item({ kind: "task", title: "Ferdig", due_date: "2026-11-19", status: "done" })], start, today);
    expect(w.days.flatMap((d) => d.entries)).toEqual([]);
  });

  it("rader per prosjekt, «Uten prosjekt» sist, sortert på navn", () => {
    const w = buildWeek(
      [
        item({ kind: "task", title: "A", due_date: "2026-11-17" }),
        item({ kind: "appointment", title: "B", starts_at: "2026-11-21T11:00:00Z", project_id: "p2", project_name: "UKErevyen 2027" }),
        item({ kind: "task", title: "C", due_date: "2026-11-18", project_id: "p1", project_name: "Bryllupsvideo" }),
      ],
      start,
      today,
    );
    expect(w.rows.map((r) => r.name)).toEqual(["Bryllupsvideo", "UKErevyen 2027", "Uten prosjekt"]);
    expect(w.rows[1].cells[5].map((e) => e.title)).toEqual(["B"]);
    expect(w.rows[2].cells[1].map((e) => e.title)).toEqual(["A"]);
  });

  it("i en dag: avtaler først etter tid, så oppgaver", () => {
    const w = buildWeek(
      [
        item({ kind: "task", title: "Oppgave", due_date: "2026-11-16" }),
        item({ kind: "appointment", title: "Sen", starts_at: "2026-11-16T15:00:00Z" }),
        item({ kind: "appointment", title: "Tidlig", starts_at: "2026-11-16T07:00:00Z" }),
      ],
      start,
      today,
    );
    expect(w.days[0].entries.map((e) => e.title)).toEqual(["Tidlig", "Sen", "Oppgave"]);
  });
});
