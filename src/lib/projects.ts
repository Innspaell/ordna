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
