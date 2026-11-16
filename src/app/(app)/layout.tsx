import { createClient } from "@/lib/supabase/server";
import { loadQuickAddContext } from "@/lib/quick-add/load";
import { QuickAddButton } from "@/components/QuickAddButton";
import { BottomNav } from "@/components/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [{ projects }, { count }] = await Promise.all([
    loadQuickAddContext(supabase),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("in_inbox", true).not("status", "in", "(done,cancelled)"),
  ]);
  return (
    <>
      <div className="pb-28">{children}</div>
      <BottomNav inboxCount={count ?? 0} />
      <QuickAddButton projects={projects} />
    </>
  );
}
