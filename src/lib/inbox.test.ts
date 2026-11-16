import { describe, expect, it } from "vitest";
import { inboxPatch, isValidDate, PICK_CONTEXTS } from "./inbox";

describe("inboxPatch", () => {
  it("prosjekt: setter project_id og tar ut av innboksen", () => {
    expect(inboxPatch({ type: "project", option: { id: "p1", projectId: "p1", kind: "project", name: "A" } })).toEqual({
      ok: true,
      patch: { project_id: "p1", parent_id: null, in_inbox: false },
    });
  });

  it("delprosjekt: setter både project_id og parent_id", () => {
    expect(inboxPatch({ type: "project", option: { id: "s1", projectId: "p1", kind: "subproject", name: "Redigering" } })).toEqual({
      ok: true,
      patch: { project_id: "p1", parent_id: "s1", in_inbox: false },
    });
  });

  it("plukkliste: setter sted og tar ut av innboksen", () => {
    expect(inboxPatch({ type: "pick", context: "home" })).toEqual({
      ok: true,
      patch: { is_pickable: true, pick_context: "home", in_inbox: false },
    });
  });

  it("plukkliste: ukjent sted avvises", () => {
    expect(inboxPatch({ type: "pick", context: "kjeller" as never })).toEqual({ ok: false });
  });

  it("frist: gyldig dato tar ut av innboksen", () => {
    expect(inboxPatch({ type: "due", date: "2026-11-20" })).toEqual({ ok: true, patch: { due_date: "2026-11-20", in_inbox: false } });
  });

  it("frist: ugyldig dato avvises", () => {
    expect(inboxPatch({ type: "due", date: "2026-02-30" })).toEqual({ ok: false });
    expect(inboxPatch({ type: "due", date: "20.11.2026" })).toEqual({ ok: false });
  });

  it("fullført: markerer som ferdig og tar ut av innboksen", () => {
    expect(inboxPatch({ type: "done" })).toEqual({ ok: true, patch: { status: "done", in_inbox: false } });
  });
});

describe("hjelpere", () => {
  it("isValidDate", () => {
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2027-02-29")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });

  it("de fire stedene", () => {
    expect(PICK_CONTEXTS.map((c) => c.value)).toEqual(["home", "computer", "phone", "outside"]);
  });
});
