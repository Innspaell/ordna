"use server";

import { createClient } from "@/lib/supabase/server";

/** Logger at appen ble åpnet. Klienten sørger for at det skjer høyst én gang per dag per enhet. */
export async function logOpen(): Promise<void> {
  const supabase = await createClient();
  const { data: profileId } = await supabase.rpc("current_profile_id");
  if (!profileId) return;
  await supabase.from("usage_events").insert({ profile_id: profileId, event: "open" });
}
