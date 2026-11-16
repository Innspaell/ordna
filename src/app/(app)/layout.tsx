import { createClient } from "@/lib/supabase/server";
import { loadQuickAddContext } from "@/lib/quick-add/load";
import { QuickAddButton } from "@/components/QuickAddButton";
import { BottomNav, SideNav } from "@/components/BottomNav";
import { UsageBeacon } from "@/components/UsageBeacon";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("current_profile_id");
  const [{ projects, people, workspaces }, { count }, { data: profile }] = await Promise.all([
    loadQuickAddContext(supabase),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("in_inbox", true).not("status", "in", "(done,cancelled)"),
    me ? supabase.from("profiles").select("managed_by_profile_id").eq("id", me).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const child = !!profile?.managed_by_profile_id;
  return (
    <div className="md:flex">
      <SideNav inboxCount={count ?? 0} child={child} />
      <div className="min-w-0 flex-1 pb-28 md:pb-12">{children}</div>
      <BottomNav inboxCount={count ?? 0} child={child} />
      <QuickAddButton projects={projects} people={people} workspaces={workspaces} />
      <UsageBeacon />
    </div>
  );
}
