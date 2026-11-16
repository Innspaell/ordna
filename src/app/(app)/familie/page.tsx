import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateFamily, FamilyAdmin, MyColor, type Member } from "@/components/FamilyAdmin";
import { personColor } from "@/lib/people";

export const metadata = { title: "Familie · Ordna" };

export default async function FamilyPage() {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("current_profile_id");
  const { data: fam } = await supabase.from("workspaces").select("id, name").eq("kind", "family").order("created_at").limit(1).maybeSingle();

  if (!fam) {
    return (
      <main className="page space-y-4">
        <h1 className="h1 md:text-3xl">Familie</h1>
        <CreateFamily />
      </main>
    );
  }

  const { data: rows } = await supabase
    .from("memberships")
    .select("role, profile_id, profiles!inner(id, display_name, color, managed_by_profile_id)")
    .eq("workspace_id", fam.id);
  type R = { role: string; profile_id: string; profiles: { id: string; display_name: string; color: string | null; managed_by_profile_id: string | null } };
  const members: Member[] = ((rows ?? []) as unknown as R[])
    .map((r) => ({ id: r.profiles.id, name: r.profiles.display_name, child: !!r.profiles.managed_by_profile_id, role: r.role, me: r.profiles.id === me, color: personColor(r.profiles) }))
    .sort((a, b) => Number(a.child) - Number(b.child) || a.name.localeCompare(b.name, "nb"));
  const myRole = members.find((m) => m.me)?.role;
  const canAdmin = myRole === "owner" || myRole === "admin";
  const { data: list } = await supabase.from("projects").select("id").eq("workspace_id", fam.id).eq("kind", "list").limit(1).maybeSingle();

  return (
    <main className="page space-y-4">
      <header className="flex items-end justify-between">
        <h1 className="h1 md:text-3xl">{fam.name}</h1>
        {list && <Link href="/handleliste" className="text-sm font-semibold text-brand">Handleliste ›</Link>}
      </header>
      <p className="text-sm text-muted">
        Skriv <span className="font-medium text-ink">#familie</span> for å legge noe i Familie, og <span className="font-medium text-ink">@navn</span> for hvem det gjelder. For eksempel «Fotball tirsdag kl 17 @{members.find((m) => m.child)?.name ?? "navn"} #familie».
      </p>
      {members.find((m) => m.me) && <MyColor color={members.find((m) => m.me)!.color} />}
      <FamilyAdmin members={members} canAdmin={canAdmin} />
    </main>
  );
}
