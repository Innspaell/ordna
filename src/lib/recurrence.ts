/**
 * Gjentakelser: hvilke datoer en serie gir, hvordan den leses, og hurtigvalg for sluttdato.
 * Alle datoer er lokale (Oslo) som YYYY-MM-DD.
 */
export type Freq = "daily" | "weekly" | "monthly" | "yearly";
export type SeriesRule = { freq: Freq; weekdays: number[] | null; starts_on: string; until_date: string | null };

/** Hvert år uten sluttdato legges inn så mange år frem. */
export const YEARLY_YEARS = 10;
/** Øvre grense for antall ganger i én serie (to år med hver dag). */
export const MAX_OCCURRENCES = 800;

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
};
const daysInMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/** Mandag = 1 … søndag = 7 */
export const isoWeekday = (iso: string) => ((toDate(iso).getUTCDay() + 6) % 7) + 1;

/** Samme dag n måneder senere; siste dag i måneden hvis den er kortere. */
export function addMonthsClamped(iso: string, n: number, day = Number(iso.slice(8, 10))): string {
  const y = Number(iso.slice(0, 4));
  const m0 = Number(iso.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m0 / 12);
  const mm = ((m0 % 12) + 12) % 12;
  const dd = Math.min(day, daysInMonth(yy, mm));
  return `${yy}-${String(mm + 1).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** Første dato fra og med `from` som er en av ukedagene. */
export function firstOnOrAfter(from: string, weekdays: number[]): string {
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    if (weekdays.includes(isoWeekday(d))) return d;
  }
  return from;
}

export function occurrences(rule: SeriesRule, max = MAX_OCCURRENCES): string[] {
  const out: string[] = [];
  const until = rule.until_date ?? (rule.freq === "yearly" ? addMonthsClamped(rule.starts_on, 12 * YEARLY_YEARS - 1) : rule.starts_on);
  const day = Number(rule.starts_on.slice(8, 10));
  if (rule.freq === "daily" || rule.freq === "weekly") {
    const days = rule.freq === "weekly" ? (rule.weekdays ?? []) : [1, 2, 3, 4, 5, 6, 7];
    for (let d = rule.starts_on; d <= until && out.length < max; d = addDays(d, 1)) if (days.includes(isoWeekday(d))) out.push(d);
  } else {
    const step = rule.freq === "monthly" ? 1 : 12;
    for (let i = 0; out.length < max; i++) {
      const d = addMonthsClamped(rule.starts_on, i * step, day);
      if (d > until) break;
      out.push(d);
    }
  }
  return out;
}

const DAY_NAMES = ["", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"];
const MONTH_NAMES = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} og ${xs[xs.length - 1]}` : (xs[0] ?? ""));
export const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export function describeRule(r: SeriesRule): string {
  const until = r.until_date ? ` til ${shortDate(r.until_date)}` : "";
  const day = Number(r.starts_on.slice(8, 10));
  switch (r.freq) {
    case "daily":
      return `Hver dag${until}`;
    case "weekly":
      return `Hver ${list([...(r.weekdays ?? [])].sort().map((d) => DAY_NAMES[d]))}${until}`;
    case "monthly":
      return `Hver måned den ${day}.${until}`;
    case "yearly":
      return `Hvert år ${day}. ${MONTH_NAMES[Number(r.starts_on.slice(5, 7)) - 1]}${until}`;
  }
}

// ── Skoleferier i Stjørdal (stjordal.kommune.no, skoleruta 2026–2027 og 2027–2028) ──
// `until` er siste skoledag før ferien.
type Break = { key: "høst" | "jul" | "vinter" | "påske" | "sommer"; label: string; until: string };
export const SCHOOL_BREAKS: Break[] = [
  { key: "høst", label: "Høstferie", until: "2026-10-02" },
  { key: "jul", label: "Juleferie", until: "2026-12-22" },
  { key: "vinter", label: "Vinterferie", until: "2027-02-19" },
  { key: "påske", label: "Påskeferie", until: "2027-03-19" },
  { key: "sommer", label: "Sommerferie", until: "2027-06-18" },
  { key: "høst", label: "Høstferie", until: "2027-10-08" },
  { key: "jul", label: "Juleferie", until: "2027-12-22" },
  { key: "vinter", label: "Vinterferie", until: "2028-02-18" },
  { key: "påske", label: "Påskeferie", until: "2028-04-07" },
  { key: "sommer", label: "Sommerferie", until: "2028-06-22" },
];
const BREAK_WORDS: Record<string, Break["key"]> = {
  høstferie: "høst", høstferien: "høst", høsten: "høst",
  jul: "jul", juleferie: "jul", juleferien: "jul", julen: "jul",
  vinterferie: "vinter", vinterferien: "vinter",
  påske: "påske", påskeferie: "påske", påskeferien: "påske", påsken: "påske",
  sommer: "sommer", sommerferie: "sommer", sommerferien: "sommer", sommeren: "sommer",
};
export const BREAK_PATTERN = Object.keys(BREAK_WORDS).sort((a, b) => b.length - a.length).join("|");

export function nextBreak(word: string, today: string): { label: string; until: string } | undefined {
  const key = BREAK_WORDS[word.toLowerCase()];
  const b = key && SCHOOL_BREAKS.find((x) => x.key === key && x.until >= today);
  return b ? { label: b.label, until: b.until } : undefined;
}

/** Hurtigvalg for «Til og med»: de fire neste feriene, og om 1, 3 og 6 måneder. */
export function untilChoices(today: string): { label: string; until: string }[] {
  const breaks = SCHOOL_BREAKS.filter((b) => b.until >= today).slice(0, 4).map(({ label, until }) => ({ label, until }));
  return [...breaks, ...[1, 3, 6].map((n) => ({ label: `Om ${n} mnd`, until: addMonthsClamped(today, n) }))];
}
