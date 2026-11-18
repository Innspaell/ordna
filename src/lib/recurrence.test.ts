import { describe, expect, it } from "vitest";
import { addMonthsClamped, describeRule, firstOnOrAfter, isoWeekday, occurrences, untilChoices, nextBreak } from "./recurrence";

describe("occurrences", () => {
  it("hver tirsdag og torsdag til og med sluttdato", () => {
    expect(occurrences({ freq: "weekly", weekdays: [2, 4], starts_on: "2026-11-24", until_date: "2026-12-18" })).toEqual([
      "2026-11-24", "2026-11-26", "2026-12-01", "2026-12-03", "2026-12-08", "2026-12-10", "2026-12-15", "2026-12-17",
    ]);
  });
  it("ukentlig starter på første valgte dag fra start", () => {
    expect(occurrences({ freq: "weekly", weekdays: [1], starts_on: "2026-11-18", until_date: "2026-12-01" })).toEqual(["2026-11-23", "2026-11-30"]);
  });
  it("hver dag", () => {
    expect(occurrences({ freq: "daily", weekdays: null, starts_on: "2026-12-30", until_date: "2027-01-02" })).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
  it("hver måned: samme dato, og siste dag når måneden er kortere", () => {
    expect(occurrences({ freq: "monthly", weekdays: null, starts_on: "2027-01-31", until_date: "2027-04-30" })).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  });
  it("hvert år uten sluttdato: 10 år frem", () => {
    const d = occurrences({ freq: "yearly", weekdays: null, starts_on: "2027-03-05", until_date: null });
    expect(d).toHaveLength(10);
    expect(d[0]).toBe("2027-03-05");
    expect(d[9]).toBe("2036-03-05");
  });
  it("29. februar blir 28. i vanlige år", () => {
    expect(occurrences({ freq: "yearly", weekdays: null, starts_on: "2028-02-29", until_date: "2030-12-31" })).toEqual(["2028-02-29", "2029-02-28", "2030-02-28"]);
  });
  it("aldri mer enn grensen", () => {
    expect(occurrences({ freq: "daily", weekdays: null, starts_on: "2026-01-01", until_date: "2027-12-31" }, 800)).toHaveLength(730);
  });
});

describe("hjelpere", () => {
  it("isoWeekday: mandag = 1, søndag = 7", () => {
    expect(isoWeekday("2026-11-16")).toBe(1);
    expect(isoWeekday("2026-11-22")).toBe(7);
  });
  it("firstOnOrAfter finner neste valgte ukedag", () => {
    expect(firstOnOrAfter("2026-11-18", [2, 4])).toBe("2026-11-19");
    expect(firstOnOrAfter("2026-11-19", [2, 4])).toBe("2026-11-19");
  });
  it("addMonthsClamped", () => {
    expect(addMonthsClamped("2026-11-30", 3)).toBe("2027-02-28");
  });
});

describe("describeRule", () => {
  it("leses som vanlig norsk", () => {
    expect(describeRule({ freq: "weekly", weekdays: [2, 4], starts_on: "2026-11-24", until_date: "2026-12-18" })).toBe("Hver tirsdag og torsdag til 18.12.2026");
    expect(describeRule({ freq: "daily", weekdays: null, starts_on: "2026-11-24", until_date: "2026-12-31" })).toBe("Hver dag til 31.12.2026");
    expect(describeRule({ freq: "monthly", weekdays: null, starts_on: "2026-11-20", until_date: "2027-06-18" })).toBe("Hver måned den 20. til 18.06.2027");
    expect(describeRule({ freq: "yearly", weekdays: null, starts_on: "2027-03-05", until_date: null })).toBe("Hvert år 5. mars");
    expect(describeRule({ freq: "weekly", weekdays: [1, 2, 3], starts_on: "2026-11-24", until_date: "2026-12-18" })).toBe("Hver mandag, tirsdag og onsdag til 18.12.2026");
  });
});

describe("skoleferier i Stjørdal og hurtigvalg", () => {
  it("neste ferie med siste skoledag før", () => {
    expect(nextBreak("juleferie", "2026-11-18")).toEqual({ label: "Juleferie", until: "2026-12-22" });
    expect(nextBreak("jul", "2026-12-23")).toEqual({ label: "Juleferie", until: "2027-12-22" });
    expect(nextBreak("sommerferie", "2026-11-18")).toEqual({ label: "Sommerferie", until: "2027-06-18" });
    expect(nextBreak("påske", "2026-11-18")).toEqual({ label: "Påskeferie", until: "2027-03-19" });
    expect(nextBreak("ukjent", "2026-11-18")).toBeUndefined();
  });
  it("hurtigvalg: de tre neste feriene og om 1, 3 og 6 måneder", () => {
    expect(untilChoices("2026-11-18")).toEqual([
      { label: "Juleferie", until: "2026-12-22" },
      { label: "Vinterferie", until: "2027-02-19" },
      { label: "Påskeferie", until: "2027-03-19" },
      { label: "Sommerferie", until: "2027-06-18" },
      { label: "Om 1 mnd", until: "2026-12-18" },
      { label: "Om 3 mnd", until: "2027-02-18" },
      { label: "Om 6 mnd", until: "2027-05-18" },
    ]);
  });
});
