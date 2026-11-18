/** Sted: forslag fra steder brukt før og fra Google (Places API, Autocomplete New). */
export type PlaceSuggestion = { label: string; detail: string; value: string; source: "recent" | "google" };

const norm = (s: string) => s.trim().toLocaleLowerCase("nb");

type GoogleText = { text?: string } | undefined;
type GoogleResponse = {
  suggestions?: { placePrediction?: { placeId?: string; text?: GoogleText; structuredFormat?: { mainText?: GoogleText; secondaryText?: GoogleText } } }[];
} | null;

export function fromGoogle(res: unknown): PlaceSuggestion[] {
  const r = res as GoogleResponse;
  return (r?.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction;
    const value = p?.text?.text;
    if (!value) return [];
    const label = p.structuredFormat?.mainText?.text ?? value;
    const detail = p.structuredFormat?.secondaryText?.text ?? "";
    return [{ label, detail, value, source: "google" as const }];
  });
}

/** Steder brukt før: de som inneholder det du skriver, mest brukte først. */
export function recentPlaces(used: string[], q: string, limit = 5): PlaceSuggestion[] {
  const counts = new Map<string, { value: string; n: number }>();
  for (const u of used) {
    const v = u.trim();
    if (!v) continue;
    const k = norm(v);
    const c = counts.get(k);
    if (c) c.n++;
    else counts.set(k, { value: v, n: 1 });
  }
  const query = norm(q);
  return [...counts.entries()]
    .filter(([k]) => !query || k.includes(query))
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, limit)
    .map(([, c]) => ({ label: c.value, detail: "Brukt før", value: c.value, source: "recent" as const }));
}

export function mergePlaces(recent: PlaceSuggestion[], google: PlaceSuggestion[], limit = 8): PlaceSuggestion[] {
  const seen = new Set(recent.flatMap((r) => [norm(r.value), norm(r.label)]));
  return [...recent, ...google.filter((g) => !seen.has(norm(g.value)) && !seen.has(norm(g.label)))].slice(0, limit);
}

// Stjørdal sentrum: forslag i nærheten kommer først, men hele Norge er med
const NEAR = { latitude: 63.4697, longitude: 10.9187 };

export function autocompleteBody(input: string, sessionToken: string) {
  return {
    input,
    languageCode: "no",
    regionCode: "no",
    includedRegionCodes: ["no"],
    locationBias: { circle: { center: NEAR, radius: 50000 } },
    sessionToken,
  };
}

export const mapsUrl = (place: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.trim())}`;
