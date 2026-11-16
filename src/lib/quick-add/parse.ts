/**
 * Tolkning av tekst i rask registrering. Faste regler, ingen KI.
 *
 * Tolker dato ("i morgen", "torsdag", "21.11"), klokkeslett ("kl 14", "12-20"),
 * prosjekt ("#bryllup") og sted for plukklisten ("@hjemme"). Det som tolkes,
 * fjernes fra tittelen og vises som merker. Alle datoer og klokkeslett er lokale
 * (Europe/Oslo) og returneres som tekst: YYYY-MM-DD og HH:MM.
 */

export type PickContext = "home" | "computer" | "phone" | "outside";

export type ProjectOption = {
  /** Id-en til prosjektet eller delprosjektet */
  id: string;
  name: string;
  /** Prosjektet elementet hører til (lik id for prosjekter) */
  projectId: string;
  kind: "project" | "subproject";
  /** Navnet på prosjektet, for delprosjekter */
  projectName?: string;
};

export type ChipType = "date" | "time" | "project" | "context" | "person" | "workspace";

export type Named = { id: string; name: string };

export type Chip = { type: ChipType; text: string; label: string };

export type ProjectResult =
  | { status: "none"; tag?: string }
  | { status: "one"; tag: string; match: ProjectOption }
  | { status: "many"; tag: string; candidates: ProjectOption[] };

export type QuickAddResult = {
  title: string;
  kind: "task" | "appointment";
  /** Frist for oppgaver */
  dueDate?: string;
  /** Avtaler */
  startDate?: string;
  startTime?: string;
  endTime?: string;
  pickContext?: PickContext;
  project: ProjectResult;
  /** @navn: hvem det gjelder */
  /** Hvem det gjelder: alle @navn, i rekkefølge */
  people: Named[];
  /** #arbeidsområde, når ingen prosjekter matcher */
  workspace?: Named;
  /** Oppgave uten prosjekt, sted og frist */
  inInbox: boolean;
  chips: Chip[];
};

export type ParseOptions = {
  /** Dagens dato i Oslo, YYYY-MM-DD */
  today: string;
  projects: ProjectOption[];
  /** Personer man kan nevne med @navn (familien) */
  people?: Named[];
  /** Arbeidsområder man kan velge med #navn */
  workspaces?: Named[];
  /** Merketyper brukeren har trykket bort */
  ignore?: ChipType[];
};

const CONTEXTS: Record<string, PickContext> = {
  hjemme: "home",
  pc: "computer",
  telefon: "phone",
  tlf: "phone",
  ute: "outside",
};
const CONTEXT_LABEL: Record<PickContext, string> = { home: "Hjemme", computer: "PC", phone: "Telefon", outside: "Ute" };

const WEEKDAYS: Record<string, number> = { søndag: 0, mandag: 1, tirsdag: 2, onsdag: 3, torsdag: 4, fredag: 5, lørdag: 6 };
const WEEKDAY_NAMES = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const MONTHS = ["jan.", "feb.", "mars", "apr.", "mai", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "des."];

// Et "ord" starter i begynnelsen eller etter mellomrom og slutter før mellomrom eller slutt.
const END = "(?=\\s|$)";
const PREP = "(?:(?:på|til|innen)\\s+)?";

// ── Datoer ──────────────────────────────────────────────────────
function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}
function validDate(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined;
  return toIso(date);
}

/** Kort, lesbar dato til merket: "tor. 19. nov." */
export function formatDateLabel(iso: string, today: string): string {
  if (iso === today) return "I dag";
  if (iso === addDays(today, 1)) return "I morgen";
  const d = toDate(iso);
  const wd = WEEKDAY_NAMES[d.getUTCDay()].slice(0, 3);
  const year = iso.slice(0, 4) !== today.slice(0, 4) ? ` ${iso.slice(0, 4)}` : "";
  return `${wd}. ${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}${year}`;
}

// ── Klokkeslett ─────────────────────────────────────────────────
function validTime(h: string, m: string | undefined): string | undefined {
  const hh = Number(h);
  const mm = m === undefined ? 0 : Number(m);
  if (!Number.isInteger(hh) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return undefined;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function plusOneHour(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const total = Math.min(h * 60 + m + 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ── Prosjekter ──────────────────────────────────────────────────
function compact(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}
function words(s: string): string[] {
  return s.normalize("NFC").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export function matchProjects(tag: string, projects: ProjectOption[]): ProjectOption[] {
  const t = compact(tag);
  if (!t) return [];
  const tiers: Array<(p: ProjectOption) => boolean> = [
    (p) => compact(p.name) === t,
    (p) => compact(p.name).startsWith(t),
    (p) => words(p.name).some((w) => w.startsWith(t)),
    (p) => compact(p.name).includes(t),
  ];
  for (const test of tiers) {
    const hits = projects.filter(test);
    if (hits.length) return hits;
  }
  return [];
}

// ── Selve tolkningen ────────────────────────────────────────────
type Found = { start: number; end: number; chip: Chip };

export function parseQuickAdd(text: string, opts: ParseOptions): QuickAddResult {
  const { today, projects } = opts;
  const ignore = new Set(opts.ignore ?? []);
  let work = text.normalize("NFC");
  const found: Found[] = [];

  /** Finner første treff, lar fn avgjøre om det godtas, og blanker ut det som ble brukt. */
  function take(re: RegExp, fn: (m: RegExpExecArray) => Chip | undefined): boolean {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = g.exec(work))) {
      const lead = m[1] ?? ""; // mellomrommet før ordet hører ikke til treffet
      const start = m.index + lead.length;
      const end = m.index + m[0].length;
      const chip = fn(m);
      if (chip) {
        found.push({ start, end, chip: { ...chip, text: text.slice(start, end).trim() } });
        work = work.slice(0, start) + " ".repeat(end - start) + work.slice(end);
        return true;
      }
    }
    return false;
  }

  // Sted for plukklisten: @hjemme, @pc, @telefon/@tlf, @ute
  let pickContext: PickContext | undefined;
  if (!ignore.has("context")) {
    take(new RegExp(`(^|\\s)@(\\p{L}+)${END}`, "iu"), (m) => {
      const ctx = CONTEXTS[m[2].toLowerCase()];
      if (!ctx) return undefined;
      pickContext = ctx;
      return { type: "context", text: "", label: CONTEXT_LABEL[ctx] };
    });
  }

  // Person: @navn (starten av navnet holder)
  const people: Named[] = [];
  if (!ignore.has("person") && opts.people?.length) {
    const re = new RegExp(`(^|\\s)@(\\p{L}[\\p{L}-]*)${END}`, "iu");
    const onPerson = (m: RegExpExecArray): Chip | undefined => {
      const w = m[2].toLowerCase();
      const hits = opts.people!.filter((p) => p.name.toLowerCase() === w);
      const pick = hits.length ? hits : opts.people!.filter((p) => p.name.toLowerCase().startsWith(w));
      if (pick.length !== 1) return undefined;
      if (!people.some((x) => x.id === pick[0].id)) people.push(pick[0]);
      return { type: "person", text: "", label: pick[0].name };
    };
    while (take(re, onPerson));
  }

  // Prosjekt: #ord (eller arbeidsområde hvis ingen prosjekter matcher)
  let project: ProjectResult = { status: "none" };
  let workspace: Named | undefined;
  if (!ignore.has("project")) {
    const tagRe = new RegExp(`(^|\\s)#([\\p{L}\\p{N}_-]+)${END}`, "u");
    const m = tagRe.exec(work);
    if (m) {
      const tag = m[2];
      const hits = matchProjects(tag, projects);
      const ws = hits.length === 0 && !ignore.has("workspace") ? (opts.workspaces ?? []).filter((w) => compact(w.name).startsWith(compact(tag))) : [];
      if (hits.length === 0 && ws.length === 1) {
        take(tagRe, () => ({ type: "workspace", text: "", label: ws[0].name }));
        workspace = ws[0];
      } else if (hits.length === 0) {
        // Ingen treff: ordet blir stående i tittelen, uten #
        const at = m.index + m[1].length;
        work = work.slice(0, at) + " " + work.slice(at + 1);
        project = { status: "none", tag };
      } else {
        take(tagRe, () =>
          hits.length === 1
            ? { type: "project", text: "", label: hits[0].kind === "subproject" && hits[0].projectName ? `${hits[0].projectName} › ${hits[0].name}` : hits[0].name }
            : { type: "project", text: "", label: `#${tag}: velg prosjekt` },
        );
        project = hits.length === 1 ? { status: "one", tag, match: hits[0] } : { status: "many", tag, candidates: hits };
      }
    }
  }

  // Klokkeslett: tidsrom først, så enkelt klokkeslett
  let startTime: string | undefined;
  let endTime: string | undefined;
  if (!ignore.has("time")) {
    const range = new RegExp(`(^|\\s)(?:kl\\.?\\s*)?(\\d{1,2})(?:[:.](\\d{2}))?\\s*[-–]\\s*(\\d{1,2})(?:[:.](\\d{2}))?${END}`, "iu");
    const gotRange = take(range, (m) => {
      const s = validTime(m[2], m[3]);
      const e = validTime(m[4], m[5]);
      if (!s || !e || e <= s) return undefined;
      startTime = s;
      endTime = e;
      return { type: "time", text: "", label: `${s}–${e}` };
    });
    if (!gotRange) {
      const withKl = new RegExp(`(^|\\s)kl\\.?\\s*(\\d{1,2})(?:[:.](\\d{2}))?${END}`, "iu");
      const withColon = new RegExp(`(^|\\s)(\\d{1,2}):(\\d{2})${END}`, "u");
      const single = (m: RegExpExecArray): Chip | undefined => {
        const s = validTime(m[2], m[3]);
        if (!s) return undefined;
        startTime = s;
        endTime = plusOneHour(s);
        return { type: "time", text: "", label: `kl. ${s}` };
      };
      if (!take(withKl, single)) take(withColon, single);
    }
  }

  // Dato: relative ord, ukedager, så tall
  let date: string | undefined;
  if (!ignore.has("date")) {
    const rel: Array<[string, number]> = [
      ["i\\s+overmorgen", 2],
      ["(?:i\\s+morgen|imorgen)", 1],
      ["(?:i\\s+dag|idag)", 0],
    ];
    for (const [pattern, days] of rel) {
      if (take(new RegExp(`(^|\\s)${PREP}${pattern}${END}`, "iu"), () => {
        date = addDays(today, days);
        return { type: "date", text: "", label: formatDateLabel(date, today) };
      })) break;
    }

    if (!date) {
      take(new RegExp(`(^|\\s)${PREP}(neste\\s+)?(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)${END}`, "iu"), (m) => {
        const target = WEEKDAYS[m[3].toLowerCase()];
        const current = toDate(today).getUTCDay();
        let diff = (target - current + 7) % 7;
        if (m[2] && diff === 0) diff = 7; // "neste" er aldri i dag
        date = addDays(today, diff);
        return { type: "date", text: "", label: formatDateLabel(date, today) };
      });
    }

    if (!date) {
      take(new RegExp(`(^|\\s)${PREP}(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{4}|\\d{2})?)?${END}`, "u"), (m) => {
        const d = Number(m[2]);
        const mo = Number(m[3]);
        const thisYear = Number(today.slice(0, 4));
        let iso: string | undefined;
        if (m[4]) {
          const y = m[4].length === 2 ? 2000 + Number(m[4]) : Number(m[4]);
          iso = validDate(y, mo, d);
        } else {
          iso = validDate(thisYear, mo, d);
          if (iso && iso < today) iso = validDate(thisYear + 1, mo, d);
        }
        if (!iso) return undefined;
        date = iso;
        return { type: "date", text: "", label: formatDateLabel(iso, today) };
      });
    }
  }

  const title = work.replace(/\s+/g, " ").trim();
  const kind: QuickAddResult["kind"] = startTime ? "appointment" : "task";
  const chips = found.sort((a, b) => a.start - b.start).map((f) => f.chip);

  return {
    title,
    kind,
    dueDate: kind === "task" ? date : undefined,
    startDate: kind === "appointment" ? (date ?? today) : undefined,
    startTime,
    endTime,
    pickContext,
    project,
    people,
    workspace,
    inInbox: kind === "task" && project.status === "none" && !pickContext && !date && !people.length && !workspace,
    chips,
  };
}

/** Dagens dato i Oslo som YYYY-MM-DD. */
export function osloToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Lokal dato og klokkeslett i Oslo → ISO-tidspunkt i UTC. */
export function osloToUtcIso(date: string, time: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  // Gjett først at tidspunktet er UTC, finn Oslos avvik der, og juster.
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offset = (t: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Oslo",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(t));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - t;
  };
  const first = guess - offset(guess);
  const second = guess - offset(first);
  return new Date(second).toISOString();
}
