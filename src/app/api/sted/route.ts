import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { autocompleteBody, fromGoogle, mergePlaces, recentPlaces, type PlaceSuggestion } from "@/lib/places";

/**
 * Forslag til Sted: steder dere har brukt før, og Google (Places API, Autocomplete New).
 * Nøkkelen (GOOGLE_MAPS_API_KEY) brukes bare her på serveren, og bare for innloggede.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ suggestions: [] }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  const session = (req.nextUrl.searchParams.get("s") ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);

  const { data: used } = await supabase.from("items").select("location").not("location", "is", null).order("updated_at", { ascending: false }).limit(300);
  const recent = recentPlaces((used ?? []).map((u) => u.location as string), q);

  const key = process.env.GOOGLE_MAPS_API_KEY;
  let google: PlaceSuggestion[] = [];
  if (key && q.trim().length >= 3) {
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
        body: JSON.stringify(autocompleteBody(q.trim(), session || crypto.randomUUID())),
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      });
      if (res.ok) google = fromGoogle(await res.json());
      else console.error("Google Places", res.status, (await res.text()).slice(0, 200));
    } catch (e) {
      console.error("Google Places", e);
    }
  }
  return NextResponse.json({ suggestions: mergePlaces(recent, google), google: !!key });
}
