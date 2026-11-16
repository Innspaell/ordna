import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { osloToday } from "@/lib/quick-add/parse";
import { osloDayRange } from "@/lib/today";
import { addDays, buildPersonRows, buildRange, type WeekItem } from "@/lib/week";
import { loadFamilyView, PERSON_COLS, personOf, visible, type PersonFields } from "@/lib/family-view";
import { PersonFilter, RowsToggle } from "@/components/PersonFilter";
import { calendarHref, calendarRange, calendarTitle, parseCalendarParams, shiftDate, VIEW_LABEL, type CalendarView } from "@/lib/calendar";
import { WeekDays, WeekGrid } from "@/components/WeekView";
import { DayList, MonthGrid } from "@/components/CalendarViews";

export const metadata = { title: "Kalender · Ordna" };

const COLS = `id, kind, title, status, due_date, focus_date, starts_at, ends_at, all_day, project_id, projects(name), ${PERSON_COLS}`;
type Row = Omit<WeekItem, "project_name" | "person_name"> & PersonFields & { projects: { name: string } | null };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ vis?: string; dato?: string }> }) {
  const today = osloToday();
  const { view, date } = parseCalendarParams(await searchParams, today);
  const { start, length } = calendarRange(view, date);
  const end = addDays(start, length - 1);
  const from = osloDayRange(start).from;
  const to = osloDayRange(end).to;
  const todayInRange = today >= start && today <= end;

  const supabase = await createClient();
  const fv = await loadFamilyView(supabase);
  const [appts, due, focus, overdue] = await Promise.all([
    supabase.from("items").select(COLS).eq("kind", "appointment").gte("starts_at", from).lt("starts_at", to),
    supabase.from("items").select(COLS).eq("kind", "task").gte("due_date", start).lte("due_date", end).not("status", "in", "(done,cancelled)"),
    supabase.from("items").select(COLS).eq("kind", "task").gte("focus_date", start).lte("focus_date", end).not("status", "in", "(done,cancelled)"),
    todayInRange
      ? supabase.from("items").select(COLS).eq("kind", "task").lt("due_date", start).not("status", "in", "(done,cancelled)")
      : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const rows = [...(appts.data ?? []), ...(due.data ?? []), ...(focus.data ?? []), ...(overdue.data ?? [])] as unknown as Row[];
  const items: WeekItem[] = [
    ...new Map(
      rows
        .filter((r) => visible(r, fv))
        .map((r) => {
          const { key, tag } = personOf(r, fv);
          return [r.id, { ...r, project_name: r.projects?.name ?? null, person_name: tag?.name ?? null, person_key: key, person_color: tag?.color ?? null }];
        }),
    ).values(),
  ];
  const range = buildRange(items, start, length, today);
  const byPerson = fv.enabled && fv.rows === "person";
  const gridView = byPerson ? { days: range.days, rows: buildPersonRows(range.days, fv.people.filter((p) => fv.selection.includes(p.key))) } : range;
  const { title, sub } = calendarTitle(view, date);

  const btn = "flex h-10 items-center justify-center rounded-xl border border-line bg-white px-3 text-sm hover:border-brand/40";
  const isCurrent = view === "day" ? date === today : todayInRange && (view === "week" || date.slice(0, 7) === today.slice(0, 7));

  return (
    <main className="page space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="h1 md:text-3xl">{title}</h1>
          <p className="text-sm text-muted">{sub}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={calendarHref(view, shiftDate(view, date, -1))} className={`${btn} w-10`} aria-label="Forrige">‹</Link>
          {!isCurrent && <Link href={calendarHref(view, today)} className={btn}>I dag</Link>}
          <Link href={calendarHref(view, shiftDate(view, date, 1))} className={`${btn} w-10`} aria-label="Neste">›</Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
      <nav className="flex flex-1 gap-1 rounded-xl bg-[#e9edf1] p-1 md:flex-none" aria-label="Velg visning">
        {(["day", "week", "month"] as CalendarView[]).map((v) => (
          <Link
            key={v}
            href={calendarHref(v, date)}
            aria-current={v === view ? "page" : undefined}
            className={`flex-1 rounded-lg px-5 py-1.5 text-center text-sm ${v === view ? "bg-white font-semibold text-brand shadow-sm" : "text-muted"}`}
          >
            {VIEW_LABEL[v]}
          </Link>
        ))}
      </nav>
      {fv.enabled && view === "week" && <RowsToggle rows={fv.rows} />}
      </div>
      {fv.enabled && <PersonFilter people={fv.people} selection={fv.selection} />}

      {view === "day" && <DayList day={range.days[0]} />}
      {view === "week" && (
        <>
          <WeekDays view={range} />
          <WeekGrid view={gridView} byPerson={byPerson} />
        </>
      )}
      {view === "month" && <MonthGrid days={range.days} shown={date} />}
    </main>
  );
}
