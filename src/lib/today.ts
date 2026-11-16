/**
 * Dagsoversikten: avtaler i dag, forfalt, frist i dag og fokus.
 * En oppgave vises bare ett sted: Fokus vinner over Forfalt og Frist i dag.
 */
import { osloToUtcIso } from "./quick-add/parse";

export type DayItem = {
  id: string;
  kind: "task" | "appointment";
  title: string;
  status: "ready" | "in_progress" | "waiting" | "done" | "cancelled";
  due_date: string | null;
  focus_date: string | null;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  project: string | null;
};

export type DayAppointment = DayItem & { past: boolean };

export type TodayView = {
  appointments: DayAppointment[];
  overdue: DayItem[];
  dueToday: DayItem[];
  focus: DayItem[];
  isEmpty: boolean;
};

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Oslo-døgnet som tidsrom i UTC: [from, to). */
export function osloDayRange(day: string): { from: string; to: string } {
  return { from: osloToUtcIso(day, "00:00"), to: osloToUtcIso(addDays(day, 1), "00:00") };
}

const open = (i: DayItem) => i.status !== "done" && i.status !== "cancelled";

export function buildToday(items: DayItem[], today: string, now: Date = new Date()): TodayView {
  const { from, to } = osloDayRange(today);
  const nowIso = now.toISOString();

  const appointments = items
    .filter((i) => i.kind === "appointment" && i.starts_at && i.starts_at >= from && i.starts_at < to)
    .sort((a, b) => Number(b.all_day) - Number(a.all_day) || (a.starts_at ?? "").localeCompare(b.starts_at ?? ""))
    .map((a) => ({ ...a, past: !a.all_day && (a.ends_at ?? a.starts_at ?? "") <= nowIso }));

  const tasks = items.filter((i) => i.kind === "task" && open(i));
  const focus = tasks.filter((t) => t.focus_date === today);
  const inFocus = new Set(focus.map((f) => f.id));
  const rest = tasks.filter((t) => !inFocus.has(t.id));

  const overdue = rest.filter((t) => t.due_date && t.due_date < today).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const dueToday = rest.filter((t) => t.due_date === today);

  return {
    appointments,
    overdue,
    dueToday,
    focus,
    isEmpty: !appointments.length && !overdue.length && !dueToday.length && !focus.length,
  };
}
