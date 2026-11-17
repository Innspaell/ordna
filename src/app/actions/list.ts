"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ListResult = { ok: true } | { ok: false; message: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Legger til én eller flere ting (komma eller linjeskift skiller). */
export async function addToList(projectId: string, text: string): Promise<ListResult> {
  const titles = text.split(/[,\n]/).map((t) => t.trim()).filter(Boolean).slice(0, 30);
  if (!UUID.test(projectId) || !titles.length) return { ok: false, message: "Skriv hva som trengs." };
  const supabase = await createClient();
  const { data: list } = await supabase.from("projects").select("workspace_id").eq("id", projectId).eq("kind", "list").maybeSingle();
  if (!list) return { ok: false, message: "Fant ikke listen." };
  const { error } = await supabase
    .from("items")
    .insert(titles.map((title) => ({ workspace_id: list.workspace_id, project_id: projectId, kind: "task", title })));
  if (error) return { ok: false, message: "Kunne ikke legge til." };
  revalidatePath("/handleliste");
  return { ok: true };
}

/** Rydder bort det som er krysset av. Skjules, slettes ikke, så det kan angres og dukker opp i «Nylig handlet». */
export async function clearDone(projectId: string): Promise<{ ok: true; ids: string[] } | { ok: false; message: string }> {
  if (!UUID.test(projectId)) return { ok: false, message: "Ukjent liste." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .update({ cleared_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("status", "done")
    .is("cleared_at", null)
    .select("id");
  if (error) return { ok: false, message: "Kunne ikke rydde listen." };
  revalidatePath("/handleliste");
  return { ok: true, ids: (data ?? []).map((r) => r.id as string) };
}

/** Angre rydding: varene kommer tilbake som avkrysset. */
export async function undoClear(ids: string[]): Promise<ListResult> {
  if (!ids.length || ids.length > 200 || ids.some((id) => !UUID.test(id))) return { ok: false, message: "Ingenting å angre." };
  const supabase = await createClient();
  const { error } = await supabase.from("items").update({ cleared_at: null }).in("id", ids);
  if (error) return { ok: false, message: "Kunne ikke angre." };
  revalidatePath("/handleliste");
  return { ok: true };
}

/** «Nylig handlet»: legg varen på listen igjen med ett trykk. */
export async function putBack(id: string): Promise<ListResult> {
  if (!UUID.test(id)) return { ok: false, message: "Ukjent vare." };
  const supabase = await createClient();
  const { error } = await supabase.from("items").update({ status: "ready", cleared_at: null }).eq("id", id).not("cleared_at", "is", null);
  if (error) return { ok: false, message: "Kunne ikke legge tilbake." };
  revalidatePath("/handleliste");
  return { ok: true };
}
