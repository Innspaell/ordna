"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadQuickAddContext } from "@/lib/quick-add/load";
import { appointmentPatch, moveSortOrder, projectFields, taskPatch, type AppointmentInput, type Patch, type TaskInput } from "@/lib/item-edit";

export type Result = { ok: true } | { ok: false; message: string };
/** Gjentakelser: endringen gjelder bare denne, eller denne og resten av serien fremover. */
export type Scope = "one" | "future";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Client = Awaited<ReturnType<typeof createClient>>;

/** Id-ene endringen skal gjelde: denne, eller denne og de senere i samme serie. */
async function scopeRows(supabase: Client, id: string, scope: Scope): Promise<{ id: string; occurrence_date: string | null }[]> {
  if (scope === "one") return [{ id, occurrence_date: null }];
  const { data: item } = await supabase.from("items").select("series_id, occurrence_date").eq("id", id).maybeSingle();
  if (!item?.series_id || !item.occurrence_date) return [{ id, occurrence_date: null }];
  const { data } = await supabase.from("items").select("id, occurrence_date").eq("series_id", item.series_id).gte("occurrence_date", item.occurrence_date).order("occurrence_date");
  const rows = (data ?? []) as { id: string; occurrence_date: string | null }[];
  return rows.some((r) => r.id === id) ? rows : [{ id, occurrence_date: null }, ...rows];
}

async function applyPatch(id: string, kind: "task" | "appointment", patch: Patch, scope: Scope = "one", seriesPatch: Patch = patch): Promise<Result> {
  if (!UUID.test(id)) return { ok: false, message: "Ukjent element." };
  if (!Object.keys(patch).length) return { ok: true };
  const supabase = await createClient();
  const { data, error } = await supabase.from("items").update(patch).eq("id", id).eq("kind", kind).select("id");
  if (error || !data?.length) return { ok: false, message: "Kunne ikke lagre. Prøv igjen." };
  if (scope === "future" && Object.keys(seriesPatch).length) {
    const others = (await scopeRows(supabase, id, scope)).map((r) => r.id).filter((x) => x !== id);
    if (others.length) {
      const { error: e } = await supabase.from("items").update(seriesPatch).in("id", others).eq("kind", kind);
      if (e) return { ok: false, message: "Lagret denne, men ikke resten av serien." };
    }
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateTask(id: string, input: TaskInput, scope: Scope = "one"): Promise<Result> {
  const res = taskPatch(input);
  if (!res.ok) return res;
  // Frist og status gjelder alltid bare denne ene
  const { due_date: _d, status: _s, ...rest } = res.patch;
  void _d;
  void _s;
  return applyPatch(id, "task", res.patch, scope, rest);
}

export async function updateAppointment(id: string, input: AppointmentInput, scope: Scope = "one"): Promise<Result> {
  const res = appointmentPatch(input);
  if (!res.ok) return res;
  if (scope === "one") return applyPatch(id, "appointment", res.patch);
  // Denne og fremover: samme klokkeslett og innhold, men hver gang beholder datoen sin
  const saved = await applyPatch(id, "appointment", res.patch);
  if (!saved.ok) return saved;
  const supabase = await createClient();
  const rows = (await scopeRows(supabase, id, scope)).filter((r) => r.id !== id && r.occurrence_date);
  for (let i = 0; i < rows.length; i += 10) {
    const results = await Promise.all(
      rows.slice(i, i + 10).map((r) => {
        const p = appointmentPatch({ ...input, date: r.occurrence_date! });
        return p.ok ? supabase.from("items").update(p.patch).eq("id", r.id).eq("kind", "appointment") : Promise.resolve({ error: null });
      }),
    );
    if (results.some((x) => x.error)) return { ok: false, message: "Lagret denne, men ikke hele resten av serien." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Flytter en oppgave eller avtale til et prosjekt eller delprosjekt, eller ut av prosjekt. */
export async function moveItem(id: string, kind: "task" | "appointment", optionId: string | null, scope: Scope = "one"): Promise<Result> {
  if (!UUID.test(id)) return { ok: false, message: "Ukjent element." };
  const supabase = await createClient();
  const { projects } = await loadQuickAddContext(supabase);
  const res = projectFields(optionId, projects);
  if (!res.ok) return res;
  return applyPatch(id, kind, res.patch, scope);
}

export async function deleteItemById(id: string, scope: Scope = "one"): Promise<Result> {
  if (!UUID.test(id)) return { ok: false, message: "Ukjent element." };
  const supabase = await createClient();
  const ids = (await scopeRows(supabase, id, scope)).map((r) => r.id);
  const { data, error } = await supabase.from("items").delete().in("id", ids).in("kind", ["task", "appointment"]).select("id");
  if (error || !data?.length) return { ok: false, message: "Kunne ikke slette." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Avlys (eller gjenopprett) en avtale; avlyste vises overstreket. */
export async function cancelAppointment(id: string, cancel: boolean, scope: Scope = "one"): Promise<Result> {
  if (!UUID.test(id)) return { ok: false, message: "Ukjent avtale." };
  const supabase = await createClient();
  const ids = (await scopeRows(supabase, id, scope)).map((r) => r.id);
  const { data, error } = await supabase.from("items").update({ status: cancel ? "cancelled" : "ready" }).in("id", ids).eq("kind", "appointment").select("id");
  if (error || !data?.length) return { ok: false, message: "Kunne ikke lagre." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** «Fullfør alle» under Forfalt. */
export async function completeTasks(ids: string[]): Promise<Result> {
  if (!ids.length || ids.length > 500 || ids.some((x) => !UUID.test(x))) return { ok: false, message: "Ingenting å fullføre." };
  const supabase = await createClient();
  const { error } = await supabase.from("items").update({ status: "done" }).in("id", ids).eq("kind", "task");
  if (error) return { ok: false, message: "Kunne ikke fullføre." };
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

/** Hvem oppgaven eller avtalen gjelder (familien). Tom liste = ingen. Databasen sjekker at personene er med i området. */
export async function setPeople(itemId: string, profileIds: string[], scope: Scope = "one"): Promise<Result> {
  if (!UUID.test(itemId) || profileIds.some((p) => !UUID.test(p)) || profileIds.length > 20) return { ok: false, message: "Ukjent person." };
  const supabase = await createClient();
  if (scope === "future") {
    for (const r of await scopeRows(supabase, itemId, scope)) {
      const res = await setPeopleOn(supabase, r.id, profileIds);
      if (!res.ok) return res;
    }
    revalidatePath("/", "layout");
    return { ok: true };
  }
  const res = await setPeopleOn(supabase, itemId, profileIds);
  if (res.ok) revalidatePath("/", "layout");
  return res;
}

async function setPeopleOn(supabase: Client, itemId: string, profileIds: string[]): Promise<Result> {
  const { data: current, error: readError } = await supabase.from("item_people").select("profile_id").eq("item_id", itemId);
  if (readError) return { ok: false, message: "Kunne ikke lagre hvem." };
  const now = new Set((current ?? []).map((r) => r.profile_id as string));
  const want = new Set(profileIds);
  const remove = [...now].filter((p) => !want.has(p));
  const add = [...want].filter((p) => !now.has(p));
  if (remove.length) {
    const { error } = await supabase.from("item_people").delete().eq("item_id", itemId).in("profile_id", remove);
    if (error) return { ok: false, message: "Kunne ikke lagre hvem." };
  }
  if (add.length) {
    const { error } = await supabase.from("item_people").insert(add.map((p) => ({ item_id: itemId, profile_id: p })));
    if (error) return { ok: false, message: /ikke med/.test(error.message) ? "Personen er ikke med i dette området." : "Kunne ikke lagre hvem." };
  }
  return { ok: true };
}
