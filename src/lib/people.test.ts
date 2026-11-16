import { describe, expect, it } from "vitest";
import { PERSON_COLORS, SHARED, defaultSelection, isShown, isMyFocus, parseSelection, personColor, personKey, serializeSelection, togglePerson } from "./people";

const me = "p-me";

describe("personKey", () => {
  it("ansvarlig vinner", () => {
    expect(personKey({ assignee_profile_id: "p-nora", workspace_kind: "family", created_by_profile_id: me })).toBe("p-nora");
  });
  it("familie uten navn er Felles", () => {
    expect(personKey({ assignee_profile_id: null, workspace_kind: "family", created_by_profile_id: me })).toBe(SHARED);
  });
  it("privat og jobb uten navn gjelder den som laget det", () => {
    expect(personKey({ assignee_profile_id: null, workspace_kind: "work", created_by_profile_id: "p-marthe" })).toBe("p-marthe");
  });
  it("uten skaper: meg", () => {
    expect(personKey({ assignee_profile_id: null, workspace_kind: "private", created_by_profile_id: null }, me)).toBe(me);
  });
});

describe("utvalg", () => {
  const all = [me, "p-nora", SHARED];
  it("voksne ser alle fra start, barn seg selv og Felles", () => {
    expect(defaultSelection(all, me, false)).toEqual(all);
    expect(defaultSelection(all, me, true)).toEqual([me, SHARED]);
  });
  it("cookie leses og ukjente personer fjernes", () => {
    expect(parseSelection("p-nora,ukjent,shared", all, me, false)).toEqual(["p-nora", SHARED]);
  });
  it("tom eller manglende cookie gir standard", () => {
    expect(parseSelection(undefined, all, me, true)).toEqual([me, SHARED]);
    expect(parseSelection("ukjent", all, me, false)).toEqual(all);
  });
  it("«none» betyr at ingen er valgt", () => {
    expect(parseSelection("none", all, me, false)).toEqual([]);
    expect(serializeSelection([])).toBe("none");
  });
  it("trykk slår av og på, i fast rekkefølge", () => {
    expect(togglePerson([me, SHARED], "p-nora", all)).toEqual([me, "p-nora", SHARED]);
    expect(togglePerson(all, me, all)).toEqual(["p-nora", SHARED]);
  });
});

describe("isShown og isMyFocus", () => {
  it("vises når personen er valgt", () => {
    expect(isShown("p-nora", ["p-nora"])).toBe(true);
    expect(isShown(me, ["p-nora"])).toBe(false);
  });
  it("fokus er mitt eget, eller felles som jeg har plukket", () => {
    expect(isMyFocus({ key: me, created_by_profile_id: "x" }, me)).toBe(true);
    expect(isMyFocus({ key: SHARED, created_by_profile_id: me }, me)).toBe(true);
    expect(isMyFocus({ key: SHARED, created_by_profile_id: "p-marthe" }, me)).toBe(false);
    expect(isMyFocus({ key: "p-nora", created_by_profile_id: me }, me)).toBe(false);
  });
});

describe("personColor", () => {
  it("valgt farge brukes", () => {
    expect(personColor({ id: "a", color: "#a21caf" })).toBe("#a21caf");
  });
  it("ellers fast farge fra paletten ut fra id", () => {
    const c = personColor({ id: "abc", color: null });
    expect(PERSON_COLORS).toContain(c);
    expect(personColor({ id: "abc", color: null })).toBe(c);
  });
  it("ukjent farge faller tilbake til paletten", () => {
    expect(PERSON_COLORS).toContain(personColor({ id: "abc", color: "#ff0000" }));
  });
});
