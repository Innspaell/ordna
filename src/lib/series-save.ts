import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { occurrences, type SeriesRule } from "./recurrence";
import { seriesRows, type SeriesTemplate } from "./series-rows";

/**
 * Lager en serie og alle gangene i den med en gang. `skip` er datoer som allerede finnes
 * (når en eksisterende ting gjøres om til en serie). Personene legges på hver gang.
 */
export async function saveSeries(
  supabase: SupabaseClient,
  template: SeriesTemplate,
  rule: SeriesRule,
  people: string[],
  opts: { skip?: string[]; existingId?: string } = {},
): Promise<{ ok: true; seriesId: string; ids: string[] } | { ok: false; message: string }> {
  const { data: series, error } = await supabase
    .from("item_series")
    .insert({ workspace_id: template.workspace_id, freq: rule.freq, weekdays: rule.freq === "weekly" ? rule.weekdays : null, starts_on: rule.starts_on, until_date: rule.until_date })
    .select("id")
    .single();
  if (error || !series) return { ok: false, message: /until_range/.test(error?.message ?? "") ? "Sluttdatoen kan være høyst to år frem." : "Kunne ikke lagre gjentakelsen." };

  const skip = new Set(opts.skip ?? []);
  const dates = occurrences(rule).filter((d) => !skip.has(d));
  const rows = seriesRows(template, dates, series.id);
  const ids: string[] = [];
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error: e } = await supabase.from("items").insert(rows.slice(i, i + 200)).select("id");
    if (e) {
      await supabase.from("item_series").delete().eq("id", series.id);
      await supabase.from("items").delete().in("id", ids);
      return { ok: false, message: "Kunne ikke lagre gjentakelsen." };
    }
    ids.push(...(data ?? []).map((r) => r.id as string));
  }
  if (opts.existingId) ids.unshift(opts.existingId);
  if (people.length && ids.length) {
    const links = ids.filter((id) => id !== opts.existingId).flatMap((id) => people.map((p) => ({ item_id: id, profile_id: p })));
    for (let i = 0; i < links.length; i += 500) await supabase.from("item_people").insert(links.slice(i, i + 500));
  }
  return { ok: true, seriesId: series.id, ids };
}
