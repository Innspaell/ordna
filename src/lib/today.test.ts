import { describe, expect, it } from "vitest";
import { buildToday, osloDayRange, type DayItem } from "./today";

const TODAY = "2026-11-21"; // lørdag, skrivekurs-dagen

let n = 0;
const it_ = (p: Partial<DayItem> & Pick<DayItem, "kind" | "title">): DayItem => ({
  id: `i${++n}`,
  status: "ready",
  due_date: null,
  focus_date: null,
  starts_at: null,
  ends_at: null,
  all_day: false,
  project: null,
  ...p,
});

describe("osloDayRange", () => {
  it("vinter: Oslo-døgnet i UTC", () => {
    expect(osloDayRange("2026-11-21")).toEqual({ from: "2026-11-20T23:00:00.000Z", to: "2026-11-21T23:00:00.000Z" });
  });
  it("sommer", () => {
    expect(osloDayRange("2027-07-15")).toEqual({ from: "2027-07-14T22:00:00.000Z", to: "2027-07-15T22:00:00.000Z" });
  });
});

describe("buildToday", () => {
  it("Skrivekurs 21.11 vises under avtaler i dag med prosjektnavn", () => {
    const d = buildToday(
      [
        it_({ kind: "appointment", title: "Skrivekurs", starts_at: "2026-11-21T11:00:00Z", ends_at: "2026-11-21T19:00:00Z", project: "UKErevyen 2027" }),
        it_({ kind: "appointment", title: "Redigering", starts_at: "2026-11-22T09:00:00Z", project: "UKErevyen 2027" }),
      ],
      TODAY,
    );
    expect(d.appointments.map((a) => [a.title, a.project])).toEqual([["Skrivekurs", "UKErevyen 2027"]]);
  });

  it("avtaler sorteres på tid, heldagsavtaler først", () => {
    const d = buildToday(
      [
        it_({ kind: "appointment", title: "Middag", starts_at: "2026-11-21T17:00:00Z" }),
        it_({ kind: "appointment", title: "Frokost", starts_at: "2026-11-21T07:00:00Z" }),
        it_({ kind: "appointment", title: "Fridag", starts_at: "2026-11-20T23:00:00Z", all_day: true }),
      ],
      TODAY,
    );
    expect(d.appointments.map((a) => a.title)).toEqual(["Fridag", "Frokost", "Middag"]);
  });

  it("forfalt, frist i dag og fokus i hver sin seksjon", () => {
    const d = buildToday(
      [
        it_({ kind: "task", title: "Gammel", due_date: "2026-11-19" }),
        it_({ kind: "task", title: "I dag", due_date: TODAY }),
        it_({ kind: "task", title: "Fokus", focus_date: TODAY }),
        it_({ kind: "task", title: "Senere", due_date: "2026-11-30" }),
      ],
      TODAY,
    );
    expect(d.overdue.map((t) => t.title)).toEqual(["Gammel"]);
    expect(d.dueToday.map((t) => t.title)).toEqual(["I dag"]);
    expect(d.focus.map((t) => t.title)).toEqual(["Fokus"]);
  });

  it("en oppgave i fokus vises bare under Fokus, selv om den har forfalt", () => {
    const d = buildToday([it_({ kind: "task", title: "Begge", due_date: "2026-11-19", focus_date: TODAY })], TODAY);
    expect(d.overdue).toEqual([]);
    expect(d.focus.map((t) => t.title)).toEqual(["Begge"]);
  });

  it("fullførte og avbrutte oppgaver vises ikke", () => {
    const d = buildToday(
      [it_({ kind: "task", title: "Ferdig", due_date: "2026-11-19", status: "done" }), it_({ kind: "task", title: "Avbrutt", due_date: TODAY, status: "cancelled" })],
      TODAY,
    );
    expect(d.overdue).toEqual([]);
    expect(d.dueToday).toEqual([]);
    expect(d.isEmpty).toBe(true);
  });

  it("forfalte sorteres eldst først", () => {
    const d = buildToday(
      [it_({ kind: "task", title: "Nyere", due_date: "2026-11-20" }), it_({ kind: "task", title: "Eldst", due_date: "2026-11-01" })],
      TODAY,
    );
    expect(d.overdue.map((t) => t.title)).toEqual(["Eldst", "Nyere"]);
  });

  it("passerte avtaler merkes", () => {
    const d = buildToday(
      [
        it_({ kind: "appointment", title: "Ferdig", starts_at: "2026-11-21T08:00:00Z", ends_at: "2026-11-21T09:00:00Z" }),
        it_({ kind: "appointment", title: "Pågår", starts_at: "2026-11-21T09:30:00Z", ends_at: "2026-11-21T11:00:00Z" }),
        it_({ kind: "appointment", title: "Uten slutt", starts_at: "2026-11-21T07:00:00Z" }),
      ],
      TODAY,
      new Date("2026-11-21T10:00:00Z"),
    );
    expect(d.appointments.map((a) => [a.title, a.past])).toEqual([
      ["Uten slutt", true],
      ["Ferdig", true],
      ["Pågår", false],
    ]);
  });

  it("tom dag", () => {
    expect(buildToday([], TODAY).isEmpty).toBe(true);
  });
});
