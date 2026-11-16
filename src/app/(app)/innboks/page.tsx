import { createClient } from "@/lib/supabase/server";
import { loadQuickAddContext } from "@/lib/quick-add/load";
import { InboxList, type InboxItem } from "@/components/InboxList";

export const metadata = { title: "Innboks · Ordna" };

export default async function InboxPage() {
  const supabase = await createClient();
  const [{ data }, { projects }] = await Promise.all([
    supabase
      .from("items")
      .select("id, title, kind, created_at")
      .eq("in_inbox", true)
      .not("status", "in", "(done,cancelled)")
      .order("created_at", { ascending: false }),
    loadQuickAddContext(supabase),
  ]);
  const items: InboxItem[] = (data ?? []).map((i) => ({ id: i.id, title: i.title, kind: i.kind, createdAt: i.created_at }));

  return (
    <main className="page space-y-4">
      <header>
        <h1 className="h1">Innboks</h1>
        <p className="mt-1 text-sm text-muted">
          {items.length ? `${items.length} til behandling. Gi hver en plass: prosjekt, plukkliste eller frist.` : "Alt er behandlet."}
        </p>
      </header>
      <InboxList items={items} projects={projects} />
    </main>
  );
}
