"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTaskDone } from "@/app/actions/projects";
import { formatDate } from "@/lib/format";
import type { DayAppointment, DayItem, TodayView as View } from "@/lib/today";
import { APPOINTMENT_COLOR, NO_PROJECT_COLOR, projectColor, taskStatusKey } from "@/lib/ui";
import { Dot, StatusPill } from "./StatusPill";
import { PersonBadges } from "./PersonFilter";
import { RepeatIcon } from "./SeriesPanel";
import { completeTasks } from "@/app/actions/items";

const Badge = ({ i }: { i: DayItem }) => <PersonBadges tags={i.personTags} />;

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

  function completeAll(ids: string[]) {
    setError(null);
    setDoneIds((s) => new Set([...s, ...ids]));
    start(async () => {
      const res = await completeTasks(ids);
      if (!res.ok) {
        setError(res.message);
        setDoneIds(new Set());
      } else router.refresh();
    });
  }

  if (view.isEmpty) {
    return (
      <div className="card py-6 text-center">
        <p className="font-medium">Ingenting på planen i dag</p>
        <p className="mt-1 text-sm text-muted">Ingen avtaler, frister eller fokus. Plukk noe fra plukklisten, eller nyt dagen.</p>
      </div>
    );
  }

  const taskSection = (title: string, items: DayItem[], tone?: "bad") =>
    items.length > 0 && (
      <section className="card space-y-1 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={`h2 ${tone === "bad" ? "text-bad" : ""}`}>
            {title} <span className="text-sm font-normal text-muted">{title === "Fokus" ? `${items.length} av 3` : items.length}</span>
          </h2>
          {title === "Forfalt" && items.length > 1 && (
            <button type="button" className="text-sm font-semibold text-brand" disabled={pending} onClick={() => completeAll(items.map((i) => i.id))}>
              Fullfør alle
            </button>
          )}
        </div>
        <ul className="divide-y divide-line">
          {items.map((t) => {
            const done = doneIds.has(t.id);
            return (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <button
                  type="button"
                  aria-label={`Fullfør «${t.title}»`}
                  disabled={done || pending}
                  onClick={() => complete(t.id)}
                  className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 text-xs ${done ? "border-[#1f7a4d] bg-[#1f7a4d] text-white" : "border-[#c9d0d8] hover:border-brand"}`}
                >
                  {done ? "✓" : ""}
                </button>
                <div className="min-w-0 flex-1">
                  <Link href={`/oppgave/${t.id}`} className={`flex items-center gap-1.5 text-[15px] break-words hover:text-brand ${done ? "text-muted line-through" : ""}`}>
                    {t.title}
                    {t.repeats && <RepeatIcon className="text-muted" />}
                  </Link>
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Dot color={t.projectId ? projectColor(t.projectId) : NO_PROJECT_COLOR} />
                    {[t.person, t.project ?? "Uten prosjekt", t.due_date && t.due_date !== today ? `frist ${formatDate(t.due_date, today)}` : null].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <Badge i={t} />
                <StatusPill status={done ? "done" : taskStatusKey(t.status, t.due_date, today)} />
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
        <section className="card space-y-1 py-3">
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
    <li className={`flex items-stretch gap-3 py-2 ${a.past || a.status === "cancelled" ? "opacity-50" : ""}`}>
      <span className="w-1 shrink-0 rounded-full" style={{ background: APPOINTMENT_COLOR }} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold tabular-nums" style={{ color: APPOINTMENT_COLOR }}>{when}</div>
        <Link href={`/avtale/${a.id}`} className={`flex items-center gap-1.5 text-[15px] break-words hover:text-brand ${a.status === "cancelled" ? "line-through" : ""}`}>
          {a.title}
          {a.repeats && <RepeatIcon className="text-muted" />}
          {a.status === "cancelled" && <span className="text-xs font-semibold text-bad no-underline">Avlyst</span>}
        </Link>
        {(a.project || a.person) && <div className="text-xs text-muted">{[a.person, a.project].filter(Boolean).join(" · ")}</div>}
      </div>
      <span className="self-center"><Badge i={a} /></span>
    </li>
  );
}
