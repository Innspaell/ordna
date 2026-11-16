import Link from "next/link";

export type StripDay = { date: string; wd: string; num: number; isToday: boolean; busy: boolean };

/** Ukestripe på I dag: trykk for å åpne ukevisningen. Prikk = noe på planen. */
export function WeekStrip({ days }: { days: StripDay[] }) {
  return (
    <Link href="/uke" className="grid grid-cols-7 gap-1 rounded-2xl border border-line bg-white px-2 py-2.5 hover:border-brand/40" aria-label="Åpne ukevisningen">
      {days.map((d) => (
        <div key={d.date} className="flex flex-col items-center gap-1">
          <span className="text-[11px] text-muted">{d.wd}</span>
          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[15px] ${d.isToday ? "bg-brand font-bold text-white" : "font-medium"}`}>{d.num}</span>
          <span className={`h-1.5 w-1.5 rounded-full ${d.busy ? "bg-[#1d5fbf]" : "bg-transparent"}`} />
        </div>
      ))}
    </Link>
  );
}
