import { describe, expect, it } from "vitest";
import { PERSON_COLORS, SHARED, defaultSelection, isShown, isMyFocus, parseSelection, personColor, personKeys, serializeSelection, togglePerson } from "./people";

const me = "p-me";

describe("personKeys", () => {
  it("personene på tingen vinner, alle sammen", () => {
    expect(personKeys({ people: [me, "p-ingrid"], workspace_kind: "family", created_by_profile_id: me })).toEqual([me, "p-ingrid"]);
  });
  it("familie uten navn er Felles", () => {
    expect(personKeys({ people: [], workspace_kind: "family", created_by_profile_id: me })).toEqual([SHARED]);
  });
  it("privat og jobb uten navn gjelder den som laget det", () => {
    expect(personKeys({ people: [], workspace_kind: "work", created_by_profile_id: "p-marthe" })).toEqual(["p-marthe"]);
  });
  it("uten skaper: meg", () => {
    expect(personKeys({ people: [], workspace_kind: "private", created_by_profile_id: null }, me)).toEqual([me]);
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
  it("vises når minst én av personene er valgt", () => {
    expect(isShown(["p-nora"], ["p-nora"])).toBe(true);
    expect(isShown([me], ["p-nora"])).toBe(false);
    // Erlend og Ingrid på kamp, Marthe har valgt bare seg selv og Ingrid
    expect(isShown([me, "p-ingrid"], ["p-marthe", "p-ingrid"])).toBe(true);
    expect(isShown([me, "p-ingrid"], ["p-marthe"])).toBe(false);
  });
  it("fokus er mitt eget, eller felles som jeg har plukket", () => {
    expect(isMyFocus({ keys: [me], created_by_profile_id: "x" }, me)).toBe(true);
    expect(isMyFocus({ keys: ["p-ingrid", me], created_by_profile_id: "x" }, me)).toBe(true);
    expect(isMyFocus({ keys: [SHARED], created_by_profile_id: me }, me)).toBe(true);
    expect(isMyFocus({ keys: [SHARED], created_by_profile_id: "p-marthe" }, me)).toBe(false);
    expect(isMyFocus({ keys: ["p-nora"], created_by_profile_id: me }, me)).toBe(false);
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
