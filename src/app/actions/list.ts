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

/** Fjerner det som er krysset av. */
export async function clearDone(projectId: string): Promise<ListResult> {
  if (!UUID.test(projectId)) return { ok: false, message: "Ukjent liste." };
  const supabase = await createClient();
  const { error } = await supabase.from("items").delete().eq("project_id", projectId).eq("status", "done");
  if (error) return { ok: false, message: "Kunne ikke rydde listen." };
  revalidatePath("/handleliste");
  return { ok: true };
}
