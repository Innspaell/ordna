import { describe, expect, it } from "vitest";
import { eventLabel, groupEvents, recentlyBought, whenLabel, type ListEvent } from "./shopping";

describe("recentlyBought", () => {
  const rows = [
    { id: "1", title: "Melk", cleared_at: "2026-11-17T10:00:00Z" },
    { id: "2", title: "melk ", cleared_at: "2026-11-10T10:00:00Z" },
    { id: "3", title: "Brød", cleared_at: "2026-11-16T10:00:00Z" },
    { id: "4", title: "Egg", cleared_at: "2026-11-15T10:00:00Z" },
  ];
  it("nyeste først, én per vare (store/små bokstaver likt)", () => {
    expect(recentlyBought(rows, []).map((r) => [r.id, r.title])).toEqual([["1", "Melk"], ["3", "Brød"], ["4", "Egg"]]);
  });
  it("det som allerede står på listen vises ikke", () => {
    expect(recentlyBought(rows, ["BRØD"]).map((r) => r.title)).toEqual(["Melk", "Egg"]);
  });
  it("begrenset antall", () => {
    expect(recentlyBought(rows, [], 2)).toHaveLength(2);
  });
});

const ev = (over: Partial<ListEvent>): ListEvent => ({ id: 1, action: "checked", title: "Melk", who: "Ingrid", profile_id: "p-i", created_at: "2026-11-17T16:00:00Z", ...over });

describe("groupEvents", () => {
  it("samme person og handling innen fem minutter blir én linje", () => {
    const g = groupEvents([
      ev({ id: 3, title: "Egg", created_at: "2026-11-17T16:04:00Z" }),
      ev({ id: 2, title: "Brød", created_at: "2026-11-17T16:02:00Z" }),
      ev({ id: 1, title: "Melk", created_at: "2026-11-17T16:00:00Z" }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].titles).toEqual(["Egg", "Brød", "Melk"]);
    expect(g[0].at).toBe("2026-11-17T16:04:00Z");
  });
  it("ny person, ny handling eller lang pause gir ny linje", () => {
    const g = groupEvents([
      ev({ id: 4, created_at: "2026-11-17T17:00:00Z" }),
      ev({ id: 3, action: "cleared", created_at: "2026-11-17T16:03:00Z" }),
      ev({ id: 2, who: "Marthe", profile_id: "p-m", created_at: "2026-11-17T16:02:00Z" }),
      ev({ id: 1, created_at: "2026-11-17T16:00:00Z" }),
    ]);
    expect(g.map((x) => [x.who, x.action])).toEqual([["Ingrid", "checked"], ["Ingrid", "cleared"], ["Marthe", "checked"], ["Ingrid", "checked"]]);
  });
});

describe("eventLabel", () => {
  it("én, to og mange varer", () => {
    expect(eventLabel({ who: "Ingrid", action: "added", titles: ["Melk"] })).toBe("Ingrid la til Melk");
    expect(eventLabel({ who: "Marthe", action: "checked", titles: ["Melk", "Brød"] })).toBe("Marthe krysset av Melk og Brød");
    expect(eventLabel({ who: "Erlend", action: "cleared", titles: ["A", "B", "C", "D", "E"] })).toBe("Erlend ryddet A, B, C og 2 til");
  });
  it("alle handlinger har norsk tekst, og ukjent person", () => {
    expect(eventLabel({ who: null, action: "unchecked", titles: ["Melk"] })).toBe("Noen fjernet krysset på Melk");
    expect(eventLabel({ who: "Ingrid", action: "restored", titles: ["Melk"] })).toBe("Ingrid la tilbake Melk");
    expect(eventLabel({ who: "Ingrid", action: "deleted", titles: ["Melk"] })).toBe("Ingrid slettet Melk");
  });
});

describe("whenLabel", () => {
  it("i dag, i går og dato (Oslo-tid)", () => {
    expect(whenLabel("2026-11-17T16:12:00Z", "2026-11-17")).toBe("i dag 17:12");
    expect(whenLabel("2026-11-16T22:30:00Z", "2026-11-17")).toBe("i går 23:30");
    expect(whenLabel("2026-11-12T08:05:00Z", "2026-11-17")).toBe("12.11. 09:05");
  });
});
