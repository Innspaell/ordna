"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { focusDecision, FOCUS_LIMIT } from "@/lib/focus";
import { osloToday } from "@/lib/quick-add/parse";

export type FocusResult = { ok: true } | { ok: false; full?: boolean; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Legger oppgaven i Fokus i dag. Høyst tre om gangen. */
export async function pickForToday(itemId: string): Promise<FocusResult> {
  if (!UUID.test(itemId)) return { ok: false, message: "Ukjent oppgave." };
  const supabase = await createClient();
  const today = osloToday();
  const { data: current, error } = await supabase
    .from("items")
    .select("id")
    .eq("kind", "task")
    .eq("focus_date", today)
    .not("status", "in", "(done,cancelled)");
  if (error) return { ok: false, message: "Kunne ikke hente fokus." };

  const decision = focusDecision((current ?? []).map((r) => r.id as string), itemId);
  if (decision === "already") return { ok: true };
  if (decision === "full") return { ok: false, full: true, message: `Du har allerede ${FOCUS_LIMIT} fokusoppgaver i dag. Fjern en først.` };

  const { data, error: upd } = await supabase.from("items").update({ focus_date: today, in_inbox: false }).eq("id", itemId).eq("kind", "task").select("id");
  if (upd || !data?.length) return { ok: false, message: "Kunne ikke plukke oppgaven." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function clearFocus(itemId: string): Promise<FocusResult> {
  if (!UUID.test(itemId)) return { ok: false, message: "Ukjent oppgave." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("items").update({ focus_date: null }).eq("id", itemId).select("id");
  if (error || !data?.length) return { ok: false, message: "Kunne ikke fjerne fra fokus." };
  revalidatePath("/", "layout");
  return { ok: true };
}
