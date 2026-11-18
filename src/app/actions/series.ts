"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidDate } from "@/lib/inbox";
import { occurrences, type Freq, type SeriesRule } from "@/lib/recurrence";
import { saveSeries } from "@/lib/series-save";
import { seriesRows, templateOf } from "@/lib/series-rows";
import { osloParts } from "@/lib/item-edit";

type Result = { ok: true; count?: number } | { ok: false; message: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FREQS: Freq[] = ["daily", "weekly", "monthly", "yearly"];
const ITEM_COLS = "id, workspace_id, project_id, parent_id, kind, title, notes, location, starts_at, ends_at, all_day, due_date, pick_context, is_pickable, series_id, occurrence_date, item_people(profile_id)";
type ItemRow = Parameters<typeof templateOf>[0] & { id: string; series_id: string | null; occurrence_date: string | null; item_people: { profile_id: string }[] | null };

/** Gjør en oppgave eller avtale om til en serie. Denne blir første gang; resten legges inn med en gang. */
export async function makeRecurring(itemId: string, input: { freq: Freq; weekdays?: number[]; until?: string | null }): Promise<Result> {
  if (!UUID.test(itemId) || !FREQS.includes(input.freq)) return { ok: false, message: "Ukjent gjentakelse." };
  const until = input.until || null;
  if (!until && input.freq !== "yearly") return { ok: false, message: "Velg til og med når." };
  if (until && !isValidDate(until)) return { ok: false, message: "Ugyldig dato." };
  const weekdays = input.freq === "weekly" ? [...new Set(input.weekdays ?? [])].filter((d) => d >= 1 && d <= 7).sort() : null;
  if (input.freq === "weekly" && !weekdays?.length) return { ok: false, message: "Velg minst én dag." };

  const supabase = await createClient();
  const { data: item } = await supabase.from("items").select(ITEM_COLS).eq("id", itemId).in("kind", ["task", "appointment"]).maybeSingle();
  if (!item) return { ok: false, message: "Fant ikke elementet." };
  if (item.series_id) return { ok: false, message: "Denne gjentas allerede." };
  const date = item.kind === "task" ? (item.due_date as string | null) : item.starts_at ? osloParts(item.starts_at as string).date : null;
  if (!date) return { ok: false, message: "Sett en frist først." };
  if (until && until < date) return { ok: false, message: "Til og med må være etter første gang." };

  const rule: SeriesRule = { freq: input.freq, weekdays, starts_on: date, until_date: until };
  const people = ((item.item_people ?? []) as { profile_id: string }[]).map((p) => p.profile_id);
  const res = await saveSeries(supabase, templateOf(item as unknown as ItemRow), rule, people, { skip: occurrences(rule).filter((d) => d <= date), existingId: itemId });
  if (!res.ok) return res;
  await supabase.from("items").update({ series_id: res.seriesId, occurrence_date: date }).eq("id", itemId);
  revalidatePath("/", "layout");
  return { ok: true, count: res.ids.length };
}

/** Endre «til og med»: kortere sletter de senere gangene som ikke er gjort, lengre legger inn nye. */
export async function setSeriesUntil(itemId: string, until: string | null): Promise<Result> {
  if (!UUID.test(itemId) || (until && !isValidDate(until))) return { ok: false, message: "Ugyldig dato." };
  const supabase = await createClient();
  const { data: item } = await supabase.from("items").select("series_id").eq("id", itemId).maybeSingle();
  if (!item?.series_id) return { ok: false, message: "Denne gjentas ikke." };
  const { data: series } = await supabase.from("item_series").select("id, freq, weekdays, starts_on, until_date").eq("id", item.series_id).single();
  if (!series) return { ok: false, message: "Fant ikke serien." };
  if (!until && series.freq !== "yearly") return { ok: false, message: "Velg til og med når." };

  const { error } = await supabase.from("item_series").update({ until_date: until }).eq("id", series.id);
  if (error) return { ok: false, message: /until_range/.test(error.message) ? "Til og med må være etter start og høyst to år frem." : "Kunne ikke lagre." };

  const { data: lastRow } = await supabase.from("items").select(ITEM_COLS).eq("series_id", series.id).order("occurrence_date", { ascending: false }).limit(1).maybeSingle();
  const last = lastRow as unknown as ItemRow | null;
  const lastDate = (last?.occurrence_date as string | undefined) ?? series.starts_on;
  if (until && until < lastDate) {
    await supabase.from("items").delete().eq("series_id", series.id).gt("occurrence_date", until).neq("status", "done");
  } else if (last) {
    const rule = { ...series, until_date: until } as SeriesRule;
    const dates = occurrences(rule).filter((d) => d > lastDate);
    if (dates.length) {
      const rows = seriesRows(templateOf(last), dates, series.id);
      const { data: added, error: e } = await supabase.from("items").insert(rows).select("id");
      if (e) return { ok: false, message: "Kunne ikke legge inn de nye gangene." };
      const people = (last.item_people ?? []).map((p) => p.profile_id);
      const links = (added ?? []).flatMap((a) => people.map((p) => ({ item_id: a.id, profile_id: p })));
      if (links.length) await supabase.from("item_people").insert(links);
    }
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

