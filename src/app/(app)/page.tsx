import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/app-info";

const fmt = new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const fmtDate = (d: string) =>
  new Intl.DateTimeFormat("nb-NO", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${d}T00:00:00Z`));
const CONTEXT: Record<string, string> = { home: "hjemme", computer: "PC", phone: "telefon", outside: "ute" };

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Trygt å kalle hver gang: lager oppsettet bare første gang
  const { data: profileId } = await supabase.rpc("ensure_my_setup");
  const [{ data: profile }, { data: recent }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", profileId).single(),
    supabase
      .from("items")
      .select("id, kind, title, in_inbox, due_date, starts_at, ends_at, pick_context, projects(name)")
      .in("kind", ["task", "appointment"])
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wider text-brand">{APP_NAME}</div>
          <h1 className="h1 mt-1">Hei, {profile?.display_name ?? "du"}</h1>
        </div>
        <form action="/auth/logout" method="post">
          <button className="btn-ghost">Logg ut</button>
        </form>
      </header>

      <section className="card space-y-3">
        <h2 className="h2">Sist registrert</h2>
        {!recent?.length ? (
          <p className="text-sm text-muted">Ingenting ennå. Trykk på + for å legge inn noe.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((i) => {
              const project = (i.projects as unknown as { name: string } | null)?.name;
              const meta = [
                i.kind === "appointment" && i.starts_at ? fmt.format(new Date(i.starts_at)) : null,
                i.due_date ? `frist ${fmtDate(i.due_date)}` : null,
                i.pick_context ? `plukk · ${CONTEXT[i.pick_context] ?? i.pick_context}` : null,
                project,
                i.in_inbox ? "innboks" : null,
              ].filter(Boolean);
              return (
                <li key={i.id} className="py-2">
                  <div className="text-sm font-medium">{i.title}</div>
                  <div className="text-xs text-muted">{meta.join(" · ")}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-sm text-muted">Dagsoversikten kommer her i et senere steg.</p>
    </main>
  );
}
