import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { countTasks, type TreeItem } from "@/lib/project-tree";
import { sortProjects } from "@/lib/projects";
import { formatDate } from "@/lib/format";
import { osloToday } from "@/lib/quick-add/parse";
import { NewProjectForm } from "@/components/NewProjectForm";

export const metadata = { title: "Prosjekter · Ordna" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ vis?: string }> }) {
  const { vis } = await searchParams;
  const showAll = vis === "alle";
  const supabase = await createClient();

  let q = supabase.from("projects").select("id, name, due_date, status, workspace_id, workspaces(name)");
  if (!showAll) q = q.eq("status", "active").is("archived_at", null);
  const [{ data: projects }, { data: tasks }, { data: workspaces }] = await Promise.all([
    q,
    supabase.from("items").select("project_id, kind, status").eq("kind", "task").not("project_id", "is", null),
    supabase.from("workspaces").select("id, name, kind").order("kind"),
  ]);

  const today = osloToday();
  const rows = sortProjects(projects ?? []).map((p) => ({
    ...p,
    workspaceName: (p.workspaces as unknown as { name: string } | null)?.name ?? "",
    count: countTasks(((tasks ?? []) as unknown as TreeItem[]).filter((t) => (t as unknown as { project_id: string }).project_id === p.id)),
  }));
  const statusLabel: Record<string, string> = { paused: "På vent", done: "Fullført", cancelled: "Avbrutt" };

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-8">
      <header className="flex items-end justify-between">
        <h1 className="h1">Prosjekter</h1>
        <Link href={showAll ? "/prosjekter" : "/prosjekter?vis=alle"} className="text-sm text-brand">
          {showAll ? "Bare aktive" : "Vis alle"}
        </Link>
      </header>

      <NewProjectForm workspaces={(workspaces ?? []).map((w) => ({ id: w.id, name: w.name, kind: w.kind }))} />

      {!rows.length ? (
        <p className="card text-sm text-muted">Ingen prosjekter ennå.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`/prosjekter/${p.id}`} className="card block hover:border-brand/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium break-words">{p.name}</div>
                    <div className="text-xs text-muted">
                      {[p.workspaceName, p.due_date ? `frist ${formatDate(p.due_date, today)}` : null, statusLabel[p.status]].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-sm tabular-nums text-muted">
                    {p.count.total ? `${p.count.done} av ${p.count.total}` : "–"}
                  </div>
                </div>
                {p.count.total > 0 && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(p.count.done / p.count.total) * 100}%` }} />
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
