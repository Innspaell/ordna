import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ShoppingList, type ListRow } from "@/components/ShoppingList";

export const metadata = { title: "Handleliste · Ordna" };

export default async function ShoppingPage() {
  const supabase = await createClient();
  const { data: list } = await supabase.from("projects").select("id, name").eq("kind", "list").order("created_at").limit(1).maybeSingle();

  if (!list) {
    return (
      <main className="page space-y-4">
        <h1 className="h1 md:text-3xl">Handleliste</h1>
        <div className="card space-y-2 text-center">
          <p className="font-medium">Ingen handleliste ennå</p>
          <p className="text-sm text-muted">Handlelisten kommer når du oppretter Familie.</p>
          <Link href="/familie" className="btn-primary">Gå til Familie</Link>
        </div>
      </main>
    );
  }

  const { data } = await supabase
    .from("items")
    .select("id, title, status, created_at, creator:profiles!items_created_by_profile_id_fkey(display_name)")
    .eq("project_id", list.id)
    .eq("kind", "task")
    .neq("status", "cancelled")
    .order("created_at");
  type R = { id: string; title: string; status: string; creator: { display_name: string } | null };
  const rows: ListRow[] = ((data ?? []) as unknown as R[]).map((r) => ({ id: r.id, title: r.title, done: r.status === "done", by: r.creator?.display_name ?? null }));

  return (
    <main className="page max-w-xl space-y-4 md:max-w-2xl">
      <h1 className="h1 md:text-3xl">{list.name}</h1>
      <ShoppingList projectId={list.id} rows={rows} />
    </main>
  );
}
