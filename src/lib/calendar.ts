/**
 * Kalenderen: samme oppsett for dag, uke og måned.
 * Parametre i adressen: ?vis=dag|uke|maned&dato=YYYY-MM-DD
 */
import { isValidDate } from "./inbox";
import { addDays, isoWeek, weekStart } from "./week";

export type CalendarView = "day" | "week" | "month";

const VIEW_PARAM: Record<string, CalendarView> = { dag: "day", uke: "week", maned: "month", måned: "month" };
export const VIEW_SLUG: Record<CalendarView, string> = { day: "dag", week: "uke", month: "maned" };
export const VIEW_LABEL: Record<CalendarView, string> = { day: "Dag", week: "Uke", month: "Måned" };

const MONTHS = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
const WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function parseCalendarParams(p: { vis?: string; dato?: string }, today: string): { view: CalendarView; date: string } {
  return {
    view: VIEW_PARAM[(p.vis ?? "").toLowerCase()] ?? "week",
    date: p.dato && isValidDate(p.dato) ? p.dato : today,
  };
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}
function monthEnd(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** Hvilke dager som vises: én dag, en uke, eller hele uker som dekker måneden. */
export function calendarRange(view: CalendarView, date: string): { start: string; length: number } {
  if (view === "day") return { start: date, length: 1 };
  if (view === "week") return { start: weekStart(date), length: 7 };
  const start = weekStart(monthStart(date));
  const lastMonday = weekStart(monthEnd(date));
  const weeks = Math.round((Date.parse(`${lastMonday}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / (7 * 864e5)) + 1;
  return { start, length: weeks * 7 };
}

/** Forrige/neste: dag ±1, uke ±7, måned til 1. i forrige/neste måned. */
export function shiftDate(view: CalendarView, date: string, dir: -1 | 1): string {
  if (view === "day") return addDays(date, dir);
  if (view === "week") return addDays(date, 7 * dir);
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10);
}

export function calendarTitle(view: CalendarView, date: string): { title: string; sub: string } {
  const [y, m, d] = date.split("-").map(Number);
  if (view === "day") {
    const wd = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
    return { title: `${cap(wd)} ${d}. ${MONTHS[m - 1]}`, sub: String(y) };
  }
  if (view === "month") return { title: cap(MONTHS[m - 1]), sub: String(y) };
  const start = weekStart(date);
  const end = addDays(start, 6);
  const [, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const sub = sm === em ? `${sd}.–${ed}. ${MONTHS[em - 1]} ${ey}` : `${sd}. ${MONTHS[sm - 1]} – ${ed}. ${MONTHS[em - 1]} ${ey}`;
  return { title: `Uke ${isoWeek(start)}`, sub };
}

export function calendarHref(view: CalendarView, date: string): string {
  return `/kalender?vis=${VIEW_SLUG[view]}&dato=${date}`;
}

/** Om en dato hører til måneden som vises (for å tone ned dager utenfor). */
export function inMonth(date: string, shown: string): boolean {
  return date.slice(0, 7) === shown.slice(0, 7);
}
