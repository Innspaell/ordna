"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteItemById, moveItem, updateAppointment } from "@/app/actions/items";
import type { ProjectOption } from "@/lib/quick-add/parse";
import { ProjectSelect } from "./ProjectSelect";

export type AppointmentData = {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  all_day: boolean;
  location: string;
  notes: string;
  placeId: string;
};

export function AppointmentEditor({ appt, projects, backHref }: { appt: AppointmentData; projects: ProjectOption[]; backHref: string }) {
  const router = useRouter();
  const [form, setForm] = useState(appt);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof AppointmentData>(k: K, v: AppointmentData[K]) => setForm((f) => ({ ...f, [k]: v }));

  const dirty = (["title", "date", "start", "end", "all_day", "location", "notes"] as const).some((k) => form[k] !== appt[k]);
  const endBeforeStart = !form.all_day && form.end !== "" && form.start !== "" && form.end <= form.start;

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await updateAppointment(appt.id, {
        title: form.title,
        date: form.date,
        start: form.start,
        end: form.end,
        all_day: form.all_day,
        location: form.location,
        notes: form.notes,
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Lagret" });
        router.refresh();
      } else setMsg({ ok: false, text: res.message });
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="card space-y-4">
        <div>
          <label className="label" htmlFor="a-title">Tittel</label>
          <input id="a-title" required className="input text-lg font-medium" value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="label" htmlFor="a-date">Dato</label>
            <input id="a-date" type="date" required className="input" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <label className="flex items-end gap-2 pb-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-[var(--color-brand)]" checked={form.all_day} onChange={(e) => set("all_day", e.target.checked)} />
            Hele dagen
          </label>
        </div>

        {!form.all_day && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label" htmlFor="a-start">Start</label>
              <input id="a-start" type="time" required className="input" value={form.start} onChange={(e) => set("start", e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="label" htmlFor="a-end">Slutt</label>
              <input id="a-end" type="time" className={`input ${endBeforeStart ? "border-bad" : ""}`} value={form.end} onChange={(e) => set("end", e.target.value)} />
            </div>
          </div>
        )}
        {endBeforeStart && <p className="text-sm text-bad">Slutt må være etter start.</p>}

        <div>
          <label className="label" htmlFor="a-loc">Sted</label>
          <input id="a-loc" className="input" placeholder="Valgfritt" value={form.location} onChange={(e) => set("location", e.target.value)} />
        </div>

        <div>
          <label className="label" htmlFor="a-notes">Notater</label>
          <textarea id="a-notes" rows={3} className="input" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={!dirty || pending || endBeforeStart || !form.title.trim()}>
            {pending ? "Lagrer …" : "Lagre"}
          </button>
          {msg && <span className={`text-sm ${msg.ok ? "text-brand" : "text-bad"}`}>{msg.text}</span>}
        </div>
      </form>

      <div className="card">
        <label className="label" htmlFor="a-proj">Prosjekt</label>
        <ProjectSelect
          id="a-proj"
          value={appt.placeId}
          options={projects}
          disabled={pending}
          onChange={(v) =>
            start(async () => {
              const res = await moveItem(appt.id, "appointment", v);
              setMsg(res.ok ? { ok: true, text: "Flyttet" } : { ok: false, text: res.message });
              if (res.ok) router.refresh();
            })
          }
        />
      </div>

      <div className="flex items-center gap-2">
        {!confirmDelete ? (
          <button type="button" className="text-sm text-bad" onClick={() => setConfirmDelete(true)}>Slett avtalen</button>
        ) : (
          <>
            <span className="text-sm">Slette for godt?</span>
            <button
              type="button"
              className="rounded-lg bg-bad px-3 py-1.5 text-sm font-semibold text-white"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteItemById(appt.id);
                  if (res.ok) router.push(backHref);
                  else setMsg({ ok: false, text: res.message });
                })
              }
            >
              Slett
            </button>
            <button type="button" className="text-sm text-muted" onClick={() => setConfirmDelete(false)}>Avbryt</button>
          </>
        )}
      </div>
    </div>
  );
}
