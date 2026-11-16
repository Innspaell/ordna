import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { personColor } from "./people";
import type { PersonTag } from "./week";

/** Personene som kan velges på et element (medlemmene i området), og hvem som er valgt. */
export async function loadItemPeople(supabase: SupabaseClient, itemId: string, workspaceId: string): Promise<{ options: PersonTag[]; selected: string[] }> {
  const [{ data: members }, { data: chosen }] = await Promise.all([
    supabase.from("memberships").select("profiles!inner(id, display_name, color)").eq("workspace_id", workspaceId),
    supabase.from("item_people").select("profile_id").eq("item_id", itemId),
  ]);
  type M = { profiles: { id: string; display_name: string; color: string | null } };
  const options = ((members ?? []) as unknown as M[])
    .map(({ profiles: p }) => ({ key: p.id, name: p.display_name, color: personColor(p), initial: p.display_name.charAt(0).toUpperCase() }))
    .sort((a, b) => a.name.localeCompare(b.name, "nb"));
  return { options, selected: (chosen ?? []).map((c) => c.profile_id as string) };
}
