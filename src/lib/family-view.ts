/**
 * Server: hvem som er i familien, hvem du har valgt å se (cookie), og hvem hver rad gjelder.
 */
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SELECTION_COOKIE, SHARED, SHARED_COLOR, isMyFocus, isShown, parseSelection, personColor, personKeys, type Person } from "./people";
import type { PersonTag } from "./week";

export const ROWS_COOKIE = "ordna_rader";

/** Felt hver elementspørring trenger for personvelgeren. */
export const PERSON_COLS = "created_by_profile_id, workspaces(kind), item_people(profile_id)";

export type PersonFields = {
  created_by_profile_id: string | null;
  item_people: { profile_id: string }[] | null;
  workspaces: { kind: string } | null;
};

export type FamilyView = {
  /** Personvelgeren vises bare når det finnes en familie med flere enn deg */
  enabled: boolean;
  me: string;
  child: boolean;
  people: Person[];
  selection: string[];
  rows: "project" | "person";
};

export async function loadFamilyView(supabase: SupabaseClient): Promise<FamilyView> {
  const { data: me } = await supabase.rpc("current_profile_id");
  const myId = (me as string | null) ?? "";
  const { data: fam } = await supabase.from("workspaces").select("id").eq("kind", "family").order("created_at").limit(1).maybeSingle();
  const [{ data: mine }, members] = await Promise.all([
    supabase.from("profiles").select("managed_by_profile_id").eq("id", myId).maybeSingle(),
    fam
      ? supabase.from("memberships").select("profiles!inner(id, display_name, color, managed_by_profile_id)").eq("workspace_id", fam.id)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const child = !!mine?.managed_by_profile_id;
  type M = { profiles: { id: string; display_name: string; color: string | null; managed_by_profile_id: string | null } };
  const profiles = ((members.data ?? []) as M[]).map((m) => m.profiles);
  // Meg først, så voksne, så barn
  profiles.sort((a, b) => Number(b.id === myId) - Number(a.id === myId) || Number(!!a.managed_by_profile_id) - Number(!!b.managed_by_profile_id) || a.display_name.localeCompare(b.display_name, "nb"));

  const people: Person[] = profiles.map((p) => ({ key: p.id, name: p.display_name, color: personColor(p), initial: p.display_name.charAt(0).toUpperCase(), me: p.id === myId }));
  if (fam) people.push({ key: SHARED, name: "Felles", color: SHARED_COLOR, initial: "★", me: false });

  const jar = await cookies();
  const all = people.map((p) => p.key);
  const enabled = profiles.length > 1;
  return {
    enabled,
    me: myId,
    child,
    people,
    selection: enabled ? parseSelection(jar.get(SELECTION_COOKIE)?.value, all, myId, child) : all,
    rows: jar.get(ROWS_COOKIE)?.value === "person" ? "person" : "project",
  };
}

/** Personene raden gjelder, og merkene som skal vises (ikke for dine egne ting utenfor Familie). */
export function personOf(r: PersonFields, fv: FamilyView): { keys: string[]; tags: PersonTag[] } {
  const people = (r.item_people ?? []).map((p) => p.profile_id);
  const keys = personKeys({ people, workspace_kind: r.workspaces?.kind ?? null, created_by_profile_id: r.created_by_profile_id }, fv.me);
  const showTags = people.length > 0 || r.workspaces?.kind === "family";
  const tags = showTags
    ? keys.flatMap((k) => {
        const p = fv.people.find((x) => x.key === k);
        return p ? [{ key: p.key, name: p.name, color: p.color, initial: p.initial }] : [];
      })
    : [];
  return { keys, tags };
}

/** «Erlend og Ingrid» */
export const joinNames = (tags: PersonTag[]) => {
  const n = tags.map((t) => t.name);
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} og ${n[n.length - 1]}` : (n[0] ?? null);
};

export const visible = (r: PersonFields, fv: FamilyView) => !fv.enabled || isShown(personOf(r, fv).keys, fv.selection);
export const myFocus = (r: PersonFields, fv: FamilyView) => !fv.enabled || isMyFocus({ keys: personOf(r, fv).keys, created_by_profile_id: r.created_by_profile_id }, fv.me);
