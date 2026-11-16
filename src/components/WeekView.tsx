import Link from "next/link";
import type { Tone, WeekDay, WeekEntry, WeekRow } from "@/lib/week";
import { calendarHref } from "@/lib/calendar";

type View = { days: WeekDay[]; rows: WeekRow[] };
import { APPOINTMENT_COLOR, STATUS } from "@/lib/ui";

export const TONE: Record<Tone, string> = {
  appt: APPOINTMENT_COLOR,
  due: STATUS.ready.bg,
  focus: STATUS.in_progress.bg,
  overdue: STATUS.overdue.bg,
};
export const LABEL: Record<Tone, string> = { appt: "Avtale", due: "Frist", focus: "Fokus", overdue: "Forfalt" };
export const href = (e: WeekEntry) => (e.kind === "appointment" ? `/avtale/${e.id}` : `/oppgave/${e.id}`);

/** Mobil: én rad per dag. */
export function WeekDays({ view }: { view: View }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white md:hidden">
      {view.days.map((d) => (
        <div key={d.date} className={`flex gap-3 border-t border-[#f0f2f5] px-3 py-2.5 first:border-t-0 ${d.isToday ? "bg-[#f3f8f6]" : ""}`}>
          <Link href={calendarHref("day", d.date)} className="flex w-11 shrink-0 flex-col items-center pt-0.5" aria-label={`Vis ${d.wd} ${d.num}`}>
            <span className={`text-[11px] font-semibold uppercase ${d.isToday ? "text-brand" : "text-muted"}`}>{d.wd}</span>
            <span className={`text-xl font-bold ${d.isToday ? "text-brand" : ""}`}>{d.num}</span>
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {d.entries.length === 0 && <span className="py-1.5 text-sm text-[#98a2b3]">Ledig</span>}
            {d.entries.map((e) => (
              <Link
                key={`${e.id}-${e.tone}`}
                href={href(e)}
                className="flex flex-col gap-px rounded-lg border-l-4 px-2.5 py-1.5"
                style={
                  e.tone === "appt"
                    ? { borderColor: TONE.appt, background: `${TONE.appt}14` }
                    : { borderColor: TONE[e.tone], background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7ec" }
                }
              >
                <span className="flex justify-between gap-2">
                  <span className="text-sm font-semibold break-words">{e.title}</span>
                  {e.tone === "appt" ? (
                    <span className="text-[11px] font-semibold" style={{ color: TONE.appt }}>Avtale</span>
                  ) : (
                    <span className="h-fit rounded px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white" style={{ background: TONE[e.tone] }}>
                      {LABEL[e.tone]}
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted">{[e.tone === "appt" ? e.top : e.top !== LABEL[e.tone] ? e.top : null, e.personName, e.projectName].filter(Boolean).join(" · ")}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** PC: prosjekter som rader, dager som kolonner. */
export function WeekGrid({ view }: { view: View }) {
  return (
    <div className="hidden space-y-3 md:block">
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[180px_repeat(7,minmax(0,1fr))] border-b border-line">
            <div className="px-4 py-3 text-xs text-muted">Prosjekt</div>
            {view.days.map((d) => (
              <Link key={d.date} href={calendarHref("day", d.date)} className={`flex items-baseline gap-1.5 border-l border-[#f0f2f5] px-3 py-2.5 hover:bg-paper ${d.isToday ? "bg-[#f3f8f6]" : ""}`}>
                <span className={`text-xs font-semibold uppercase ${d.isToday ? "text-brand" : "text-muted"}`}>{d.wd}</span>
                <span className={`text-lg font-bold ${d.isToday ? "text-brand" : ""}`}>{d.num}</span>
              </Link>
            ))}
          </div>
          {view.rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">Ingen avtaler, frister eller fokus denne uka.</p>}
          {view.rows.map((r) => (
            <div key={r.id ?? "none"} className="grid min-h-20 grid-cols-[180px_repeat(7,minmax(0,1fr))] border-b border-[#f0f2f5] last:border-b-0">
              <div className="flex items-start gap-2.5 border-r border-[#f0f2f5] px-4 py-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} />
                {r.id ? (
                  <Link href={`/prosjekter/${r.id}`} className="text-sm font-semibold break-words hover:text-brand">{r.name}</Link>
                ) : (
                  <span className="text-sm font-semibold">{r.name}</span>
                )}
              </div>
              {r.cells.map((cell, i) => (
                <div key={i} className={`flex flex-col gap-1.5 border-l border-[#f0f2f5] p-2 ${view.days[i].isToday ? "bg-[#f3f8f6]" : ""}`}>
                  {cell.map((e) => (
                    <Link
                      key={`${e.id}-${e.tone}`}
                      href={href(e)}
                      className="flex flex-col gap-px rounded-md px-2 py-1.5 text-white hover:brightness-110"
                      style={{ background: TONE[e.tone] }}
                    >
                      <span className="text-[11px] opacity-90">{e.top}</span>
                      <span className="text-[13px] leading-tight font-semibold break-words">{e.title}</span>
                      {e.personName && <span className="text-[11px] opacity-90">{e.personName}</span>}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        {(Object.keys(LABEL) as Tone[]).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px]" style={{ background: TONE[t] }} />
            {LABEL[t]}
          </span>
        ))}
      </div>
    </div>
  );
}
