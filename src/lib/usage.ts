/** Oppsummering av brukslogg: brukes for å se om Ordna faktisk brukes daglig og om registrering går raskt. */
import { osloToday } from "./quick-add/parse";

export type UsageEvent = { event: string; created_at: string; duration_ms: number | null };

export type UsageSummary = {
  windowDays: number;
  daysUsed: number;
  /** Dager på rad med bruk, regnet bakover fra i går eller i dag */
  streak: number;
  quickAdds: number;
  medianMs: number | null;
  under5sShare: number | null;
  bySource: Record<string, number>;
};

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function summarizeUsage(events: UsageEvent[], today: string, windowDays = 28): UsageSummary {
  const start = addDays(today, -(windowDays - 1));
  const inWindow = events
    .map((e) => ({ ...e, day: osloToday(new Date(e.created_at)) }))
    .filter((e) => e.day >= start && e.day <= today);

  const days = new Set(inWindow.map((e) => e.day));

  // I dag teller hvis den finnes, ellers starter rekken i går
  let streak = 0;
  let d = days.has(today) ? today : addDays(today, -1);
  while (days.has(d)) {
    streak++;
    d = addDays(d, -1);
  }

  const adds = inWindow.filter((e) => e.event.startsWith("quick_add"));
  const durations = adds.map((e) => e.duration_ms).filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
  const median = durations.length
    ? durations.length % 2
      ? durations[(durations.length - 1) / 2]
      : Math.round((durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2)
    : null;

  const bySource: Record<string, number> = {};
  for (const e of adds) {
    const src = e.event.split(":")[1] ?? "ukjent";
    bySource[src] = (bySource[src] ?? 0) + 1;
  }

  return {
    windowDays,
    daysUsed: days.size,
    streak,
    quickAdds: adds.length,
    medianMs: median,
    under5sShare: durations.length ? durations.filter((x) => x < 5000).length / durations.length : null,
    bySource,
  };
}
