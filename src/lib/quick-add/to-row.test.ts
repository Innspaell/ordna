import { describe, expect, it } from "vitest";
import { parseQuickAdd, type ProjectOption } from "./parse";
import { toItemRow } from "./to-row";

const TODAY = "2026-11-16";
const JOBB = "ws-jobb";
const projects: ProjectOption[] = [
  { id: "p-uke", name: "UKErevyen 2027", projectId: "p-uke", kind: "project" },
  { id: "p-bv", name: "Bryllupsvideo Ida og Sondre", projectId: "p-bv", kind: "project" },
  { id: "s-red", name: "Redigering", projectId: "p-bv", kind: "subproject", projectName: "Bryllupsvideo Ida og Sondre" },
  { id: "p-web1", name: "Nettside Kjøsen", projectId: "p-web1", kind: "project" },
  { id: "p-web2", name: "Nettside Trudvang", projectId: "p-web2", kind: "project" },
];
const row = (text: string, chosenProjectId?: string) =>
  toItemRow(parseQuickAdd(text, { today: TODAY, projects }), { defaultWorkspaceId: JOBB, projects, chosenProjectId });

describe("toItemRow", () => {
  it("oppgave i innboksen havner i Jobb", () => {
    expect(row("Ring kunden")).toEqual({
      ok: true,
      row: { workspace_id: JOBB, kind: "task", title: "Ring kunden", in_inbox: true, project_id: null, parent_id: null, due_date: null, is_pickable: false, pick_context: null, starts_at: null, ends_at: null },
      where: "Innboks",
    });
  });

  it("frist uten prosjekt: frittstående oppgave, ikke innboks", () => {
    const r = row("Ring kunden i morgen");
    expect(r).toMatchObject({ ok: true, row: { due_date: "2026-11-17", in_inbox: false, project_id: null }, where: "Jobb" });
  });

  it("prosjekt gir project_id", () => {
    expect(row("Grovklipp #bryllup")).toMatchObject({ ok: true, row: { project_id: "p-bv", parent_id: null }, where: "Bryllupsvideo Ida og Sondre" });
  });

  it("delprosjekt gir både project_id og parent_id", () => {
    expect(row("Finklipp #redigering")).toMatchObject({
      ok: true,
      row: { project_id: "p-bv", parent_id: "s-red" },
      where: "Bryllupsvideo Ida og Sondre › Redigering",
    });
  });

  it("avtale får start og slutt i UTC", () => {
    expect(row("Skrivekurs 21.11 12-20 #ukerevyen")).toMatchObject({
      ok: true,
      row: { kind: "appointment", starts_at: "2026-11-21T11:00:00.000Z", ends_at: "2026-11-21T19:00:00.000Z", due_date: null, in_inbox: false, project_id: "p-uke" },
    });
  });

  it("sted sender oppgaven til plukklisten", () => {
    expect(row("Skift lyspære @hjemme")).toMatchObject({ ok: true, row: { is_pickable: true, pick_context: "home", in_inbox: false }, where: "Plukklisten" });
  });

  it("flere prosjekttreff uten valg ber om valg", () => {
    const r = row("Oppdater forside #nettside");
    expect(r).toMatchObject({ ok: false, reason: "choose_project" });
    if (!r.ok && r.reason === "choose_project") expect(r.candidates.map((c) => c.id)).toEqual(["p-web1", "p-web2"]);
  });

  it("valgt prosjekt brukes når det er flere treff", () => {
    expect(row("Oppdater forside #nettside", "p-web2")).toMatchObject({ ok: true, row: { project_id: "p-web2", title: "Oppdater forside" } });
  });

  it("valgt prosjekt må være blant treffene", () => {
    expect(row("Oppdater forside #nettside", "p-uke")).toMatchObject({ ok: false, reason: "choose_project" });
  });

  it("tom tittel avvises", () => {
    expect(row("i morgen")).toEqual({ ok: false, reason: "empty_title" });
  });
});
