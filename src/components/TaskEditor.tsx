"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addChecklistItem,
  deleteChecklistItem,
  deleteItemById,
  moveChecklistItem,
  moveItem,
  toggleChecklistItem,
  updateTask,
  type Result,
} from "@/app/actions/items";
import { PICK_CONTEXTS } from "@/lib/inbox";
import { TASK_STATUSES, type TaskStatus } from "@/lib/item-edit";
import type { PickContext, ProjectOption } from "@/lib/quick-add/parse";
import { ProjectSelect } from "./ProjectSelect";

export type TaskData = {
  id: string;
  title: string;
  status: TaskStatus | "waiting" | "cancelled";
  due_date: string | null;
  notes: string | null;
  is_pickable: boolean;
  pick_context: PickContext | null;
  /** Valgt prosjekt eller delprosjekt (id fra prosjektlisten) */
  placeId: string;
};
export type ChecklistRow = { id: string; text: string; is_done: boolean };

export function TaskEditor({ task, checklist, projects, backHref }: { task: TaskData; checklist: ChecklistRow[]; projects: ProjectOption[]; backHref: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [newPoint, setNewPoint] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function run(fn: () => Promise<Result>, after?: () => void) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setMsg({ ok: true, text: "Lagret" });
        after?.();
        router.refresh();
      } else setMsg({ ok: false, text: res.message });
    });
  }

  const done = checklist.filter((c) => c.is_done).length;

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div>
          <label className="label" htmlFor="t-title">Tittel</label>
          <input
            id="t-title"
            className="input text-lg font-medium"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() !== task.title && run(() => updateTask(task.id, { title }))}
          />
        </div>

        <div>
          <span className="label">Status</span>
          <div className="flex gap-1 rounded-lg bg-paper p-1">
            {TASK_STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                disabled={pending}
                onClick={() => s.value !== task.status && run(() => updateTask(task.id, { status: s.value }))}
                className={`flex-1 rounded-md py-1.5 text-sm ${task.status === s.value ? "bg-white font-semibold text-brand shadow-sm" : "text-muted"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label" htmlFor="t-due">Frist</label>
            <input
              key={task.due_date ?? "none"}
              id="t-due"
              type="date"
              className="input"
              defaultValue={task.due_date ?? ""}
              onChange={(e) => run(() => updateTask(task.id, { due_date: e.target.value || null }))}
            />
          </div>
          {task.due_date && (
            <button type="button" className="btn-ghost" onClick={() => run(() => updateTask(task.id, { due_date: null }))}>
              Fjern
            </button>
          )}
        </div>

        <div>
          <label className="label" htmlFor="t-proj">Prosjekt</label>
          <ProjectSelect id="t-proj" value={task.placeId} options={projects} disabled={pending} onChange={(v) => run(() => moveItem(task.id, "task", v))} />
        </div>

        <div>
          <span className="label">Plukkliste</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => task.is_pickable && run(() => updateTask(task.id, { is_pickable: false }))}
              className={`rounded-lg border px-3 py-1.5 text-sm ${!task.is_pickable ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line bg-white"}`}
            >
              Nei
            </button>
            {PICK_CONTEXTS.map((c) => (
              <button
                key={c.value}
                type="button"
                disabled={pending}
                onClick={() => run(() => updateTask(task.id, { is_pickable: true, pick_context: c.value }))}
                className={`rounded-lg border px-3 py-1.5 text-sm ${task.is_pickable && task.pick_context === c.value ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line bg-white"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="t-notes">Notater</label>
          <textarea
            id="t-notes"
            rows={3}
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (task.notes ?? "") && run(() => updateTask(task.id, { notes }))}
          />
        </div>

        <p className={`h-5 text-sm ${msg?.ok ? "text-brand" : "text-bad"}`}>{pending ? "Lagrer …" : msg?.text}</p>
      </div>

      <section className="card space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="h2">Sjekkliste</h2>
          {checklist.length > 0 && <span className="text-sm tabular-nums text-muted">{done} av {checklist.length}</span>}
        </div>
        <ul className="divide-y divide-line">
          {checklist.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2 py-1.5">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--color-brand)]"
                checked={c.is_done}
                onChange={(e) => run(() => toggleChecklistItem(c.id, e.target.checked))}
                aria-label={c.text}
              />
              <span className={`flex-1 text-sm break-words ${c.is_done ? "text-muted line-through" : ""}`}>{c.text}</span>
              <button type="button" aria-label="Flytt opp" disabled={i === 0 || pending} onClick={() => run(() => moveChecklistItem(task.id, c.id, -1))} className="px-1 text-muted disabled:opacity-30">↑</button>
              <button type="button" aria-label="Flytt ned" disabled={i === checklist.length - 1 || pending} onClick={() => run(() => moveChecklistItem(task.id, c.id, 1))} className="px-1 text-muted disabled:opacity-30">↓</button>
              <button type="button" aria-label="Slett punkt" disabled={pending} onClick={() => run(() => deleteChecklistItem(c.id))} className="px-1 text-muted hover:text-bad">×</button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newPoint.trim()) run(() => addChecklistItem(task.id, newPoint), () => setNewPoint(""));
          }}
        >
          <input className="input py-1.5 text-sm" placeholder="Nytt punkt, trykk Enter" value={newPoint} onChange={(e) => setNewPoint(e.target.value)} enterKeyHint="enter" />
        </form>
      </section>

      <div className="flex items-center gap-2">
        {!confirmDelete ? (
          <button type="button" className="text-sm text-bad" onClick={() => setConfirmDelete(true)}>Slett oppgaven</button>
        ) : (
          <>
            <span className="text-sm">Slette for godt?</span>
            <button
              type="button"
              className="rounded-lg bg-bad px-3 py-1.5 text-sm font-semibold text-white"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteItemById(task.id);
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
