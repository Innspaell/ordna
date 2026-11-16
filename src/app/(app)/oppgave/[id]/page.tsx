import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadQuickAddContext } from "@/lib/quick-add/load";
import { TaskEditor, type ChecklistRow, type TaskData } from "@/components/TaskEditor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: "Oppgave · Ordna" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: item }, { data: checklist }, { projects }] = await Promise.all([
    supabase
      .from("items")
      .select("id, title, status, due_date, notes, is_pickable, pick_context, project_id, parent_id, in_inbox, projects(name)")
      .eq("id", id)
      .eq("kind", "task")
      .maybeSingle(),
    supabase.from("checklist_items").select("id, text, is_done").eq("item_id", id).order("sort_order").order("created_at"),
    loadQuickAddContext(supabase),
  ]);
  if (!item) notFound();

  const task: TaskData = {
    id: item.id,
    title: item.title,
    status: item.status,
    due_date: item.due_date,
    notes: item.notes,
    is_pickable: item.is_pickable,
    pick_context: item.pick_context,
    placeId: (item.parent_id as string | null) ?? (item.project_id as string | null) ?? "",
  };
  const projectName = (item.projects as unknown as { name: string } | null)?.name;
  const back = item.project_id ? { href: `/prosjekter/${item.project_id}`, label: projectName ?? "Prosjekt" } : item.in_inbox ? { href: "/innboks", label: "Innboks" } : { href: "/", label: "I dag" };

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-8">
      <Link href={back.href} className="text-sm text-brand">
        ← {back.label}
      </Link>
      <TaskEditor task={task} checklist={(checklist ?? []) as ChecklistRow[]} projects={projects} backHref={back.href} />
    </main>
  );
}
