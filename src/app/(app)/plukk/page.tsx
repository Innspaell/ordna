import { createClient } from "@/lib/supabase/server";
import { parseContextFilter } from "@/lib/focus";
import { osloToday, type PickContext } from "@/lib/quick-add/parse";
import { PickList, type PickRow } from "@/components/PickList";

export const metadata = { title: "Plukkliste · Ordna" };

type Row = { id: string; title: string; pick_context: PickContext | null; due_date: string | null; projects: { name: string } | null };
const toRow = (r: Row): PickRow => ({ id: r.id, title: r.title, context: r.pick_context, due_date: r.due_date, project: r.projects?.name ?? null });

export default async function PickPage({ searchParams }: { searchParams: Promise<{ sted?: string }> }) {
  const { sted } = await searchParams;
  const filter = parseContextFilter(sted);
  const today = osloToday();
  const supabase = await createClient();

  let pickQ = supabase
    .from("items")
    .select("id, title, pick_context, due_date, projects(name)")
    .eq("kind", "task")
    .eq("is_pickable", true)
    .not("status", "in", "(done,cancelled)")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (filter) pickQ = pickQ.eq("pick_context", filter);

  const [{ data: focus }, { data: items }] = await Promise.all([
    supabase
      .from("items")
      .select("id, title, pick_context, due_date, projects(name)")
      .eq("kind", "task")
      .eq("focus_date", today)
      .not("status", "in", "(done,cancelled)")
      .order("updated_at"),
    pickQ,
  ]);

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-8">
      <header>
        <h1 className="h1">Plukkliste</h1>
        <p className="mt-1 text-sm text-muted">Ting du kan gjøre når det passer. Plukk opptil tre til Fokus i dag.</p>
      </header>
      <PickList focus={((focus ?? []) as unknown as Row[]).map(toRow)} items={((items ?? []) as unknown as Row[]).map(toRow)} filter={filter} today={today} />
    </main>
  );
}
