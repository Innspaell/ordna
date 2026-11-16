"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadQuickAddContext } from "@/lib/quick-add/load";
import { inboxPatch } from "@/lib/inbox";
import type { PickContext } from "@/lib/quick-add/parse";

export type ActionResult = { ok: true } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ProcessInput =
  | { type: "project"; optionId: string }
  | { type: "pick"; context: PickContext }
  | { type: "due"; date: string }
  | { type: "done" };

function done(): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Behandler et element i innboksen: prosjekt, plukkliste, frist eller fullført. */
export async function processInboxItem(itemId: string, input: ProcessInput): Promise<ActionResult> {
  if (!UUID.test(itemId)) return { ok: false, message: "Ukjent element." };
  const supabase = await createClient();

  let result;
  if (input.type === "project") {
    // Slå opp prosjektet på serveren, så vi bare bruker prosjekter brukeren faktisk ser
    const { projects } = await loadQuickAddContext(supabase);
    const option = projects.find((p) => p.id === input.optionId);
    if (!option) return { ok: false, message: "Fant ikke prosjektet." };
    result = inboxPatch({ type: "project", option });
  } else {
    result = inboxPatch(input);
  }
  if (!result.ok) return { ok: false, message: "Ugyldig valg." };

  const { data, error } = await supabase.from("items").update(result.patch).eq("id", itemId).select("id");
  if (error || !data?.length) return { ok: false, message: "Kunne ikke lagre. Prøv igjen." };
  return done();
}

/** Lager et nytt prosjekt i Jobb og legger elementet i det. */
export async function createProjectFromInbox(itemId: string, name: string): Promise<ActionResult> {
  const clean = name.trim();
  if (!UUID.test(itemId) || !clean) return { ok: false, message: "Skriv et navn på prosjektet." };
  const supabase = await createClient();
  const { defaultWorkspaceId } = await loadQuickAddContext(supabase);
  if (!defaultWorkspaceId) return { ok: false, message: "Fant ikke arbeidsområdet ditt." };

  const { data: project, error } = await supabase.from("projects").insert({ workspace_id: defaultWorkspaceId, name: clean }).select("id").single();
  if (error || !project) return { ok: false, message: "Kunne ikke lage prosjektet." };

  const { error: moveError } = await supabase.from("items").update({ project_id: project.id, parent_id: null, in_inbox: false }).eq("id", itemId);
  if (moveError) return { ok: false, message: "Prosjektet ble laget, men oppgaven ble ikke flyttet." };
  return done();
}

export async function deleteItem(itemId: string): Promise<ActionResult> {
  if (!UUID.test(itemId)) return { ok: false, message: "Ukjent element." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("items").delete().eq("id", itemId).select("id");
  if (error || !data?.length) return { ok: false, message: "Kunne ikke slette." };
  return done();
}
