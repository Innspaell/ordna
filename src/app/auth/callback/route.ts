import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/next-path";

/** Lenken i innloggings-e-posten lander her. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await supabase.rpc("ensure_my_setup");
      return NextResponse.redirect(`${origin}${safeNextPath(searchParams.get("next"))}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?feil=lenke`);
}
