import { redirect } from "next/navigation";

/** Gammel adresse: ukevisningen ligger nå i kalenderen. */
export default async function OldWeekPage({ searchParams }: { searchParams: Promise<{ uke?: string }> }) {
  const { uke } = await searchParams;
  redirect(uke ? `/kalender?vis=uke&dato=${encodeURIComponent(uke)}` : "/kalender?vis=uke");
}
