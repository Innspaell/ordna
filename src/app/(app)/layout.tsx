import { createClient } from "@/lib/supabase/server";
import { loadQuickAddContext } from "@/lib/quick-add/load";
import { QuickAddButton } from "@/components/QuickAddButton";
import { BottomNav, SideNav } from "@/components/BottomNav";
import { UsageBeacon } from "@/components/UsageBeacon";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [{ projects }, { count }] = await Promise.all([
    loadQuickAddContext(supabase),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("in_inbox", true).not("status", "in", "(done,cancelled)"),
  ]);
  return (
    <div className="md:flex">
      <SideNav inboxCount={count ?? 0} />
      <div className="min-w-0 flex-1 pb-28 md:pb-12">{children}</div>
      <BottomNav inboxCount={count ?? 0} />
      <QuickAddButton projects={projects} />
      <UsageBeacon />
    </div>
  );
}
