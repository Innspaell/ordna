/**
 * Bygger visningen av ett prosjekt: delprosjekter som grupper, «Øvrig» og telling.
 * Telling i fase 1: bare oppgaver, ikke avtaler, sjekkliste eller avbrutte.
 */

export type TreeItem = {
  id: string;
  kind: "subproject" | "task" | "appointment";
  title: string;
  parent_id: string | null;
  status: "ready" | "in_progress" | "waiting" | "done" | "cancelled";
  due_date: string | null;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  created_at: string;
  /** Sjekkliste på oppgaven, hvis den har en */
  checklist?: { done: number; total: number };
};

export type Count = { done: number; total: number };

export type Group = {
  id: string;
  title: string;
  depth: number;
  /** Oppgaver og avtaler rett i gruppen */
  items: TreeItem[];
  children: Group[];
  count: Count;
  /** Ingen oppgaver eller avtaler, heller ikke i undergrupper */
  empty: boolean;
};

export type ProjectTree = {
  hasSubprojects: boolean;
  /** Oppgaver og avtaler rett i prosjektet når det ikke finnes delprosjekter */
  rootItems: TreeItem[];
  groups: Group[];
  /** «Øvrig»: oppgaver og avtaler rett i prosjektet når det finnes delprosjekter */
  other: Group | null;
  count: Count;
};

export function countTasks(items: TreeItem[]): Count {
  let done = 0;
  let total = 0;
  for (const i of items) {
    if (i.kind !== "task" || i.status === "cancelled") continue;
    total++;
    if (i.status === "done") done++;
  }
  return { done, total };
}

function sortLeaves(items: TreeItem[]): TreeItem[] {
  const appts = items.filter((i) => i.kind === "appointment").sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""));
  const tasks = items
    .filter((i) => i.kind === "task")
    .sort((a, b) => {
      const da = a.status === "done" || a.status === "cancelled" ? 1 : 0;
      const db = b.status === "done" || b.status === "cancelled" ? 1 : 0;
      return da - db || a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
    });
  return [...appts, ...tasks];
}

export function buildProjectTree(all: TreeItem[], opts: { hideDone?: boolean } = {}): ProjectTree {
  const subs = all.filter((i) => i.kind === "subproject");
  const subIds = new Set(subs.map((s) => s.id));
  const leaves = all.filter((i) => i.kind !== "subproject");
  // Foreldreløse (ukjent forelder) behandles som rett i prosjektet
  const parentOf = (i: TreeItem) => (i.parent_id && subIds.has(i.parent_id) ? i.parent_id : null);

  const visible = (i: TreeItem) => !(opts.hideDone && (i.status === "done" || i.status === "cancelled"));

  function build(sub: TreeItem, depth: number): { group: Group; allLeaves: TreeItem[] } {
    const own = leaves.filter((l) => parentOf(l) === sub.id);
    const kids = subs
      .filter((s) => parentOf(s) === sub.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
      .map((s) => build(s, depth + 1));
    const allLeaves = [...own, ...kids.flatMap((k) => k.allLeaves)];
    return {
      group: {
        id: sub.id,
        title: sub.title,
        depth,
        items: sortLeaves(own.filter(visible)),
        children: kids.map((k) => k.group),
        count: countTasks(allLeaves),
        empty: allLeaves.length === 0,
      },
      allLeaves,
    };
  }

  const tops = subs
    .filter((s) => parentOf(s) === null)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    .map((s) => build(s, 0));
  const direct = leaves.filter((l) => parentOf(l) === null);
  const hasSubprojects = subs.length > 0;

  return {
    hasSubprojects,
    rootItems: hasSubprojects ? [] : sortLeaves(direct.filter(visible)),
    groups: tops.map((t) => t.group),
    other:
      hasSubprojects && direct.length
        ? { id: "other", title: "Øvrig", depth: 0, items: sortLeaves(direct.filter(visible)), children: [], count: countTasks(direct), empty: false }
        : null,
    count: countTasks(leaves),
  };
}
