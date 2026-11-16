import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadQuickAddContext } from "@/lib/quick-add/load";
import { QuickAddForm } from "@/components/QuickAddForm";

/**
 * /ny: registreringsfeltet alene, for hjemskjermen.
 * /ny?tekst=...: lagrer teksten med en gang (brukes av iOS-snarveien).
 */
export default async function NewPage({ searchParams }: { searchParams: Promise<{ tekst?: string }> }) {
  const { tekst } = await searchParams;
  const supabase = await createClient();
  const { projects } = await loadQuickAddContext(supabase);
  const fromShortcut = typeof tekst === "string" && tekst.trim().length > 0;

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="h1">Ny</h1>
        <Link href="/" className="text-sm text-brand">
          Til forsiden
        </Link>
      </div>
      <div className="card">
        <QuickAddForm projects={projects} source={fromShortcut ? "shortcut" : "page"} initialText={fromShortcut ? tekst : ""} autoSubmit={fromShortcut} />
      </div>
    </main>
  );
}
