import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadQuickAddContext } from "@/lib/quick-add/load";
import { osloParts } from "@/lib/item-edit";
import { AppointmentEditor, type AppointmentData } from "@/components/AppointmentEditor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: "Avtale · Ordna" };

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: item }, { projects }] = await Promise.all([
    supabase
      .from("items")
      .select("id, title, starts_at, ends_at, all_day, location, notes, project_id, parent_id, projects(name)")
      .eq("id", id)
      .eq("kind", "appointment")
      .maybeSingle(),
    loadQuickAddContext(supabase),
  ]);
  if (!item || !item.starts_at) notFound();

  const s = osloParts(item.starts_at);
  const appt: AppointmentData = {
    id: item.id,
    title: item.title,
    date: s.date,
    start: item.all_day ? "" : s.time,
    end: item.ends_at && !item.all_day ? osloParts(item.ends_at).time : "",
    all_day: item.all_day,
    location: item.location ?? "",
    notes: item.notes ?? "",
    placeId: (item.parent_id as string | null) ?? (item.project_id as string | null) ?? "",
  };
  const projectName = (item.projects as unknown as { name: string } | null)?.name;
  const back = item.project_id ? { href: `/prosjekter/${item.project_id}`, label: projectName ?? "Prosjekt" } : { href: "/", label: "I dag" };

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-8">
      <Link href={back.href} className="text-sm text-brand">
        ← {back.label}
      </Link>
      <AppointmentEditor appt={appt} projects={projects} backHref={back.href} />
    </main>
  );
}
