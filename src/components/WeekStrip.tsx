import Link from "next/link";
import { calendarHref } from "@/lib/calendar";

export type StripDay = { date: string; wd: string; num: number; isToday: boolean; busy: boolean };

/** Ukestripe på I dag: trykk på en dag for dagvisningen, eller «Uke» for hele uka. Prikk = noe på planen. */
export function WeekStrip({ days }: { days: StripDay[] }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-2 pt-1.5 pb-2.5">
      <div className="flex justify-end px-1">
        <Link href={calendarHref("week", days[0].date)} className="text-xs font-semibold text-brand">Hele uka ›</Link>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => (
          <Link key={d.date} href={calendarHref("day", d.date)} className="flex flex-col items-center gap-1 rounded-lg py-0.5 hover:bg-paper" aria-label={`Vis dagen ${d.num}.`}>
            <span className="text-[11px] text-muted">{d.wd}</span>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[15px] ${d.isToday ? "bg-brand font-bold text-white" : "font-medium"}`}>{d.num}</span>
            <span className={`h-1.5 w-1.5 rounded-full ${d.busy ? "bg-[#1d5fbf]" : "bg-transparent"}`} />
          </Link>
        ))}
      </div>
    </div>
  );
}
