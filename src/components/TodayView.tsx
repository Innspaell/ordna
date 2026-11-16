"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTaskDone } from "@/app/actions/projects";
import { formatDate } from "@/lib/format";
import type { DayAppointment, DayItem, TodayView as View } from "@/lib/today";

const time = new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit" });

export function TodayView({ view, today }: { view: View; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function complete(id: string) {
    setError(null);
    setDoneIds((s) => new Set(s).add(id));
    start(async () => {
      const res = await setTaskDone(id, true);
      if (!res.ok) {
        setError(res.message);
        setDoneIds((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      } else router.refresh();
    });
  }

  if (view.isEmpty) {
    return (
      <div className="card text-center">
        <p className="font-medium">Ingenting på planen i dag</p>
        <p className="mt-1 text-sm text-muted">Ingen avtaler, frister eller fokus. Plukk noe fra plukklisten, eller nyt dagen.</p>
      </div>
    );
  }

  const taskSection = (title: string, items: DayItem[], tone?: "bad") =>
    items.length > 0 && (
      <section className="card space-y-1">
        <h2 className={`h2 ${tone === "bad" ? "text-bad" : ""}`}>
          {title} <span className="text-sm font-normal text-muted">{items.length}</span>
        </h2>
        <ul className="divide-y divide-line">
          {items.map((t) => {
            const done = doneIds.has(t.id);
            return (
              <li key={t.id} className="flex items-start gap-3 py-2">
                <button
                  type="button"
                  aria-label={`Fullfør «${t.title}»`}
                  disabled={done || pending}
                  onClick={() => complete(t.id)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs ${done ? "border-brand bg-brand text-white" : "border-line hover:border-brand"}`}
                >
                  {done ? "✓" : ""}
                </button>
                <div className="min-w-0 flex-1">
                  <Link href={`/oppgave/${t.id}`} className={`block text-sm break-words hover:text-brand ${done ? "text-muted line-through" : ""}`}>
                    {t.title}
                  </Link>
                  <div className="text-xs text-muted">
                    {[t.project, t.due_date && t.due_date !== today ? `frist ${formatDate(t.due_date, today)}` : null].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    );

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-bad">{error}</p>}
      {view.appointments.length > 0 && (
        <section className="card space-y-1">
          <h2 className="h2">Avtaler i dag</h2>
          <ul className="divide-y divide-line">
            {view.appointments.map((a) => (
              <AppointmentRow key={a.id} a={a} />
            ))}
          </ul>
        </section>
      )}
      {taskSection("Forfalt", view.overdue, "bad")}
      {taskSection("Frist i dag", view.dueToday)}
      {taskSection("Fokus", view.focus)}
    </div>
  );
}

function AppointmentRow({ a }: { a: DayAppointment }) {
  const when = a.all_day ? "Hele dagen" : a.starts_at ? `${time.format(new Date(a.starts_at))}${a.ends_at ? `–${time.format(new Date(a.ends_at))}` : ""}` : "";
  return (
    <li className={`flex items-start gap-3 py-2 ${a.past ? "opacity-50" : ""}`}>
      <span className="w-24 shrink-0 text-sm tabular-nums text-sky-800">{when}</span>
      <div className="min-w-0 flex-1">
        <Link href={`/avtale/${a.id}`} className="block text-sm break-words hover:text-brand">
          {a.title}
        </Link>
        {a.project && <div className="text-xs text-muted">{a.project}</div>}
      </div>
    </li>
  );
}
