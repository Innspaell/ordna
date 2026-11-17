import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ShoppingList, type ListRow } from "@/components/ShoppingList";
import { eventLabel, groupEvents, recentlyBought, whenLabel, type ListEvent } from "@/lib/shopping";
import { osloToday } from "@/lib/quick-add/parse";

export const metadata = { title: "Handleliste · Ordna" };

export default async function ShoppingPage({ searchParams }: { searchParams: Promise<{ vis?: string }> }) {
  const { vis } = await searchParams;
  const supabase = await createClient();
  const { data: list } = await supabase.from("projects").select("id, name, workspace_id").eq("kind", "list").order("created_at").limit(1).maybeSingle();

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

  // Voksne (eier/admin) ser loggen
  const { data: me } = await supabase.rpc("current_profile_id");
  const { data: membership } = await supabase.from("memberships").select("role").eq("workspace_id", list.workspace_id).eq("profile_id", me).maybeSingle();
  const adult = membership?.role === "owner" || membership?.role === "admin";
  const showLog = adult && vis === "logg";

  const tabs = adult && (
    <nav className="flex gap-1 rounded-xl bg-[#e9edf1] p-1" aria-label="Visning">
      {[
        { href: "/handleliste", label: "Liste", on: !showLog },
        { href: "/handleliste?vis=logg", label: "Logg", on: showLog },
      ].map((t) => (
        <Link key={t.label} href={t.href} aria-current={t.on ? "page" : undefined} className={`flex-1 rounded-lg py-1.5 text-center text-sm ${t.on ? "bg-white font-semibold text-brand shadow-sm" : "text-muted"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );

  if (showLog) {
    const { data: ev } = await supabase
      .from("list_events")
      .select("id, action, title, profile_id, created_at, who:profiles(display_name)")
      .eq("project_id", list.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(300);
    type E = Omit<ListEvent, "who"> & { who: { display_name: string } | null };
    const groups = groupEvents(((ev ?? []) as unknown as E[]).map((e) => ({ ...e, who: e.who?.display_name ?? null })));
    const today = osloToday();
    return (
      <main className="page max-w-xl space-y-4 md:max-w-2xl">
        <h1 className="h1 md:text-3xl">{list.name}</h1>
        {tabs}
        <section className="card py-1">
          {!groups.length ? (
            <p className="py-4 text-center text-sm text-muted">Ingenting er gjort på listen ennå.</p>
          ) : (
            <ul className="divide-y divide-[#f0f2f5]">
              {groups.map((g) => (
                <li key={g.key} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span className={`text-[15px] ${g.action === "deleted" || g.action === "cleared" ? "text-muted" : ""}`}>{eventLabel(g)}</span>
                  <span className="shrink-0 text-xs text-muted">{whenLabel(g.at, today)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="text-xs text-muted">Bare voksne ser loggen. Den viser de siste 300 hendelsene.</p>
      </main>
    );
  }

  const [{ data }, { data: cleared }] = await Promise.all([
    supabase
      .from("items")
      .select("id, title, status, created_at, creator:profiles!items_created_by_profile_id_fkey(display_name)")
      .eq("project_id", list.id)
      .eq("kind", "task")
      .neq("status", "cancelled")
      .is("cleared_at", null)
      .order("created_at"),
    supabase
      .from("items")
      .select("id, title, cleared_at")
      .eq("project_id", list.id)
      .eq("kind", "task")
      .not("cleared_at", "is", null)
      .order("cleared_at", { ascending: false })
      .limit(200),
  ]);
  type R = { id: string; title: string; status: string; creator: { display_name: string } | null };
  const rows: ListRow[] = ((data ?? []) as unknown as R[]).map((r) => ({ id: r.id, title: r.title, done: r.status === "done", by: r.creator?.display_name ?? null }));
  const recent = recentlyBought((cleared ?? []) as { id: string; title: string; cleared_at: string }[], rows.map((r) => r.title)).map(({ id, title }) => ({ id, title }));

  return (
    <main className="page max-w-xl space-y-4 md:max-w-2xl">
      <h1 className="h1 md:text-3xl">{list.name}</h1>
      {tabs}
      <ShoppingList projectId={list.id} rows={rows} recent={recent} />
    </main>
  );
}
