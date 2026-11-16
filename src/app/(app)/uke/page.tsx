import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { osloToday } from "@/lib/quick-add/parse";
import { osloDayRange } from "@/lib/today";
import { addDays, buildWeek, parseWeekParam, type WeekItem } from "@/lib/week";
import { WeekDays, WeekGrid } from "@/components/WeekView";

export const metadata = { title: "Uke · Ordna" };

const COLS = "id, kind, title, status, due_date, focus_date, starts_at, ends_at, all_day, project_id, projects(name)";
type Row = Omit<WeekItem, "project_name"> & { projects: { name: string } | null };
const MONTHS = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];

function rangeLabel(start: string): string {
  const end = addDays(start, 6);
  const [, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  return sm === em ? `${sd}.–${ed}. ${MONTHS[em - 1]} ${ey}` : `${sd}. ${MONTHS[sm - 1]} – ${ed}. ${MONTHS[em - 1]} ${ey}`;
}

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ uke?: string }> }) {
  const { uke } = await searchParams;
  const today = osloToday();
  const start = parseWeekParam(uke, today);
  const end = addDays(start, 6);
  const from = osloDayRange(start).from;
  const to = osloDayRange(end).to;
  const todayInWeek = today >= start && today <= end;

  const supabase = await createClient();
  const [appts, due, focus, overdue] = await Promise.all([
    supabase.from("items").select(COLS).eq("kind", "appointment").gte("starts_at", from).lt("starts_at", to),
    supabase.from("items").select(COLS).eq("kind", "task").gte("due_date", start).lte("due_date", end).not("status", "in", "(done,cancelled)"),
    supabase.from("items").select(COLS).eq("kind", "task").gte("focus_date", start).lte("focus_date", end).not("status", "in", "(done,cancelled)"),
    todayInWeek
      ? supabase.from("items").select(COLS).eq("kind", "task").lt("due_date", start).not("status", "in", "(done,cancelled)")
      : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const rows = [...(appts.data ?? []), ...(due.data ?? []), ...(focus.data ?? []), ...(overdue.data ?? [])] as unknown as Row[];
  const items: WeekItem[] = [...new Map(rows.map((r) => [r.id, { ...r, project_name: r.projects?.name ?? null }])).values()];
  const view = buildWeek(items, start, today);

  const nav = "flex h-10 items-center justify-center rounded-xl border border-line bg-white px-3 text-sm hover:border-brand/40";

  return (
    <main className="page space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="h1">Uke {view.week}</h1>
          <p className="text-sm text-muted">{rangeLabel(start)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/uke?uke=${addDays(start, -7)}`} className={`${nav} w-10`} aria-label="Forrige uke">‹</Link>
          {!todayInWeek && <Link href="/uke" className={nav}>Denne uka</Link>}
          <Link href={`/uke?uke=${addDays(start, 7)}`} className={`${nav} w-10`} aria-label="Neste uke">›</Link>
        </div>
      </header>
      <div className="flex gap-1 rounded-xl bg-[#e9edf1] p-1 md:hidden">
        <Link href="/" className="flex-1 rounded-lg py-1.5 text-center text-sm text-muted">I dag</Link>
        <span className="flex-1 rounded-lg bg-white py-1.5 text-center text-sm font-semibold text-brand">Uke</span>
      </div>
      <WeekDays view={view} />
      <WeekGrid view={view} />
    </main>
  );
}
