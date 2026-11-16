export type ProjectListRow = { id: string; name: string; due_date: string | null };

/** Sortert på frist, prosjekter uten frist nederst, deretter navn. */
export function sortProjects<T extends ProjectListRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return a.name.localeCompare(b.name, "nb");
  });
}

export type NextItem = {
  kind: "task" | "appointment";
  title: string;
  status: string;
  due_date: string | null;
  starts_at: string | null;
  sort_order: number;
  created_at: string;
};

export type NextUp =
  | { kind: "overdue"; count: number }
  | { kind: "task"; title: string; inProgress: boolean }
  | { kind: "appointment"; title: string; startsAt: string }
  | null;

/** Hva som er neste i et prosjekt: forfalte først, så noe under arbeid, så neste avtale, så neste oppgave. */
export function nextUp(items: NextItem[], nowIso: string, today: string): NextUp {
  const open = items.filter((i) => i.kind === "task" && i.status !== "done" && i.status !== "cancelled");
  const overdue = open.filter((t) => t.due_date && t.due_date < today).length;
  if (overdue) return { kind: "overdue", count: overdue };

  const working = open.filter((t) => t.status === "in_progress").sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
  if (working.length) return { kind: "task", title: working[0].title, inProgress: true };

  const appt = items
    .filter((i) => i.kind === "appointment" && i.starts_at && i.starts_at >= nowIso)
    .sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""))[0];
  if (appt) return { kind: "appointment", title: appt.title, startsAt: appt.starts_at! };

  const next = [...open].sort(
    (a, b) =>
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
  )[0];
  return next ? { kind: "task", title: next.title, inProgress: false } : null;
}
