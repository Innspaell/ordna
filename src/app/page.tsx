import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/app-info";

const KIND_LABEL: Record<string, string> = { private: "Privat", work: "Jobb", family: "Familie" };

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Trygt å kalle hver gang: lager oppsettet bare første gang
  const { data: profileId } = await supabase.rpc("ensure_my_setup");
  const [{ data: profile }, { data: workspaces }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", profileId).single(),
    supabase.from("workspaces").select("id, name, kind").order("kind"),
  ]);

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wider text-brand">{APP_NAME}</div>
          <h1 className="h1 mt-1">Hei, {profile?.display_name ?? "du"}</h1>
        </div>
        <form action="/auth/logout" method="post">
          <button className="btn-ghost">Logg ut</button>
        </form>
      </header>

      <section className="card space-y-2">
        <h2 className="h2">Arbeidsområdene dine</h2>
        <ul className="space-y-1">
          {(workspaces ?? []).map((w) => (
            <li key={w.id} className="flex justify-between text-sm">
              <span>{w.name}</span>
              <span className="text-muted">{KIND_LABEL[w.kind] ?? w.kind}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-muted">Dagsoversikten kommer her i et senere steg.</p>
    </main>
  );
}
