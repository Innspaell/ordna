import Link from "next/link";
import type { WeekDay } from "@/lib/week";
import { calendarHref, inMonth } from "@/lib/calendar";
import { EntryBadge, EntryTitle, href, LABEL, TONE } from "./WeekView";

/** Dag: alt på én dag, avtaler først etter tid. Samme kort på mobil og PC. */
export function DayList({ day }: { day: WeekDay }) {
  if (!day.entries.length) {
    return (
      <div className="card py-8 text-center">
        <p className="font-medium">Ingenting denne dagen</p>
        <p className="mt-1 text-sm text-muted">Ingen avtaler, frister eller fokus.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {day.entries.map((e) => (
        <li key={`${e.id}-${e.tone}`}>
          <Link
            href={href(e)}
            className="flex items-center gap-3 rounded-xl border border-line border-l-[5px] bg-white px-4 py-3 hover:border-brand/40"
            style={{ borderLeftColor: TONE[e.tone] }}
          >
            <span className="w-24 shrink-0 text-sm font-semibold tabular-nums" style={{ color: e.tone === "appt" ? TONE.appt : "#5b6673" }}>
              {e.tone === "appt" ? e.top : ""}
            </span>
            <div className="min-w-0 flex-1">
              <EntryTitle e={e} className="block text-[15px] break-words" />
              {(e.projectName || e.personName) && <div className="text-xs text-muted">{[e.personName, e.projectName].filter(Boolean).join(" · ")}</div>}
            </div>
            <EntryBadge e={e} />
            <span className="rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap text-white" style={{ background: TONE[e.tone] }}>
              {e.tone === "appt" ? LABEL.appt : e.top}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const WD_HEAD = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

/** Måned: rutenett med hele uker. PC viser titler, mobil viser fargeprikker. Trykk på en dag åpner dagvisningen. */
export function MonthGrid({ days, shown }: { days: WeekDay[]; shown: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="grid grid-cols-7 border-b border-line">
        {WD_HEAD.map((w) => (
          <div key={w} className="py-2 text-center text-[11px] font-semibold uppercase text-muted md:text-xs">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const dim = !inMonth(d.date, shown);
          const more = d.entries.length - 3;
          return (
            <Link
              key={d.date}
              href={calendarHref("day", d.date)}
              className={`flex min-h-16 flex-col gap-1 border-t border-l border-[#f0f2f5] p-1.5 first:border-l-0 hover:bg-paper md:min-h-28 md:p-2 [&:nth-child(7n+1)]:border-l-0 ${d.isToday ? "bg-[#f3f8f6]" : ""} ${dim ? "opacity-45" : ""}`}
              aria-label={`${d.wd} ${d.num}: ${d.entries.length} ting`}
            >
              <span className={`flex h-6 w-6 items-center justify-center self-center rounded-full text-[13px] md:self-start md:text-sm ${d.isToday ? "bg-brand font-bold text-white" : "font-medium"}`}>
                {d.num}
              </span>
              <span className="flex flex-wrap justify-center gap-1 md:hidden">
                {d.entries.slice(0, 4).map((e) => (
                  <span key={`${e.id}-${e.tone}`} className="h-1.5 w-1.5 rounded-full" style={{ background: TONE[e.tone] }} />
                ))}
              </span>
              <span className="hidden flex-col gap-1 md:flex">
                {d.entries.slice(0, 3).map((e) => (
                  <span key={`${e.id}-${e.tone}`} className={`truncate rounded px-1.5 py-0.5 text-xs font-medium text-white ${e.cancelled ? "line-through opacity-60" : ""}`} style={{ background: TONE[e.tone] }}>
                    {e.tone === "appt" && e.top !== "Hele dagen" ? `${e.top.slice(0, 5)} ` : ""}
                    {e.title}
                  </span>
                ))}
                {more > 0 && <span className="text-xs text-muted">+{more} til</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
