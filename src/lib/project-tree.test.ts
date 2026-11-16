import { describe, expect, it } from "vitest";
import { buildProjectTree, countTasks, type TreeItem } from "./project-tree";

let n = 0;
const item = (p: Partial<TreeItem> & Pick<TreeItem, "kind" | "title">): TreeItem => ({
  id: p.id ?? `i${++n}`,
  parent_id: null,
  status: "ready",
  due_date: null,
  starts_at: null,
  ends_at: null,
  sort_order: 0,
  created_at: `2026-11-16T10:${String(n).padStart(2, "0")}:00Z`,
  ...p,
});

describe("prosjekt uten delprosjekter", () => {
  it("alle oppgaver og avtaler ligger rett i prosjektet, ingen «Øvrig»", () => {
    const items = [
      item({ kind: "appointment", title: "Skrivekurs", starts_at: "2026-11-21T11:00:00Z" }),
      item({ kind: "appointment", title: "Redigering", starts_at: "2026-11-22T09:00:00Z" }),
    ];
    const t = buildProjectTree(items);
    expect(t.hasSubprojects).toBe(false);
    expect(t.rootItems.map((i) => i.title)).toEqual(["Skrivekurs", "Redigering"]);
    expect(t.other).toBeNull();
    expect(t.count).toEqual({ done: 0, total: 0 });
  });
});

describe("Bryllupsvideo: ett delprosjekt med sju oppgaver", () => {
  const red = item({ id: "red", kind: "subproject", title: "Redigering" });
  const steps = ["Gjennomgang av opptak", "Grovklipp", "Finklipp", "Lyd og musikk", "Farge", "Godkjenning", "Levering"].map((t, i) =>
    item({ kind: "task", title: t, parent_id: "red", sort_order: i, status: t === "Grovklipp" ? "done" : "ready" }),
  );
  const t = buildProjectTree([red, ...steps]);

  it("delprosjektet er en gruppe med 1 av 7", () => {
    expect(t.hasSubprojects).toBe(true);
    expect(t.groups).toHaveLength(1);
    expect(t.groups[0]).toMatchObject({ title: "Redigering", count: { done: 1, total: 7 }, empty: false });
  });

  it("oppgavene står i rekkefølge, fullførte til slutt", () => {
    expect(t.groups[0].items.map((i) => i.title)).toEqual([
      "Gjennomgang av opptak",
      "Finklipp",
      "Lyd og musikk",
      "Farge",
      "Godkjenning",
      "Levering",
      "Grovklipp",
    ]);
  });

  it("prosjektet teller det samme", () => {
    expect(t.count).toEqual({ done: 1, total: 7 });
  });

  it("ingen oppgaver rett i prosjektet: ingen «Øvrig»", () => {
    expect(t.other).toBeNull();
  });
});

describe("regler for telling og grupper", () => {
  it("oppgaver rett i prosjektet havner i «Øvrig» når det finnes delprosjekter", () => {
    const t = buildProjectTree([
      item({ id: "a", kind: "subproject", title: "A" }),
      item({ kind: "task", title: "I A", parent_id: "a" }),
      item({ kind: "task", title: "Løs oppgave", status: "done" }),
    ]);
    expect(t.other).toMatchObject({ title: "Øvrig", count: { done: 1, total: 1 } });
    expect(t.other?.items.map((i) => i.title)).toEqual(["Løs oppgave"]);
    expect(t.count).toEqual({ done: 1, total: 2 });
  });

  it("tomt delprosjekt er merket tomt og teller 0 av 0", () => {
    const t = buildProjectTree([item({ id: "tom", kind: "subproject", title: "Tom" })]);
    expect(t.groups[0]).toMatchObject({ empty: true, count: { done: 0, total: 0 } });
  });

  it("avtaler, avbrutte oppgaver og delprosjekter teller ikke", () => {
    const items = [
      item({ kind: "task", title: "Klar" }),
      item({ kind: "task", title: "Ferdig", status: "done" }),
      item({ kind: "task", title: "Avbrutt", status: "cancelled" }),
      item({ kind: "appointment", title: "Møte", starts_at: "2026-11-20T09:00:00Z" }),
    ];
    expect(countTasks(items)).toEqual({ done: 1, total: 2 });
  });

  it("underdelprosjekter ligger innrykket under forelderen og teller med oppover", () => {
    const t = buildProjectTree([
      item({ id: "top", kind: "subproject", title: "Opptak" }),
      item({ id: "dag1", kind: "subproject", title: "Dag 1", parent_id: "top" }),
      item({ id: "dag1a", kind: "subproject", title: "Formiddag", parent_id: "dag1" }),
      item({ kind: "task", title: "Rigg", parent_id: "top", status: "done" }),
      item({ kind: "task", title: "Intervju", parent_id: "dag1" }),
      item({ kind: "task", title: "B-roll", parent_id: "dag1a", status: "done" }),
    ]);
    const top = t.groups[0];
    expect(top.depth).toBe(0);
    expect(top.count).toEqual({ done: 2, total: 3 });
    expect(top.children[0]).toMatchObject({ title: "Dag 1", depth: 1, count: { done: 1, total: 2 } });
    expect(top.children[0].children[0]).toMatchObject({ title: "Formiddag", depth: 2, count: { done: 1, total: 1 } });
    expect(t.count).toEqual({ done: 2, total: 3 });
  });

  it("avtaler sorteres på tid og står før oppgavene", () => {
    const t = buildProjectTree([
      item({ kind: "task", title: "Oppgave" }),
      item({ kind: "appointment", title: "Sen", starts_at: "2026-11-22T09:00:00Z" }),
      item({ kind: "appointment", title: "Tidlig", starts_at: "2026-11-21T09:00:00Z" }),
    ]);
    expect(t.rootItems.map((i) => i.title)).toEqual(["Tidlig", "Sen", "Oppgave"]);
  });

  it("skjul fullførte fjerner dem fra listene, men ikke fra tellingen", () => {
    const t = buildProjectTree([item({ kind: "task", title: "Ferdig", status: "done" }), item({ kind: "task", title: "Klar" })], { hideDone: true });
    expect(t.rootItems.map((i) => i.title)).toEqual(["Klar"]);
    expect(t.count).toEqual({ done: 1, total: 2 });
  });

  it("element med ukjent forelder havner rett i prosjektet", () => {
    const t = buildProjectTree([item({ kind: "task", title: "Foreldreløs", parent_id: "finnes-ikke" })]);
    expect(t.rootItems.map((i) => i.title)).toEqual(["Foreldreløs"]);
  });
});
