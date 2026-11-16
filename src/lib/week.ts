/**
 * Ukevisningen: avtaler, frister, fokus og forfalt fordelt på sju dager, og på prosjekter (rader på PC).
 */
import { osloParts } from "./item-edit";
import { isValidDate } from "./inbox";
import { NO_PROJECT_COLOR, projectColor } from "./ui";

export type WeekItem = {
  id: string;
  kind: "task" | "appointment";
  title: string;
  status: string;
  due_date: string | null;
  focus_date: string | null;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  project_id: string | null;
  project_name: string | null;
};

export type Tone = "appt" | "due" | "focus" | "overdue";

export type WeekEntry = {
  id: string;
  kind: "task" | "appointment";
  title: string;
  /** Linje over tittelen: klokkeslett, «Frist», «Fokus», «Forfalt 14.11» */
  top: string;
  tone: Tone;
  projectId: string | null;
  projectName: string | null;
  sortKey: string;
};

export type WeekDay = { date: string; wd: string; num: number; isToday: boolean; entries: WeekEntry[] };
export type WeekRow = { id: string | null; name: string; color: string; cells: WeekEntry[][] };
export type WeekView = { start: string; week: number; days: WeekDay[]; rows: WeekRow[] };

const WD = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Mandagen i uka datoen hører til. */
export function weekStart(iso: string): string {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = søndag
  return addDays(iso, -((day + 6) % 7));
}

export function isoWeek(iso: string): number {
  // Torsdagen i samme uke avgjør året; uke 1 er uka med årets første torsdag
  const thursday = addDays(iso, 3 - ((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));
  const jan1 = `${thursday.slice(0, 4)}-01-01`;
  const days = (Date.parse(`${thursday}T00:00:00Z`) - Date.parse(`${jan1}T00:00:00Z`)) / 864e5;
  return 1 + Math.floor(days / 7);
}

export function parseWeekParam(v: string | undefined, today: string): string {
  return weekStart(v && isValidDate(v) ? v : today);
}

const open = (i: WeekItem) => i.status !== "done" && i.status !== "cancelled";

export function buildWeek(items: WeekItem[], start: string, today: string): WeekView {
  return { start, week: isoWeek(start), ...buildRange(items, start, 7, today) };
}

/** Fordeler elementene på `length` dager fra `start`, og på prosjekter. Brukes av dag, uke og måned. */
export function buildRange(items: WeekItem[], start: string, length: number, today: string): { days: WeekDay[]; rows: WeekRow[] } {
  const dates = Array.from({ length }, (_, i) => addDays(start, i));
  const end = dates[dates.length - 1];
  const todayInWeek = today >= start && today <= end;
  const placed: { date: string; entry: WeekEntry }[] = [];

  const base = (i: WeekItem) => ({ id: i.id, kind: i.kind, title: i.title, projectId: i.project_id, projectName: i.project_name });

  for (const i of items) {
    if (i.kind === "appointment" && i.starts_at) {
      const s = osloParts(i.starts_at);
      if (s.date < start || s.date > end) continue;
      const top = i.all_day ? "Hele dagen" : i.ends_at ? `${s.time}–${osloParts(i.ends_at).time}` : s.time;
      placed.push({ date: s.date, entry: { ...base(i), top, tone: "appt", sortKey: `0${i.all_day ? "00:00" : s.time}` } });
      continue;
    }
    if (i.kind !== "task" || !open(i)) continue;

    if (i.focus_date && i.focus_date >= start && i.focus_date <= end) {
      placed.push({ date: i.focus_date, entry: { ...base(i), top: "Fokus", tone: "focus", sortKey: "1" } });
      if (i.due_date === i.focus_date) continue;
    }
    if (!i.due_date) continue;
    if (i.due_date >= start && i.due_date <= end) {
      const overdue = i.due_date < today;
      placed.push({ date: i.due_date, entry: { ...base(i), top: overdue ? "Forfalt" : "Frist", tone: overdue ? "overdue" : "due", sortKey: "2" } });
    } else if (i.due_date < start && todayInWeek && i.focus_date !== today) {
      const [, m, d] = i.due_date.split("-");
      placed.push({ date: today, entry: { ...base(i), top: `Forfalt ${Number(d)}.${Number(m)}`, tone: "overdue", sortKey: "2" } });
    }
  }

  const sortEntries = (a: WeekEntry, b: WeekEntry) => a.sortKey.localeCompare(b.sortKey) || a.title.localeCompare(b.title, "nb");

  const days: WeekDay[] = dates.map((date) => ({
    date,
    wd: WD[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7],
    num: Number(date.slice(8)),
    isToday: date === today,
    entries: placed.filter((p) => p.date === date).map((p) => p.entry).sort(sortEntries),
  }));

  const byProject = new Map<string, WeekRow>();
  for (const { date, entry } of placed) {
    const key = entry.projectId ?? "";
    if (!byProject.has(key)) {
      byProject.set(key, {
        id: entry.projectId,
        name: entry.projectName ?? "Uten prosjekt",
        color: entry.projectId ? projectColor(entry.projectId) : NO_PROJECT_COLOR,
        cells: dates.map(() => []),
      });
    }
    byProject.get(key)!.cells[dates.indexOf(date)].push(entry);
  }
  const rows = [...byProject.values()]
    .map((r) => ({ ...r, cells: r.cells.map((c) => c.sort(sortEntries)) }))
    .sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : a.name.localeCompare(b.name, "nb")));

  return { days, rows };
}
