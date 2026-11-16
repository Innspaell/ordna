"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, MISSING_KEY_MESSAGE } from "@/lib/supabase/admin";
import { generateCode, hashCode, normalizeCode } from "@/lib/child-code";
import { PERSON_COLORS } from "@/lib/people";

export type FamilyResult<T = undefined> = { ok: true; data?: T } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_HOURS = 24;

function refresh() {
  revalidatePath("/", "layout");
}

/** Familieområdet der innlogget bruker er eier eller admin, og brukerens profil. */
async function familyAsAdmin() {
  const supabase = await createClient();
  const { data: pid } = await supabase.rpc("current_profile_id");
  if (!pid) return null;
  const { data } = await supabase
    .from("memberships")
    .select("workspace_id, role, workspaces!inner(kind)")
    .eq("profile_id", pid)
    .eq("workspaces.kind", "family")
    .in("role", ["owner", "admin"])
    .limit(1);
  const ws = data?.[0]?.workspace_id as string | undefined;
  return ws ? { supabase, profileId: pid as string, workspaceId: ws } : null;
}

export async function createFamily(): Promise<FamilyResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_family_workspace", { p_name: "Familie" });
  if (error) return { ok: false, message: "Kunne ikke opprette familien." };
  refresh();
  return { ok: true };
}

/** Finner en innlogging på e-post, eller lager den. */
async function findOrCreateUser(admin: NonNullable<ReturnType<typeof createAdminClient>>, email: string, meta: Record<string, unknown>) {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: meta });
  if (created.data.user) return created.data.user.id;
  // Finnes allerede: let opp
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data?.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (!data || data.users.length < 200) break;
  }
  return null;
}

/** Legger til en voksen. Hun eller han logger inn med kode på e-post, som vanlig. */
export async function addAdult(name: string, email: string): Promise<FamilyResult> {
  const n = name.trim();
  const e = email.trim().toLowerCase();
  if (!n || !EMAIL.test(e)) return { ok: false, message: "Skriv navn og en gyldig e-post." };
  const fam = await familyAsAdmin();
  if (!fam) return { ok: false, message: "Du må være voksen i familien for å legge til medlemmer." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: MISSING_KEY_MESSAGE };

  const uid = await findOrCreateUser(admin, e, { name: n });
  if (!uid) return { ok: false, message: "Kunne ikke lage innlogging for denne e-posten." };
  const { error } = await admin.rpc("admin_add_family_member", { p_workspace: fam.workspaceId, p_auth_user_id: uid, p_name: n, p_managed_by: null });
  if (error) return { ok: false, message: "Kunne ikke legge til i familien." };
  refresh();
  return { ok: true };
}

/** Legger til et barn og lager en innloggingskode. Koden vises én gang. */
export async function addChild(name: string): Promise<FamilyResult<string>> {
  const n = name.trim();
  if (!n) return { ok: false, message: "Skriv barnets navn." };
  const fam = await familyAsAdmin();
  if (!fam) return { ok: false, message: "Du må være voksen i familien for å legge til medlemmer." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: MISSING_KEY_MESSAGE };

  // Barnet har ingen e-post. Innloggingen får en adresse som aldri brukes til å sende noe.
  const email = `ordna-barn-${randomBytes(6).toString("hex")}@innspaell.no`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name: n, child: true } });
  if (error || !data.user) return { ok: false, message: "Kunne ikke lage barneprofilen." };

  const { data: pid, error: addErr } = await admin.rpc("admin_add_family_member", {
    p_workspace: fam.workspaceId,
    p_auth_user_id: data.user.id,
    p_name: n,
    p_managed_by: fam.profileId,
  });
  if (addErr || !pid) return { ok: false, message: "Kunne ikke legge barnet til i familien." };
  const code = await storeCode(admin, pid as string, fam.profileId);
  refresh();
  return code ? { ok: true, data: code } : { ok: false, message: "Barnet er lagt til, men koden ble ikke laget. Prøv «Ny kode»." };
}

async function storeCode(admin: NonNullable<ReturnType<typeof createAdminClient>>, childProfileId: string, by: string): Promise<string | null> {
  const code = generateCode();
  const { error } = await admin.from("child_login_codes").insert({
    profile_id: childProfileId,
    code_hash: hashCode(normalizeCode(code)!),
    expires_at: new Date(Date.now() + CODE_HOURS * 3600_000).toISOString(),
    created_by_profile_id: by,
  });
  return error ? null : code;
}

/** Ny innloggingskode for et barn i familien, for eksempel til en ny enhet. */
export async function newChildCode(childProfileId: string): Promise<FamilyResult<string>> {
  if (!UUID.test(childProfileId)) return { ok: false, message: "Ukjent barn." };
  const fam = await familyAsAdmin();
  if (!fam) return { ok: false, message: "Du må være voksen i familien." };
  // Barnet må være i samme familie og styrt av en voksen
  const { data: member } = await fam.supabase
    .from("memberships")
    .select("profile_id, profiles!inner(managed_by_profile_id)")
    .eq("workspace_id", fam.workspaceId)
    .eq("profile_id", childProfileId)
    .not("profiles.managed_by_profile_id", "is", null)
    .maybeSingle();
  if (!member) return { ok: false, message: "Fant ikke barnet i familien." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: MISSING_KEY_MESSAGE };
  const code = await storeCode(admin, childProfileId, fam.profileId);
  return code ? { ok: true, data: code } : { ok: false, message: "Kunne ikke lage kode." };
}

/** Barnet skriver inn koden på innloggingssiden. Gyldig i 24 timer, én gang. */
export async function redeemChildCode(input: string): Promise<FamilyResult> {
  const code = normalizeCode(input);
  if (!code) return { ok: false, message: "Koden har 8 tegn, som ABCD-EFGH." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Innlogging med kode er ikke slått på ennå." };

  const now = new Date().toISOString();
  const { data: row } = await admin
    .from("child_login_codes")
    .update({ used_at: now })
    .eq("code_hash", hashCode(code))
    .is("used_at", null)
    .gt("expires_at", now)
    .select("profile_id")
    .maybeSingle();
  if (!row) return { ok: false, message: "Koden er feil, brukt eller utløpt. Be en voksen om en ny." };

  const { data: profile } = await admin.from("profiles").select("auth_user_id").eq("id", row.profile_id).single();
  if (!profile?.auth_user_id) return { ok: false, message: "Fant ikke profilen." };
  const { data: u } = await admin.auth.admin.getUserById(profile.auth_user_id as string);
  if (!u.user?.email) return { ok: false, message: "Fant ikke innloggingen." };

  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  if (error || !link.properties?.hashed_token) return { ok: false, message: "Kunne ikke logge inn. Prøv igjen." };

  const supabase = await createClient();
  const { error: vErr } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (vErr) return { ok: false, message: "Kunne ikke logge inn. Prøv igjen." };
  return { ok: true };
}

/** Velg din egen farge. Alle kan gjøre det, også barn. Databasen sjekker paletten og at det er din profil. */
export async function setMyColor(color: string): Promise<FamilyResult> {
  if (!(PERSON_COLORS as readonly string[]).includes(color)) return { ok: false, message: "Ukjent farge." };
  const supabase = await createClient();
  const { data: pid } = await supabase.rpc("current_profile_id");
  if (!pid) return { ok: false, message: "Du er ikke logget inn." };
  const { error } = await supabase.from("profiles").update({ color }).eq("id", pid);
  if (error) return { ok: false, message: "Kunne ikke lagre fargen." };
  refresh();
  return { ok: true };
}
