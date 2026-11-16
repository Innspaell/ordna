import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildProjectTree, type TreeItem } from "@/lib/project-tree";
import { formatDate } from "@/lib/format";
import { osloToday } from "@/lib/quick-add/parse";
import { projectColor } from "@/lib/ui";
import { ProjectView } from "@/components/ProjectView";
import { ProjectStatusSelect } from "@/components/ProjectStatusSelect";
import type { ProjectStatus } from "@/app/actions/projects";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ skjul?: string }> }) {
  const { id } = await params;
  const { skjul } = await searchParams;
  if (!UUID.test(id)) notFound();
  const hideDone = skjul === "1";

  const supabase = await createClient();
  const [{ data: project }, { data: items }] = await Promise.all([
    supabase.from("projects").select("id, name, due_date, status, workspaces(name)").eq("id", id).maybeSingle(),
    supabase.from("items").select("id, kind, title, parent_id, status, due_date, starts_at, ends_at, sort_order, created_at").eq("project_id", id),
  ]);
  if (!project) notFound();

  // Sjekkliste per oppgave: «2 av 5»
  const taskIds = (items ?? []).filter((i) => i.kind === "task").map((i) => i.id as string);
  const { data: checks } = taskIds.length
    ? await supabase.from("checklist_items").select("item_id, is_done").in("item_id", taskIds)
    : { data: [] as { item_id: string; is_done: boolean }[] };
  const lists = new Map<string, { done: number; total: number }>();
  for (const c of checks ?? []) {
    const cur = lists.get(c.item_id as string) ?? { done: 0, total: 0 };
    cur.total++;
    if (c.is_done) cur.done++;
    lists.set(c.item_id as string, cur);
  }

  const today = osloToday();
  const withLists = ((items ?? []) as TreeItem[]).map((i) => (lists.has(i.id) ? { ...i, checklist: lists.get(i.id) } : i));
  const tree = buildProjectTree(withLists, { hideDone });
  const ws = (project.workspaces as unknown as { name: string } | null)?.name;
  const pct = tree.count.total ? Math.round((tree.count.done / tree.count.total) * 100) : 0;
  const color = projectColor(id);

  return (
    <main className="page space-y-5">
      <Link href="/prosjekter" className="text-sm text-brand">‹ Prosjekter</Link>
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="h1 break-words md:text-3xl">{project.name}</h1>
          <div className="text-sm text-muted">{[ws, project.due_date ? `frist ${formatDate(project.due_date, today)}` : null].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="flex items-center gap-3 md:min-w-72">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#e3e7ec]">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </div>
          <span className="text-sm whitespace-nowrap tabular-nums text-muted">
            {tree.count.done} av {tree.count.total} fullført
          </span>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={hideDone ? `/prosjekter/${id}` : `/prosjekter/${id}?skjul=1`}
          className={`rounded-full border px-3.5 py-1.5 text-sm ${hideDone ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line bg-white text-muted"}`}
        >
          Skjul fullførte
        </Link>
        <div className="ml-auto">
          <ProjectStatusSelect projectId={id} status={project.status as ProjectStatus} />
        </div>
      </div>
      <ProjectView projectId={id} tree={tree} today={today} />
    </main>
  );
}
