import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/app-info";
import { osloToday } from "@/lib/quick-add/parse";
import { buildToday, osloDayRange, type DayItem } from "@/lib/today";
import { TodayView } from "@/components/TodayView";

const longDate = new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", weekday: "long", day: "numeric", month: "long" });
const COLS = "id, kind, title, status, due_date, focus_date, starts_at, ends_at, all_day, projects(name)";

type Row = Omit<DayItem, "project"> & { projects: { name: string } | null };
const toItem = (r: Row): DayItem => ({ ...r, project: r.projects?.name ?? null });

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = osloToday();
  const { from, to } = osloDayRange(today);

  // Trygt å kalle hver gang: lager oppsettet bare første gang
  const { data: profileId } = await supabase.rpc("ensure_my_setup");
  const [profile, appts, dueTasks, focusTasks, inbox, pick] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", profileId).single(),
    supabase.from("items").select(COLS).eq("kind", "appointment").gte("starts_at", from).lt("starts_at", to),
    supabase.from("items").select(COLS).eq("kind", "task").lte("due_date", today).not("status", "in", "(done,cancelled)"),
    supabase.from("items").select(COLS).eq("kind", "task").eq("focus_date", today).not("status", "in", "(done,cancelled)"),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("in_inbox", true).not("status", "in", "(done,cancelled)"),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("kind", "task").eq("is_pickable", true).not("status", "in", "(done,cancelled)"),
  ]);

  const rows = [...(appts.data ?? []), ...(dueTasks.data ?? []), ...(focusTasks.data ?? [])] as unknown as Row[];
  const unique = [...new Map(rows.map((r) => [r.id, toItem(r)])).values()];
  const view = buildToday(unique, today);
  const name = profile.data?.display_name;

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 py-8">
      <header className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wider text-brand">{APP_NAME}</div>
          <h1 className="h1 mt-1 first-letter:uppercase">{longDate.format(new Date())}</h1>
          {name && <p className="text-sm text-muted">Hei, {name}</p>}
        </div>
        <form action="/auth/logout" method="post">
          <button className="text-sm text-muted hover:text-ink">Logg ut</button>
        </form>
      </header>

      <TodayView view={view} today={today} />

      <div className="grid grid-cols-2 gap-3">
        <Link href="/innboks" className="card block hover:border-brand/40">
          <div className="text-2xl font-bold tabular-nums">{inbox.count ?? 0}</div>
          <div className="text-sm text-muted">i innboksen</div>
        </Link>
        <Link href="/plukk" className="card block hover:border-brand/40">
          <div className="text-2xl font-bold tabular-nums">{pick.count ?? 0}</div>
          <div className="text-sm text-muted">på plukklisten</div>
        </Link>
      </div>
    </main>
  );
}
