import { describe, expect, it } from "vitest";
import { autocompleteBody, fromGoogle, mapsUrl, mergePlaces, recentPlaces } from "./places";

describe("fromGoogle", () => {
  it("gjør Google-svar om til forslag med navn og adresse", () => {
    const res = {
      suggestions: [
        { placePrediction: { placeId: "p1", text: { text: "Stjørdal stadion, Stadionvegen, Stjørdal" }, structuredFormat: { mainText: { text: "Stjørdal stadion" }, secondaryText: { text: "Stadionvegen, Stjørdal" } } } },
        { queryPrediction: { text: { text: "stadion" } } },
        { placePrediction: { placeId: "p2", text: { text: "Kjøpmannsgata 1, Stjørdal" } } },
      ],
    };
    expect(fromGoogle(res)).toEqual([
      { label: "Stjørdal stadion", detail: "Stadionvegen, Stjørdal", value: "Stjørdal stadion, Stadionvegen, Stjørdal", source: "google" },
      { label: "Kjøpmannsgata 1, Stjørdal", detail: "", value: "Kjøpmannsgata 1, Stjørdal", source: "google" },
    ]);
  });
  it("tomt eller feil svar gir ingen forslag", () => {
    expect(fromGoogle({})).toEqual([]);
    expect(fromGoogle(null)).toEqual([]);
  });
});

describe("recentPlaces", () => {
  it("steder brukt før som passer med det du skriver, flest ganger først, uten dubletter", () => {
    const used = ["Stjørdal stadion", "stjørdal stadion ", "Tannlegen", "Stjørdalshallen", "Stjørdal stadion", ""];
    expect(recentPlaces(used, "stjør").map((p) => p.value)).toEqual(["Stjørdal stadion", "Stjørdalshallen"]);
    expect(recentPlaces(used, "").map((p) => p.value)).toEqual(["Stjørdal stadion", "Tannlegen", "Stjørdalshallen"]);
  });
});

describe("mergePlaces", () => {
  it("brukte steder først, Google etter, ikke samme sted to ganger", () => {
    const recent = [{ label: "Stjørdal stadion", detail: "Brukt før", value: "Stjørdal stadion", source: "recent" as const }];
    const google = [
      { label: "Stjørdal stadion", detail: "Stadionvegen", value: "Stjørdal stadion", source: "google" as const },
      { label: "Stjørdalshallen", detail: "Stjørdal", value: "Stjørdalshallen, Stjørdal", source: "google" as const },
    ];
    expect(mergePlaces(recent, google).map((p) => p.value)).toEqual(["Stjørdal stadion", "Stjørdalshallen, Stjørdal"]);
  });
});

describe("autocompleteBody", () => {
  it("norsk, i Norge, nær Stjørdal", () => {
    expect(autocompleteBody("stadion", "tok")).toMatchObject({ input: "stadion", languageCode: "no", includedRegionCodes: ["no"], sessionToken: "tok", locationBias: { circle: { radius: 50000 } } });
  });
});

describe("mapsUrl", () => {
  it("lenke som åpner kartet på stedet", () => {
    expect(mapsUrl("Stjørdal stadion, Stjørdal")).toBe("https://www.google.com/maps/search/?api=1&query=Stj%C3%B8rdal%20stadion%2C%20Stj%C3%B8rdal");
  });
});
