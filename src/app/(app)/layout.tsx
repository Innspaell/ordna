import { createClient } from "@/lib/supabase/server";
import { loadQuickAddContext } from "@/lib/quick-add/load";
import { QuickAddButton } from "@/components/QuickAddButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { projects } = await loadQuickAddContext(supabase);
  return (
    <>
      <div className="pb-24">{children}</div>
      <QuickAddButton projects={projects} />
    </>
  );
}
