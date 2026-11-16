import { describe, expect, it } from "vitest";
import { osloToday, osloToUtcIso, parseQuickAdd, type ProjectOption } from "./parse";

// Mandag 16. november 2026
const TODAY = "2026-11-16";

const projects: ProjectOption[] = [
  { id: "p-uke", name: "UKErevyen 2027", projectId: "p-uke", kind: "project" },
  { id: "p-bv", name: "Bryllupsvideo Ida og Sondre", projectId: "p-bv", kind: "project" },
  { id: "s-red", name: "Redigering", projectId: "p-bv", kind: "subproject", projectName: "Bryllupsvideo Ida og Sondre" },
  { id: "p-web1", name: "Nettside Kjøsen", projectId: "p-web1", kind: "project" },
  { id: "p-web2", name: "Nettside Trudvang", projectId: "p-web2", kind: "project" },
];

const parse = (text: string, today = TODAY) => parseQuickAdd(text, { today, projects });

describe("eksemplene fra kravspesifikasjonen", () => {
  it("Ring kunden → oppgave i innboksen", () => {
    const r = parse("Ring kunden");
    expect(r).toMatchObject({ title: "Ring kunden", kind: "task", inInbox: true });
    expect(r.dueDate).toBeUndefined();
    expect(r.project.status).toBe("none");
  });

  it("Ring kunden i morgen → frist i morgen", () => {
    expect(parse("Ring kunden i morgen")).toMatchObject({ title: "Ring kunden", kind: "task", dueDate: "2026-11-17", inInbox: false });
  });

  it("Ring kunden torsdag → frist neste torsdag", () => {
    expect(parse("Ring kunden torsdag")).toMatchObject({ title: "Ring kunden", dueDate: "2026-11-19" });
  });

  it("torsdag er i dag hvis det er torsdag", () => {
    expect(parse("Ring kunden torsdag", "2026-11-19").dueDate).toBe("2026-11-19");
  });

  it("Send faktura 21.11 → frist 21.11 i år", () => {
    expect(parse("Send faktura 21.11")).toMatchObject({ title: "Send faktura", dueDate: "2026-11-21" });
  });

  it("dato som er passert i år, blir neste år", () => {
    expect(parse("Send faktura 21.11", "2026-11-25").dueDate).toBe("2027-11-21");
  });

  it("Grovklipp #bryllup → prosjektet som matcher", () => {
    const r = parse("Grovklipp #bryllup");
    expect(r.title).toBe("Grovklipp");
    expect(r.project).toMatchObject({ status: "one", match: { id: "p-bv" } });
    expect(r.inInbox).toBe(false);
  });

  it("Skift lyspære @hjemme → plukkliste, sted hjemme", () => {
    expect(parse("Skift lyspære @hjemme")).toMatchObject({ title: "Skift lyspære", kind: "task", pickContext: "home", inInbox: false });
  });

  it("Skrivekurs 21.11 12-20 #ukerevyen → avtale i UKErevyen", () => {
    const r = parse("Skrivekurs 21.11 12-20 #ukerevyen");
    expect(r).toMatchObject({
      title: "Skrivekurs",
      kind: "appointment",
      startDate: "2026-11-21",
      startTime: "12:00",
      endTime: "20:00",
      inInbox: false,
    });
    expect(r.project).toMatchObject({ status: "one", match: { id: "p-uke" } });
  });

  it("Møte torsdag kl 14 → avtale torsdag kl. 14, én time", () => {
    expect(parse("Møte torsdag kl 14")).toMatchObject({
      title: "Møte",
      kind: "appointment",
      startDate: "2026-11-19",
      startTime: "14:00",
      endTime: "15:00",
    });
  });
});

describe("datoer", () => {
  it("i dag, idag, imorgen og i overmorgen", () => {
    expect(parse("Ring i dag").dueDate).toBe("2026-11-16");
    expect(parse("Ring idag").dueDate).toBe("2026-11-16");
    expect(parse("Ring imorgen").dueDate).toBe("2026-11-17");
    expect(parse("Ring i overmorgen").dueDate).toBe("2026-11-18");
  });

  it("alle ukedager, også med stor forbokstav", () => {
    expect(parse("A mandag").dueDate).toBe("2026-11-16");
    expect(parse("A tirsdag").dueDate).toBe("2026-11-17");
    expect(parse("A onsdag").dueDate).toBe("2026-11-18");
    expect(parse("A Fredag").dueDate).toBe("2026-11-20");
    expect(parse("A lørdag").dueDate).toBe("2026-11-21");
    expect(parse("A søndag").dueDate).toBe("2026-11-22");
  });

  it("neste <ukedag> er aldri i dag", () => {
    expect(parse("A neste mandag").dueDate).toBe("2026-11-23");
    expect(parse("A neste torsdag").dueDate).toBe("2026-11-19");
  });

  it("på, til og innen foran en dato fjernes fra tittelen", () => {
    expect(parse("Lever rapport innen fredag")).toMatchObject({ title: "Lever rapport", dueDate: "2026-11-20" });
    expect(parse("Møte på torsdag kl 9").title).toBe("Møte");
  });

  it("datoformater: 1.12, 01.12., 1.12.2027 og 1.12.27", () => {
    expect(parse("A 1.12").dueDate).toBe("2026-12-01");
    expect(parse("A 01.12.").dueDate).toBe("2026-12-01");
    expect(parse("A 1.12.2027").dueDate).toBe("2027-12-01");
    expect(parse("A 1.12.27").dueDate).toBe("2027-12-01");
  });

  it("ugyldige datoer blir stående i tittelen", () => {
    expect(parse("Kapittel 31.02")).toMatchObject({ title: "Kapittel 31.02" });
    expect(parse("Kapittel 31.02").dueDate).toBeUndefined();
    expect(parse("Versjon 2.13").dueDate).toBeUndefined();
  });

  it("over nyttår: 2.1 i desember blir januar neste år", () => {
    expect(parse("A 2.1", "2026-12-20").dueDate).toBe("2027-01-02");
  });
});

describe("klokkeslett og avtaler", () => {
  it("kl 14:30, kl. 9 og kl 14.30", () => {
    expect(parse("Møte kl 14:30")).toMatchObject({ startTime: "14:30", endTime: "15:30" });
    expect(parse("Møte kl. 9")).toMatchObject({ startTime: "09:00", endTime: "10:00" });
    expect(parse("Møte kl 14.30")).toMatchObject({ startTime: "14:30" });
  });

  it("14:00 uten kl. er et klokkeslett", () => {
    expect(parse("Lunsj 11:30")).toMatchObject({ kind: "appointment", startTime: "11:30" });
  });

  it("tidsrom: 12-20, 12–20, 10:00-15:30 og kl 12-20", () => {
    expect(parse("A 12-20")).toMatchObject({ startTime: "12:00", endTime: "20:00" });
    expect(parse("A 12–20")).toMatchObject({ startTime: "12:00", endTime: "20:00" });
    expect(parse("A 10:00-15:30")).toMatchObject({ startTime: "10:00", endTime: "15:30" });
    expect(parse("A kl 12-20")).toMatchObject({ startTime: "12:00", endTime: "20:00" });
  });

  it("avtale uten dato er i dag", () => {
    expect(parse("Tannlege kl 15")).toMatchObject({ kind: "appointment", startDate: "2026-11-16", dueDate: undefined });
  });

  it("tidsrom der slutt er før start, er ikke et tidsrom", () => {
    expect(parse("A 20-12").kind).toBe("task");
  });

  it("tall uten kl. og uten kolon er ikke klokkeslett", () => {
    expect(parse("Kjøp 14 egg")).toMatchObject({ kind: "task", title: "Kjøp 14 egg" });
  });

  it("slutt kl. 23 + én time stopper ved midnatt", () => {
    expect(parse("Fest kl 23:30")).toMatchObject({ startTime: "23:30", endTime: "23:59" });
  });

  it("avtaler havner aldri i innboksen", () => {
    expect(parse("Møte kl 10").inInbox).toBe(false);
  });
});

describe("#prosjekt", () => {
  it("matcher uten hensyn til store og små bokstaver", () => {
    expect(parse("A #UKE").project).toMatchObject({ status: "one", match: { id: "p-uke" } });
  });

  it("delprosjekt matcher og gir prosjektet sitt", () => {
    expect(parse("Finklipp #redigering").project).toMatchObject({ status: "one", match: { id: "s-red", projectId: "p-bv" } });
  });

  it("flere treff gir et valg", () => {
    const r = parse("Oppdater forside #nettside");
    expect(r.project.status).toBe("many");
    if (r.project.status === "many") expect(r.project.candidates.map((c) => c.id)).toEqual(["p-web1", "p-web2"]);
  });

  it("eksakt navn vinner over delvise treff", () => {
    const r = parseQuickAdd("A #nettside", {
      today: TODAY,
      projects: [...projects, { id: "p-exact", name: "Nettside", projectId: "p-exact", kind: "project" }],
    });
    expect(r.project).toMatchObject({ status: "one", match: { id: "p-exact" } });
  });

  it("ingen treff: ordet blir stående i tittelen", () => {
    const r = parse("Kjøp #melk");
    expect(r.project.status).toBe("none");
    expect(r.title).toBe("Kjøp melk");
  });

  it("æ, ø og å fungerer", () => {
    expect(parse("A #kjøsen").project).toMatchObject({ status: "one", match: { id: "p-web1" } });
  });
});

describe("@sted", () => {
  it("alle fire steder", () => {
    expect(parse("A @hjemme").pickContext).toBe("home");
    expect(parse("A @pc").pickContext).toBe("computer");
    expect(parse("A @telefon").pickContext).toBe("phone");
    expect(parse("A @tlf").pickContext).toBe("phone");
    expect(parse("A @ute").pickContext).toBe("outside");
  });

  it("ukjent sted blir stående", () => {
    const r = parse("Send til ola@firma.no");
    expect(r.pickContext).toBeUndefined();
    expect(r.title).toBe("Send til ola@firma.no");
  });
});

describe("merker og tittel", () => {
  it("merker beskriver det som ble tolket", () => {
    const r = parse("Skrivekurs 21.11 12-20 #ukerevyen");
    expect(r.chips.map((c) => c.type)).toEqual(["date", "time", "project"]);
  });

  it("mellomrom ryddes", () => {
    expect(parse("  Ring   kunden   i morgen  ").title).toBe("Ring kunden");
  });

  it("bare dato gir tom tittel", () => {
    expect(parse("i morgen").title).toBe("");
  });

  it("ignorerer valgte merker", () => {
    const r = parseQuickAdd("Skift lyspære @hjemme i morgen", { today: TODAY, projects, ignore: ["context"] });
    expect(r).toMatchObject({ title: "Skift lyspære @hjemme", pickContext: undefined, dueDate: "2026-11-17" });
  });
});

describe("tidssone", () => {
  it("dagens dato i Oslo, også like etter midnatt", () => {
    expect(osloToday(new Date("2026-11-16T23:30:00Z"))).toBe("2026-11-17");
    expect(osloToday(new Date("2026-07-01T21:30:00Z"))).toBe("2026-07-01");
    expect(osloToday(new Date("2026-07-01T22:30:00Z"))).toBe("2026-07-02");
  });

  it("lokal tid i Oslo blir riktig UTC vinter og sommer", () => {
    expect(osloToUtcIso("2026-11-21", "12:00")).toBe("2026-11-21T11:00:00.000Z");
    expect(osloToUtcIso("2027-07-15", "12:00")).toBe("2027-07-15T10:00:00.000Z");
  });
});
