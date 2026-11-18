"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { makeRecurring, setSeriesUntil } from "@/app/actions/series";
import { isoWeekday, occurrences, untilChoices, type Freq } from "@/lib/recurrence";
import type { Scope } from "@/app/actions/items";
import type { SeriesInfo } from "@/lib/series-info";

const FREQS: { value: Freq | "never"; label: string }[] = [
  { value: "never", label: "Aldri" },
  { value: "daily", label: "Hver dag" },
  { value: "weekly", label: "Hver uke" },
  { value: "monthly", label: "Hver måned" },
  { value: "yearly", label: "Hvert år" },
];
const DAYS = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];
const pill = (on: boolean) => `rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-semibold ${on ? "border-brand bg-brand-soft text-brand" : "border-line bg-white text-muted"}`;
const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

export const RepeatIcon = ({ className = "" }: { className?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a3 3 0 0 1 3-3h15" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a3 3 0 0 1-3 3H3" />
  </svg>
);

function UntilPicker({ value, onChange, today, optional }: { value: string; onChange: (v: string) => void; today: string; optional?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor="rep-until">
        Til og med {optional ? <span className="font-normal text-muted">(valgfritt for merkedager)</span> : <span className="text-bad">*</span>}
      </label>
      <input id="rep-until" type="date" className="input" value={value} min={today} onChange={(e) => onChange(e.target.value)} />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {untilChoices(today).map((c) => (
          <button key={c.label} type="button" className="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-muted" onClick={() => onChange(c.until)}>
            {c.label} ({dm(c.until)})
          </button>
        ))}
      </div>
    </div>
  );
}

/** «Endringer gjelder: Bare denne | Denne og fremover». */
export function ScopeToggle({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">Endringer gjelder</span>
      <div className="flex rounded-xl bg-[#e9edf1] p-1" role="group">
        {(["one", "future"] as const).map((s) => (
          <button key={s} type="button" aria-pressed={value === s} onClick={() => onChange(s)} className={`rounded-lg px-3 py-1 text-sm ${value === s ? "bg-white font-semibold text-brand shadow-sm" : "text-muted"}`}>
            {s === "one" ? "Bare denne" : "Denne og fremover"}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Gjentas: lag en serie av denne, eller se og endre serien den hører til. */
export function SeriesPanel({ itemId, kind, date, today, series, scope, setScope }: { itemId: string; kind: "task" | "appointment"; date: string | null; today: string; series: SeriesInfo | null; scope: Scope; setScope: (s: Scope) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [freq, setFreq] = useState<Freq | "never">("never");
  const [days, setDays] = useState<number[]>(date ? [isoWeekday(date)] : [1]);
  const [until, setUntil] = useState(series?.until ?? "");

  if (series) {
    return (
      <section className="card space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <RepeatIcon /> {series.label}
          <span className="font-normal text-muted">· {series.index} av {series.total}</span>
        </div>
        <ScopeToggle value={scope} onChange={setScope} />
        <UntilPicker value={until} onChange={setUntil} today={today} optional={series.freq === "yearly"} />
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-ghost"
            disabled={pending || until === (series.until ?? "") || (!until && series.freq !== "yearly")}
            onClick={() =>
              start(async () => {
                const res = await setSeriesUntil(itemId, until || null);
                setMsg(res.ok ? "Lagret" : res.message);
                if (res.ok) router.refresh();
              })
            }
          >
            Lagre til og med
          </button>
          {msg && <span className="text-sm text-muted">{msg}</span>}
        </div>
      </section>
    );
  }

  const needsUntil = freq !== "never" && freq !== "yearly" && !until;
  const count = date && freq !== "never" && !needsUntil ? occurrences({ freq, weekdays: freq === "weekly" ? days : null, starts_on: date, until_date: until || null }).length : 0;

  return (
    <details className="card group space-y-3 py-3" open={freq !== "never"}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
        <RepeatIcon /> Gjentas <span className="font-normal text-muted">· {FREQS.find((f) => f.value === freq)?.label}</span>
        <span className="ml-auto text-muted transition group-open:rotate-90">›</span>
      </summary>
      <div className="flex flex-wrap gap-1.5 pt-3">
        {FREQS.map((f) => (
          <button key={f.value} type="button" className={pill(freq === f.value)} onClick={() => setFreq(f.value)} disabled={!date && f.value !== "never"}>
            {f.label}
          </button>
        ))}
      </div>
      {!date && <p className="text-xs text-muted">{kind === "task" ? "Sett en frist først, så kan oppgaven gjentas." : "Velg en dato først."}</p>}
      {freq === "weekly" && (
        <div className="flex gap-1.5" role="group" aria-label="Dager">
          {DAYS.map((d, i) => {
            const n = i + 1;
            const on = days.includes(n);
            return (
              <button key={d} type="button" aria-pressed={on} onClick={() => setDays((x) => (on ? x.filter((y) => y !== n) : [...x, n].sort()))} className={`h-10 w-10 rounded-full border-[1.5px] text-[13px] font-bold ${on ? "border-brand bg-brand text-white" : "border-line bg-white text-muted"}`}>
                {d}
              </button>
            );
          })}
        </div>
      )}
      {freq !== "never" && (
        <>
          <UntilPicker value={until} onChange={setUntil} today={today} optional={freq === "yearly"} />
          {count > 0 && <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">{count} ganger legges inn nå{until ? ` · til ${dm(until)}${until.slice(0, 4)}` : " · 10 år frem"}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={pending || needsUntil || (freq === "weekly" && !days.length) || count === 0}
              onClick={() =>
                start(async () => {
                  const res = await makeRecurring(itemId, { freq, weekdays: days, until: until || null });
                  setMsg(res.ok ? `${res.count ?? ""} ganger lagt inn` : res.message);
                  if (res.ok) router.refresh();
                })
              }
            >
              {pending ? "Lagrer …" : "Gjenta"}
            </button>
            {msg && <span className="text-sm text-muted">{msg}</span>}
          </div>
        </>
      )}
    </details>
  );
}
