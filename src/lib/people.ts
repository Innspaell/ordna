/**
 * Familie: hvem en ting gjelder, personvelgeren (hvem du vil se) og personfarger.
 */

/** Samme palett som sjekken i databasen (profiles_color). */
export const PERSON_COLORS = ["#0e7490", "#be185d", "#7c3aed", "#4338ca", "#0f766e", "#4d7c0f", "#a21caf", "#0369a1"] as const;
export const SHARED_COLOR = "#64748b";
/** Nøkkel for ting i Familie uten navn. */
export const SHARED = "shared";
export const SELECTION_COOKIE = "ordna_hvem";

export type Person = { key: string; name: string; color: string; initial: string; me: boolean };

/** Hvem en ting gjelder: personene på den; ellers Felles i Familie; ellers den som laget den. */
export function personKeys(
  i: { people: string[]; workspace_kind: string | null; created_by_profile_id: string | null },
  me?: string | null,
): string[] {
  if (i.people.length) return [...new Set(i.people)];
  if (i.workspace_kind === "family") return [SHARED];
  return [i.created_by_profile_id ?? me ?? SHARED];
}

export function personColor(p: { id: string; color: string | null }): string {
  if (p.color && (PERSON_COLORS as readonly string[]).includes(p.color)) return p.color;
  let h = 0;
  for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PERSON_COLORS[h % PERSON_COLORS.length];
}

export function defaultSelection(all: string[], me: string, child: boolean): string[] {
  return child ? all.filter((k) => k === me || k === SHARED) : [...all];
}

/** Leser cookien. Ukjente personer fjernes; tom eller ugyldig gir standard. */
export function parseSelection(raw: string | undefined, all: string[], me: string, child: boolean): string[] {
  if (raw === "none") return [];
  const wanted = new Set((raw ?? "").split(",").filter(Boolean));
  const picked = all.filter((k) => wanted.has(k));
  return picked.length ? picked : defaultSelection(all, me, child);
}

export const serializeSelection = (sel: string[]) => (sel.length ? sel.join(",") : "none");

export function togglePerson(sel: string[], key: string, all: string[]): string[] {
  const next = new Set(sel);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return all.filter((k) => next.has(k));
}

/** Vises når minst én av personene på tingen er valgt. */
export const isShown = (keys: string[], sel: string[]) => keys.some((k) => sel.includes(k));

/** Fokus er alltid ditt eget: det som gjelder deg, eller felles ting du selv har lagt inn. */
export const isMyFocus = (i: { keys: string[]; created_by_profile_id: string | null }, me: string) =>
  i.keys.includes(me) || (i.keys.includes(SHARED) && i.created_by_profile_id === me);
