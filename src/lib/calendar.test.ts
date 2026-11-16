import { describe, expect, it } from "vitest";
import { calendarRange, calendarTitle, parseCalendarParams, shiftDate } from "./calendar";

describe("parseCalendarParams", () => {
  it("standard er uke og i dag", () => {
    expect(parseCalendarParams({}, "2026-11-18")).toEqual({ view: "week", date: "2026-11-18" });
  });
  it("godtar dag, uke og måned på norsk", () => {
    expect(parseCalendarParams({ vis: "dag", dato: "2026-11-21" }, "2026-11-18")).toEqual({ view: "day", date: "2026-11-21" });
    expect(parseCalendarParams({ vis: "maned", dato: "2026-12-05" }, "2026-11-18")).toEqual({ view: "month", date: "2026-12-05" });
  });
  it("ugyldig dato blir i dag", () => {
    expect(parseCalendarParams({ vis: "dag", dato: "2026-02-30" }, "2026-11-18").date).toBe("2026-11-18");
  });
});

describe("calendarRange", () => {
  it("dag: én dag", () => {
    expect(calendarRange("day", "2026-11-21")).toEqual({ start: "2026-11-21", length: 1 });
  });
  it("uke: mandag til søndag", () => {
    expect(calendarRange("week", "2026-11-21")).toEqual({ start: "2026-11-16", length: 7 });
  });
  it("måned: hele uker som dekker måneden", () => {
    // November 2026: 1. er søndag, 30. er mandag → fra man. 26.10 til søn. 6.12 = 6 uker
    expect(calendarRange("month", "2026-11-21")).toEqual({ start: "2026-10-26", length: 42 });
    // Februar 2027: 1. er mandag, 28. er søndag → nøyaktig 4 uker
    expect(calendarRange("month", "2027-02-10")).toEqual({ start: "2027-02-01", length: 28 });
  });
});

describe("shiftDate", () => {
  it("dag ±1, uke ±7, måned ±1 måned", () => {
    expect(shiftDate("day", "2026-11-21", 1)).toBe("2026-11-22");
    expect(shiftDate("week", "2026-11-21", -1)).toBe("2026-11-14");
    expect(shiftDate("month", "2026-11-21", 1)).toBe("2026-12-01");
    expect(shiftDate("month", "2027-01-31", -1)).toBe("2026-12-01");
  });
});

describe("calendarTitle", () => {
  it("titler", () => {
    expect(calendarTitle("day", "2026-11-21")).toEqual({ title: "Lørdag 21. november", sub: "2026" });
    expect(calendarTitle("week", "2026-11-21")).toEqual({ title: "Uke 47", sub: "16.–22. november 2026" });
    expect(calendarTitle("month", "2026-11-21")).toEqual({ title: "November", sub: "2026" });
    expect(calendarTitle("week", "2026-12-30")).toEqual({ title: "Uke 53", sub: "28. desember – 3. januar 2027" });
  });
});
