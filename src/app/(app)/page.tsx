import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/app-info";
import { osloToday } from "@/lib/quick-add/parse";
import { buildToday, osloDayRange, type DayItem } from "@/lib/today";
import { addDays, weekStart } from "@/lib/week";
import { osloParts } from "@/lib/item-edit";
import { TodayView } from "@/components/TodayView";
import { WeekStrip, type StripDay } from "@/components/WeekStrip";

const longDate = new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", weekday: "long", day: "numeric", month: "long" });
const COLS = "id, kind, title, status, due_date, focus_date, starts_at, ends_at, all_day, project_id, projects(name), assignee:profiles!items_assignee_profile_id_fkey(display_name)";
const WD = ["M", "T", "O", "T", "F", "L", "S"];

type Row = Omit<DayItem, "project" | "projectId" | "person"> & { project_id: string | null; projects: { name: string } | null; assignee: { display_name: string } | null };
const toItem = (r: Row): DayItem => ({ ...r, project: r.projects?.name ?? null, projectId: r.project_id, person: r.assignee?.display_name ?? null });

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = osloToday();
  const { from, to } = osloDayRange(today);
  const wStart = weekStart(today);
  const wEnd = addDays(wStart, 6);

  // Trygt å kalle hver gang: lager oppsettet bare første gang
  const { data: profileId } = await supabase.rpc("ensure_my_setup");
  const [profile, appts, dueTasks, focusTasks, inbox, pick, weekAppts, weekDue] = await Promise.all([
    supabase.from("profiles").select("display_name, managed_by_profile_id").eq("id", profileId).single(),
    supabase.from("items").select(COLS).eq("kind", "appointment").gte("starts_at", from).lt("starts_at", to),
    supabase.from("items").select(COLS).eq("kind", "task").lte("due_date", today).not("status", "in", "(done,cancelled)"),
    supabase.from("items").select(COLS).eq("kind", "task").eq("focus_date", today).not("status", "in", "(done,cancelled)"),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("in_inbox", true).not("status", "in", "(done,cancelled)"),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("kind", "task").eq("is_pickable", true).not("status", "in", "(done,cancelled)"),
    supabase.from("items").select("starts_at").eq("kind", "appointment").gte("starts_at", osloDayRange(wStart).from).lt("starts_at", osloDayRange(wEnd).to),
    supabase.from("items").select("due_date").eq("kind", "task").gte("due_date", wStart).lte("due_date", wEnd).not("status", "in", "(done,cancelled)"),
  ]);

  const rows = [...(appts.data ?? []), ...(dueTasks.data ?? []), ...(focusTasks.data ?? [])] as unknown as Row[];
  const unique = [...new Map(rows.map((r) => [r.id, toItem(r)])).values()];
  const view = buildToday(unique, today);
  const name = profile.data?.display_name;
  const child = !!profile.data?.managed_by_profile_id;

  const busy = new Set<string>([
    ...(weekAppts.data ?? []).map((a) => osloParts(a.starts_at as string).date),
    ...(weekDue.data ?? []).map((t) => t.due_date as string),
  ]);
  const strip: StripDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(wStart, i);
    return { date, wd: WD[i], num: Number(date.slice(8)), isToday: date === today, busy: busy.has(date) };
  });

  return (
    <main className="page space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold tracking-[0.08em] text-brand md:hidden">{APP_NAME.toUpperCase()}</div>
          <h1 className="h1 mt-1 first-letter:uppercase md:text-3xl">{longDate.format(new Date())}</h1>
          {name && <p className="text-sm text-muted">Hei, {name}</p>}
        </div>
        <form action="/auth/logout" method="post" className="md:hidden">
          <button className="text-sm text-muted hover:text-ink">Logg ut</button>
        </form>
      </header>

      <div className="space-y-4 md:grid md:grid-cols-[minmax(0,1fr)_280px] md:gap-6 md:space-y-0">
        <div className="space-y-4">
          <WeekStrip days={strip} />
          <TodayView view={view} today={today} />
        </div>
        <aside className="space-y-4">
          {child ? (
            <Link href="/handleliste" className="card block py-3 font-semibold hover:border-brand/40">Handleliste ›</Link>
          ) : (
          <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
            <Link href="/innboks" className="card block hover:border-brand/40">
              <div className="text-2xl font-bold tabular-nums">{inbox.count ?? 0}</div>
              <div className="text-sm text-muted">i innboksen</div>
            </Link>
            <Link href="/plukk" className="card block hover:border-brand/40">
              <div className="text-2xl font-bold tabular-nums">{pick.count ?? 0}</div>
              <div className="text-sm text-muted">på plukklisten</div>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:hidden">
            <Link href="/handleliste" className="card block py-3 text-sm font-semibold hover:border-brand/40">Handleliste ›</Link>
            <Link href="/familie" className="card block py-3 text-sm font-semibold hover:border-brand/40">Familie ›</Link>
          </div>
          <div className="flex justify-center gap-4 text-sm text-muted md:hidden">
            <Link href="/snarvei" className="hover:text-brand">Ordna på iPhone</Link>
            <Link href="/bruk" className="hover:text-brand">Bruk</Link>
          </div>
          </>
          )}
        </aside>
      </div>
    </main>
  );
}
