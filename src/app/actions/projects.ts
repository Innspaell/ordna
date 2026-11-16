"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadQuickAddContext } from "@/lib/quick-add/load";
import { osloToday, parseQuickAdd } from "@/lib/quick-add/parse";
import { toItemRow } from "@/lib/quick-add/to-row";
import { isValidDate } from "@/lib/inbox";

export type Result<T = undefined> = { ok: true; data?: T } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const okId = (id: string | null | undefined) => id === null || id === undefined || UUID.test(id);

function refresh(): void {
  revalidatePath("/", "layout");
}

export async function createProject(input: { name: string; workspaceId?: string; dueDate?: string }): Promise<Result<string>> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Prosjektet må ha et navn." };
  if (input.dueDate && !isValidDate(input.dueDate)) return { ok: false, message: "Ugyldig dato." };
  if (!okId(input.workspaceId)) return { ok: false, message: "Ukjent arbeidsområde." };

  const supabase = await createClient();
  const workspaceId = input.workspaceId || (await loadQuickAddContext(supabase)).defaultWorkspaceId;
  if (!workspaceId) return { ok: false, message: "Fant ikke arbeidsområdet ditt." };

  const { data, error } = await supabase
    .from("projects")
    .insert({ workspace_id: workspaceId, name, due_date: input.dueDate || null })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: "Kunne ikke lage prosjektet." };
  refresh();
  return { ok: true, data: data.id as string };
}

/** Legger til en oppgave eller avtale i et prosjekt eller delprosjekt. Teksten tolkes som i rask registrering. */
export async function addToGroup(projectId: string, parentId: string | null, text: string): Promise<Result> {
  if (!UUID.test(projectId) || !okId(parentId)) return { ok: false, message: "Ukjent prosjekt." };
  const supabase = await createClient();
  const ctx = await loadQuickAddContext(supabase);
  if (!ctx.defaultWorkspaceId) return { ok: false, message: "Fant ikke arbeidsområdet ditt." };

  const parsed = parseQuickAdd(text, { today: osloToday(), projects: [], ignore: ["project"] });
  const res = toItemRow(parsed, { defaultWorkspaceId: ctx.defaultWorkspaceId, projects: [] });
  if (!res.ok) return { ok: false, message: "Skriv hva det gjelder." };

  const row = { ...res.row, project_id: projectId, parent_id: parentId, in_inbox: false };
  const { error } = await supabase.from("items").insert(row);
  if (error) return { ok: false, message: "Kunne ikke lagre." };
  refresh();
  return { ok: true };
}

export async function addSubproject(projectId: string, parentId: string | null, name: string): Promise<Result> {
  const title = name.trim();
  if (!title) return { ok: false, message: "Delprosjektet må ha et navn." };
  if (!UUID.test(projectId) || !okId(parentId)) return { ok: false, message: "Ukjent prosjekt." };
  const supabase = await createClient();
  const { defaultWorkspaceId } = await loadQuickAddContext(supabase);
  if (!defaultWorkspaceId) return { ok: false, message: "Fant ikke arbeidsområdet ditt." };

  const { error } = await supabase
    .from("items")
    .insert({ workspace_id: defaultWorkspaceId, project_id: projectId, parent_id: parentId, kind: "subproject", title });
  if (error) return { ok: false, message: "Kunne ikke lage delprosjektet." };
  refresh();
  return { ok: true };
}

export async function setTaskDone(itemId: string, done: boolean): Promise<Result> {
  if (!UUID.test(itemId)) return { ok: false, message: "Ukjent oppgave." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .update({ status: done ? "done" : "ready", ...(done ? { in_inbox: false } : {}) })
    .eq("id", itemId)
    .eq("kind", "task")
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Kunne ikke oppdatere." };
  refresh();
  return { ok: true };
}
