import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describeRule, type Freq } from "./recurrence";

export type SeriesInfo = { label: string; index: number; total: number; until: string | null; freq: Freq; startsOn: string };

/** «Hver tirsdag og torsdag til 18.12.2026 · 2 av 8» for en ting i en serie. */
export async function loadSeriesInfo(supabase: SupabaseClient, seriesId: string | null, occurrence: string | null): Promise<SeriesInfo | null> {
  if (!seriesId) return null;
  const [{ data: s }, { count: total }, { count: before }] = await Promise.all([
    supabase.from("item_series").select("freq, weekdays, starts_on, until_date").eq("id", seriesId).maybeSingle(),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("series_id", seriesId),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("series_id", seriesId).lt("occurrence_date", occurrence ?? "0000-01-01"),
  ]);
  if (!s) return null;
  return { label: describeRule(s), index: (before ?? 0) + 1, total: total ?? 0, until: s.until_date, freq: s.freq, startsOn: s.starts_on };
}
