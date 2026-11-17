/** Handleliste: «Nylig handlet» og loggen (hvem gjorde hva). */
import { osloParts } from "./item-edit";
import { addDays } from "./week";

export type ListAction = "added" | "checked" | "unchecked" | "cleared" | "restored" | "deleted";
export type ListEvent = { id: number; action: ListAction; title: string; who: string | null; profile_id: string | null; created_at: string };
export type EventGroup = { key: number; action: ListAction; who: string | null; titles: string[]; at: string };

const norm = (t: string) => t.trim().toLocaleLowerCase("nb");

/** Ryddede varer, nyeste først, én per navn, og ikke det som allerede står på listen. */
export function recentlyBought<T extends { id: string; title: string; cleared_at: string }>(cleared: T[], onList: string[], limit = 15): T[] {
  const seen = new Set(onList.map(norm));
  const out: T[] = [];
  for (const r of [...cleared].sort((a, b) => b.cleared_at.localeCompare(a.cleared_at))) {
    const k = norm(r.title);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

const GAP_MS = 5 * 60 * 1000;

/** Slår sammen det samme personen gjorde på rad (innen fem minutter). Forventer nyeste først. */
export function groupEvents(events: ListEvent[]): EventGroup[] {
  const groups: (EventGroup & { last: number; pid: string | null })[] = [];
  for (const e of events) {
    const g = groups[groups.length - 1];
    const t = Date.parse(e.created_at);
    if (g && g.pid === e.profile_id && g.action === e.action && g.last - t <= GAP_MS) {
      g.titles.push(e.title);
      g.last = t;
    } else {
      groups.push({ key: e.id, action: e.action, who: e.who, titles: [e.title], at: e.created_at, last: t, pid: e.profile_id });
    }
  }
  return groups.map(({ key, action, who, titles, at }) => ({ key, action, who, titles, at }));
}

const VERB: Record<ListAction, string> = {
  added: "la til",
  checked: "krysset av",
  unchecked: "fjernet krysset på",
  cleared: "ryddet",
  restored: "la tilbake",
  deleted: "slettet",
};

export function eventLabel(g: { who: string | null; action: ListAction; titles: string[] }): string {
  const t = g.titles;
  const list = t.length === 1 ? t[0] : t.length === 2 ? `${t[0]} og ${t[1]}` : t.length === 3 ? `${t[0]}, ${t[1]} og ${t[2]}` : `${t.slice(0, 3).join(", ")} og ${t.length - 3} til`;
  return `${g.who ?? "Noen"} ${VERB[g.action]} ${list}`;
}

export function whenLabel(iso: string, today: string): string {
  const { date, time } = osloParts(iso);
  if (date === today) return `i dag ${time}`;
  if (date === addDays(today, -1)) return `i går ${time}`;
  const [, m, d] = date.split("-");
  return `${d}.${m}. ${time}`;
}
