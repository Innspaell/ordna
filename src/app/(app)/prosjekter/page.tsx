import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { countTasks, type TreeItem } from "@/lib/project-tree";
import { nextUp, sortProjects, type NextItem, type NextUp } from "@/lib/projects";
import { formatAppointment, formatDate } from "@/lib/format";
import { osloToday } from "@/lib/quick-add/parse";
import { projectColor, STATUS } from "@/lib/ui";
import { NewProjectForm } from "@/components/NewProjectForm";

export const metadata = { title: "Prosjekter · Ordna" };

type P = { id: string; name: string; due_date: string | null; status: string; workspace_id: string; workspaces: { name: string } | null };
type I = NextItem & { project_id: string };

function nextText(n: NextUp): { text: string; bad?: boolean } | null {
  if (!n) return null;
  if (n.kind === "overdue") return { text: `${n.count} forfalt`, bad: true };
  if (n.kind === "appointment") return { text: `Neste: ${n.title} ${formatAppointment(n.startsAt, null)}` };
  return { text: `Neste: ${n.title}${n.inProgress ? " (under arbeid)" : ""}` };
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ ws?: string }> }) {
  const { ws } = await searchParams;
  const supabase = await createClient();
  const today = osloToday();

  let q = supabase.from("projects").select("id, name, due_date, status, workspace_id, workspaces(name)").neq("status", "cancelled").eq("kind", "project").is("archived_at", null);
  if (ws) q = q.eq("workspace_id", ws);
  const [{ data: projects }, { data: items }, { data: workspaces }] = await Promise.all([
    q,
    supabase.from("items").select("project_id, kind, title, status, due_date, starts_at, sort_order, created_at").in("kind", ["task", "appointment"]).not("project_id", "is", null),
    supabase.from("workspaces").select("id, name, kind").order("kind"),
  ]);

  const all = (items ?? []) as unknown as I[];
  const nowIso = new Date().toISOString();
  const rows = sortProjects((projects ?? []) as unknown as P[]).map((p) => {
    const mine = all.filter((i) => i.project_id === p.id);
    const count = countTasks(mine as unknown as TreeItem[]);
    return {
      ...p,
      color: projectColor(p.id),
      workspaceName: p.workspaces?.name ?? "",
      count,
      pct: count.total ? Math.round((count.done / count.total) * 100) : 0,
      appts: mine.filter((i) => i.kind === "appointment").length,
      next: p.status === "done" ? null : nextText(nextUp(mine, nowIso, today)),
    };
  });
  const groups = [
    { title: "Aktive", color: "#3b6fd8", rows: rows.filter((r) => r.status !== "done") },
    { title: "Fullførte", color: STATUS.done.bg, rows: rows.filter((r) => r.status === "done") },
  ].filter((g) => g.rows.length || g.title === "Aktive");

  const chip = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm ${active ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line bg-white text-muted"}`;

  return (
    <main className="page space-y-4">
      <header className="flex items-end justify-between">
        <h1 className="h1 md:text-3xl">Prosjekter</h1>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/prosjekter" className={chip(!ws)}>Alle</Link>
        {(workspaces ?? []).map((w) => (
          <Link key={w.id} href={`/prosjekter?ws=${w.id}`} className={chip(ws === w.id)}>{w.name}</Link>
        ))}
      </div>

      <NewProjectForm workspaces={(workspaces ?? []).map((w) => ({ id: w.id, name: w.name, kind: w.kind }))} />

      {groups.map((g) => (
        <section key={g.title} className="space-y-2">
          <h2 className="pt-2 text-[17px] font-semibold md:text-xl" style={{ color: g.color }}>
            {g.title} <span className="text-sm font-normal text-muted">{g.rows.length}</span>
          </h2>
          <div className="hidden grid-cols-[minmax(0,1fr)_120px_140px_200px] gap-1 px-1 text-xs text-muted md:grid">
            <span className="pl-5">Prosjekt</span>
            <span className="text-center">Frist</span>
            <span className="text-center">Fullført</span>
            <span className="text-center">Fremdrift</span>
          </div>
          {!g.rows.length && <p className="card text-sm text-muted">Ingen aktive prosjekter. Lag ett over.</p>}
          <ul className="space-y-2 md:space-y-1">
            {g.rows.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/prosjekter/${p.id}`}
                  className="flex overflow-hidden rounded-xl border border-line bg-white hover:border-brand/40 md:grid md:grid-cols-[minmax(0,1fr)_120px_140px_200px] md:gap-1 md:rounded-none md:border-0 md:bg-transparent"
                >
                  <span className="w-[5px] shrink-0 md:hidden" style={{ background: p.color }} />
                  <div className="flex min-w-0 flex-1 flex-col gap-2 px-3.5 py-3 md:flex-row md:items-center md:gap-3 md:border-l-[5px] md:bg-white md:py-2.5" style={{ borderColor: p.color }}>
                    <div className="flex justify-between gap-3 md:block md:min-w-0 md:flex-1">
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold break-words">{p.name}</div>
                        <div className="text-xs text-muted">
                          {[p.workspaceName, p.due_date ? `frist ${formatDate(p.due_date, today)}` : null, !p.count.total && p.appts ? `${p.appts} avtaler` : null]
                            .filter(Boolean)
                            .map((t, i) => (
                              <span key={i} className={i === 1 ? "md:hidden" : ""}>{i ? " · " : ""}{t}</span>
                            ))}
                        </div>
                      </div>
                      <span className="text-sm whitespace-nowrap text-muted md:hidden">{p.count.total ? `${p.count.done} av ${p.count.total}` : "–"}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#e9edf1] md:hidden">
                      <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: p.color }} />
                    </div>
                    {p.next && <div className={`text-xs md:hidden ${p.next.bad ? "font-semibold text-bad" : ""}`}>{p.next.text}</div>}
                    {p.next && <div className={`hidden max-w-[45%] truncate text-xs md:block ${p.next.bad ? "font-semibold text-bad" : "text-muted"}`}>{p.next.text}</div>}
                  </div>
                  <div className="hidden items-center justify-center bg-white text-sm md:flex">{p.due_date ? formatDate(p.due_date, today) : "–"}</div>
                  <div className="hidden items-center justify-center bg-white text-sm tabular-nums text-muted md:flex">{p.count.total ? `${p.count.done} av ${p.count.total}` : "–"}</div>
                  <div className="hidden items-center bg-white px-4 md:flex">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#e9edf1]">
                      <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: p.color }} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
