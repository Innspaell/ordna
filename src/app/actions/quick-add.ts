"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadQuickAddContext } from "@/lib/quick-add/load";
import {
  osloToday,
  parseQuickAdd,
  type ChipType,
  type ProjectOption,
} from "@/lib/quick-add/parse";
import { toItemRow } from "@/lib/quick-add/to-row";
import { saveSeries } from "@/lib/series-save";
import { templateOf } from "@/lib/series-rows";

export type QuickAddState =
  | { status: "saved"; title: string; where: string }
  | { status: "needs_until" }
  | { status: "choose_project"; candidates: ProjectOption[] }
  | { status: "error"; message: string };

export async function quickAdd(input: {
  text: string;
  ignore?: ChipType[];
  chosenProjectId?: string;
  durationMs?: number;
  source?: "sheet" | "page" | "shortcut";
}): Promise<QuickAddState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Du er ikke logget inn." };

  const profileId = (await supabase.rpc("ensure_my_setup")).data as
    string | null;
  const ctx = await loadQuickAddContext(supabase);
  if (!ctx.defaultWorkspaceId)
    return { status: "error", message: "Fant ikke arbeidsområdet ditt." };

  const parsed = parseQuickAdd(input.text, {
    today: osloToday(),
    projects: ctx.projects,
    people: ctx.people,
    workspaces: ctx.workspaces,
    ignore: input.ignore,
  });
  const result = toItemRow(parsed, {
    defaultWorkspaceId: ctx.defaultWorkspaceId,
    familyWorkspaceId: ctx.familyWorkspaceId,
    projects: ctx.projects,
    chosenProjectId: input.chosenProjectId,
  });
  if (!result.ok) {
    if (result.reason === "choose_project")
      return { status: "choose_project", candidates: result.candidates };
    return { status: "error", message: "Skriv hva det gjelder." };
  }

  let where = result.where;
  const rep = parsed.repeat;
  if (rep) {
    // Gjentakelse: sluttdato kreves, unntatt for hvert år (merkedager)
    if (!rep.until && rep.freq !== "yearly") return { status: "needs_until" };
    const start =
      (result.row.kind === "task" ? result.row.due_date : parsed.startDate) ??
      osloToday();
    const res = await saveSeries(
      supabase,
      templateOf({
        ...result.row,
        notes: null,
        location: null,
        all_day: false,
      }),
      {
        freq: rep.freq,
        weekdays: rep.weekdays ?? null,
        starts_on: start,
        until_date: rep.until ?? null,
      },
      result.people,
    );
    if (!res.ok) return { status: "error", message: res.message };
    where = `${where} · ${res.ids.length} ganger`;
  } else {
    const { data: saved, error } = await supabase
      .from("items")
      .insert(result.row)
      .select("id")
      .single();
    if (error || !saved)
      return { status: "error", message: "Kunne ikke lagre. Prøv igjen." };

    if (result.people.length) {
      const { error: pe } = await supabase
        .from("item_people")
        .insert(
          result.people.map((pid) => ({ item_id: saved.id, profile_id: pid })),
        );
      if (pe)
        where = `${where} (uten personer: de er ikke med i dette området)`;
    }
  }

  if (profileId) {
    const ms = input.durationMs;
    await supabase.from("usage_events").insert({
      profile_id: profileId,
      event: `quick_add:${input.source ?? "sheet"}`,
      duration_ms:
        typeof ms === "number" && ms >= 0 && ms < 3_600_000
          ? Math.round(ms)
          : null,
    });
  }

  revalidatePath("/", "layout");
  return { status: "saved", title: result.row.title, where };
}
