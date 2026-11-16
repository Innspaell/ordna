import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildProjectTree, type TreeItem } from "@/lib/project-tree";
import { formatDate } from "@/lib/format";
import { osloToday } from "@/lib/quick-add/parse";
import { ProjectView } from "@/components/ProjectView";

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

  const today = osloToday();
  const tree = buildProjectTree((items ?? []) as TreeItem[], { hideDone });
  const ws = (project.workspaces as unknown as { name: string } | null)?.name;
  const pct = tree.count.total ? Math.round((tree.count.done / tree.count.total) * 100) : 0;

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-8">
      <Link href="/prosjekter" className="text-sm text-brand">
        ← Prosjekter
      </Link>
      <header className="space-y-2">
        <h1 className="h1 break-words">{project.name}</h1>
        <div className="text-sm text-muted">{[ws, project.due_date ? `frist ${formatDate(project.due_date, today)}` : null].filter(Boolean).join(" · ")}</div>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm tabular-nums text-muted">
            {tree.count.done} av {tree.count.total} fullført
          </span>
        </div>
        <Link href={hideDone ? `/prosjekter/${id}` : `/prosjekter/${id}?skjul=1`} className="inline-block text-sm text-brand">
          {hideDone ? "Vis fullførte" : "Skjul fullførte"}
        </Link>
      </header>
      <ProjectView projectId={id} tree={tree} today={today} />
    </main>
  );
}
