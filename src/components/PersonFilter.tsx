"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SELECTION_COOKIE, serializeSelection, togglePerson, type Person } from "@/lib/people";

const YEAR = 60 * 60 * 24 * 365;

/** Rad med personer: trykk for å slå av og på. Valget huskes på enheten og gjelder både I dag og Kalender. */
export function PersonFilter({ people, selection }: { people: Person[]; selection: string[] }) {
  const router = useRouter();
  const [sel, setSel] = useState(selection);
  const [, start] = useTransition();
  const all = people.map((p) => p.key);

  function toggle(key: string) {
    const next = togglePerson(sel, key, all);
    setSel(next);
    document.cookie = `${SELECTION_COOKIE}=${serializeSelection(next)}; path=/; max-age=${YEAR}; samesite=lax`;
    start(() => router.refresh());
  }

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 md:mx-0 md:px-0" role="group" aria-label="Hvem vil du se?">
      {people.map((p) => {
        const on = sel.includes(p.key);
        return (
          <button
            key={p.key}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(p.key)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] pr-3 pl-1 text-[13px] font-semibold whitespace-nowrap"
            style={on ? { borderColor: p.color, background: `${p.color}14`, color: "#16202b" } : { borderColor: "#e3e7ec", background: "#fff", color: "#98a2b3" }}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: on ? p.color : "#c9d0d8" }}>
              {p.initial}
            </span>
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

/** PC: velg om ukevisningen har prosjekter eller personer som rader. */
export function RowsToggle({ rows }: { rows: "project" | "person" }) {
  const router = useRouter();
  const [value, setValue] = useState(rows);
  const [, start] = useTransition();
  const set = (v: "project" | "person") => {
    setValue(v);
    document.cookie = `ordna_rader=${v}; path=/; max-age=${YEAR}; samesite=lax`;
    start(() => router.refresh());
  };
  return (
    <div className="hidden items-center gap-1 rounded-xl bg-[#e9edf1] p-1 md:flex" role="group" aria-label="Rader">
      <span className="px-2 text-xs text-muted">Rader</span>
      {(["project", "person"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => set(v)}
          className={`rounded-lg px-4 py-1.5 text-sm ${value === v ? "bg-white font-semibold text-brand shadow-sm" : "text-muted"}`}
        >
          {v === "project" ? "Prosjekt" : "Person"}
        </button>
      ))}
    </div>
  );
}

/** Liten rund merkelapp med forbokstav i personens farge. */
export function PersonBadge({ name, color, initial }: { name: string; color: string; initial?: string }) {
  return (
    <span
      title={name}
      aria-label={name}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ background: color }}
    >
      {initial ?? name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Flere merker litt over hverandre: «E I» for Erlend og Ingrid. */
export function PersonBadges({ tags }: { tags?: { key: string; name: string; color: string; initial: string }[] }) {
  if (!tags?.length) return null;
  return (
    <span className="flex shrink-0 -space-x-1.5" aria-label={tags.map((t) => t.name).join(", ")}>
      {tags.map((t) => (
        <span key={t.key} className="rounded-full ring-2 ring-white">
          <PersonBadge name={t.name} color={t.color} initial={t.initial} />
        </span>
      ))}
    </span>
  );
}
