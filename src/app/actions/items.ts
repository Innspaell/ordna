"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadQuickAddContext } from "@/lib/quick-add/load";
import { appointmentPatch, moveSortOrder, projectFields, taskPatch, type AppointmentInput, type Patch, type TaskInput } from "@/lib/item-edit";

export type Result = { ok: true } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function applyPatch(id: string, kind: "task" | "appointment", patch: Patch): Promise<Result> {
  if (!UUID.test(id)) return { ok: false, message: "Ukjent element." };
  if (!Object.keys(patch).length) return { ok: true };
  const supabase = await createClient();
  const { data, error } = await supabase.from("items").update(patch).eq("id", id).eq("kind", kind).select("id");
  if (error || !data?.length) return { ok: false, message: "Kunne ikke lagre. Prøv igjen." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateTask(id: string, input: TaskInput): Promise<Result> {
  const res = taskPatch(input);
  if (!res.ok) return res;
  return applyPatch(id, "task", res.patch);
}

export async function updateAppointment(id: string, input: AppointmentInput): Promise<Result> {
  const res = appointmentPatch(input);
  if (!res.ok) return res;
  return applyPatch(id, "appointment", res.patch);
}

/** Flytter en oppgave eller avtale til et prosjekt eller delprosjekt, eller ut av prosjekt. */
export async function moveItem(id: string, kind: "task" | "appointment", optionId: string | null): Promise<Result> {
  if (!UUID.test(id)) return { ok: false, message: "Ukjent element." };
  const supabase = await createClient();
  const { projects } = await loadQuickAddContext(supabase);
  const res = projectFields(optionId, projects);
  if (!res.ok) return res;
  return applyPatch(id, kind, res.patch);
}

export async function deleteItemById(id: string): Promise<Result> {
  if (!UUID.test(id)) return { ok: false, message: "Ukjent element." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("items").delete().eq("id", id).in("kind", ["task", "appointment"]).select("id");
  if (error || !data?.length) return { ok: false, message: "Kunne ikke slette." };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ── Sjekkliste ──────────────────────────────────────────────────
export async function addChecklistItem(itemId: string, text: string): Promise<Result> {
  const t = text.trim();
  if (!UUID.test(itemId) || !t) return { ok: false, message: "Skriv et punkt." };
  const supabase = await createClient();
  const { data: last } = await supabase.from("checklist_items").select("sort_order").eq("item_id", itemId).order("sort_order", { ascending: false }).limit(1);
  const next = last?.length ? Number(last[0].sort_order) + 1 : 0;
  // workspace_id settes av triggeren fra oppgaven; verdien her er bare en plassholder som overskrives
  const { data: item } = await supabase.from("items").select("workspace_id").eq("id", itemId).single();
  if (!item) return { ok: false, message: "Fant ikke oppgaven." };
  const { error } = await supabase.from("checklist_items").insert({ item_id: itemId, workspace_id: item.workspace_id, text: t, sort_order: next });
  if (error) return { ok: false, message: "Kunne ikke legge til punktet." };
  revalidatePath(`/oppgave/${itemId}`);
  return { ok: true };
}

export async function toggleChecklistItem(id: string, done: boolean): Promise<Result> {
  if (!UUID.test(id)) return { ok: false, message: "Ukjent punkt." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("checklist_items").update({ is_done: done }).eq("id", id).select("item_id");
  if (error || !data?.length) return { ok: false, message: "Kunne ikke oppdatere." };
  revalidatePath(`/oppgave/${data[0].item_id}`);
  return { ok: true };
}

export async function deleteChecklistItem(id: string): Promise<Result> {
  if (!UUID.test(id)) return { ok: false, message: "Ukjent punkt." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("checklist_items").delete().eq("id", id).select("item_id");
  if (error || !data?.length) return { ok: false, message: "Kunne ikke slette." };
  revalidatePath(`/oppgave/${data[0].item_id}`);
  return { ok: true };
}

export async function moveChecklistItem(itemId: string, id: string, dir: -1 | 1): Promise<Result> {
  if (!UUID.test(itemId) || !UUID.test(id) || (dir !== -1 && dir !== 1)) return { ok: false, message: "Ugyldig." };
  const supabase = await createClient();
  const { data: list } = await supabase.from("checklist_items").select("id, sort_order, created_at").eq("item_id", itemId).order("sort_order").order("created_at");
  const changes = moveSortOrder((list ?? []).map((r) => ({ id: r.id as string, sort_order: Number(r.sort_order) })), id, dir);
  for (const c of changes) {
    const { error } = await supabase.from("checklist_items").update({ sort_order: c.sort_order }).eq("id", c.id);
    if (error) return { ok: false, message: "Kunne ikke flytte." };
  }
  revalidatePath(`/oppgave/${itemId}`);
  return { ok: true };
}

/** Hvem oppgaven eller avtalen gjelder (familien). null = ingen. */
export async function setAssignee(id: string, kind: "task" | "appointment", profileId: string | null): Promise<Result> {
  if (profileId !== null && !UUID.test(profileId)) return { ok: false, message: "Ukjent person." };
  return applyPatch(id, kind, { assignee_profile_id: profileId });
}
