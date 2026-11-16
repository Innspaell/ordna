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

export function personKey(
  i: { assignee_profile_id: string | null; workspace_kind: string | null; created_by_profile_id: string | null },
  me?: string | null,
): string {
  if (i.assignee_profile_id) return i.assignee_profile_id;
  if (i.workspace_kind === "family") return SHARED;
  return i.created_by_profile_id ?? me ?? SHARED;
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

export const isShown = (key: string, sel: string[]) => sel.includes(key);

/** Fokus er alltid ditt eget: det som gjelder deg, eller felles ting du selv har lagt inn. */
export const isMyFocus = (i: { key: string; created_by_profile_id: string | null }, me: string) =>
  i.key === me || (i.key === SHARED && i.created_by_profile_id === me);
