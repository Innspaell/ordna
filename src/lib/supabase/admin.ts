import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * Klient med service role: kan lage brukere og omgår RLS.
 * Brukes bare på serveren, og bare etter at vi har sjekket at den som spør har lov.
 * Returnerer null hvis nøkkelen ikke er satt i Vercel.
 */
export function createAdminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const MISSING_KEY_MESSAGE =
  "Ordna mangler nøkkelen som trengs for å lage brukere. Legg SUPABASE_SERVICE_ROLE_KEY inn i Vercel og bygg på nytt.";
