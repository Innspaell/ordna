"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearFocus, pickForToday, type FocusResult } from "@/app/actions/focus";
import { setTaskDone } from "@/app/actions/projects";
import { PICK_CONTEXTS } from "@/lib/inbox";
import { FOCUS_LIMIT } from "@/lib/focus";
import { formatDate } from "@/lib/format";
import type { PickContext } from "@/lib/quick-add/parse";

export type PickRow = { id: string; title: string; project: string | null; context: PickContext | null; due_date: string | null };

const CONTEXT_LABEL = Object.fromEntries(PICK_CONTEXTS.map((c) => [c.value, c.label])) as Record<PickContext, string>;

export function PickList({ focus, items, filter, today }: { focus: PickRow[]; items: PickRow[]; filter: PickContext | null; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ text: string; full?: boolean } | null>(null);
  const focusIds = new Set(focus.map((f) => f.id));

  function run(fn: () => Promise<FocusResult | { ok: true } | { ok: false; message: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError({ text: res.message, full: "full" in res ? res.full : undefined });
    });
  }

  const meta = (r: PickRow, showContext: boolean) =>
    [showContext && r.context ? CONTEXT_LABEL[r.context] : null, r.project, r.due_date ? `frist ${formatDate(r.due_date, today)}` : null].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5">
      <section className={`card space-y-2 ${error?.full ? "ring-2 ring-bad/40" : ""}`}>
        <div className="flex items-baseline justify-between">
          <h2 className="h2">Fokus i dag</h2>
          <span className="text-sm tabular-nums text-muted">
            {focus.length} av {FOCUS_LIMIT}
          </span>
        </div>
        {!focus.length ? (
          <p className="text-sm text-muted">Ingenting valgt. Trykk «Plukk» på en oppgave under.</p>
        ) : (
          <ul className="divide-y divide-line">
            {focus.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <button
                  type="button"
                  aria-label={`Fullfør «${r.title}»`}
                  disabled={pending}
                  onClick={() => run(() => setTaskDone(r.id, true))}
                  className="h-5 w-5 shrink-0 rounded-full border-2 border-line hover:border-brand"
                />
                <div className="min-w-0 flex-1">
                  <Link href={`/oppgave/${r.id}`} className="block text-sm break-words hover:text-brand">{r.title}</Link>
                  <div className="text-xs text-muted">{meta(r, true)}</div>
                </div>
                <button type="button" disabled={pending} onClick={() => run(() => clearFocus(r.id))} className="text-sm text-muted hover:text-bad">
                  Fjern
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="text-sm text-bad">{error.text}</p>}

      <section className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <FilterChip href="/plukk" active={!filter} label="Alle" />
          {PICK_CONTEXTS.map((c) => (
            <FilterChip key={c.value} href={`/plukk?sted=${c.value}`} active={filter === c.value} label={c.label} />
          ))}
        </div>

        {!items.length ? (
          <p className="card text-sm text-muted">
            {filter ? `Ingenting på plukklisten for ${CONTEXT_LABEL[filter].toLowerCase()}.` : "Plukklisten er tom. Skriv for eksempel «Skift lyspære @hjemme»."}
          </p>
        ) : (
          <ul className="card divide-y divide-line py-1">
            {items.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <Link href={`/oppgave/${r.id}`} className="block text-sm break-words hover:text-brand">{r.title}</Link>
                  <div className="text-xs text-muted">{meta(r, !filter)}</div>
                </div>
                {focusIds.has(r.id) ? (
                  <span className="text-xs font-semibold text-brand">I fokus</span>
                ) : (
                  <button type="button" disabled={pending} onClick={() => run(() => pickForToday(r.id))} className="btn-ghost py-1">
                    Plukk
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link href={href} className={`rounded-full border px-3 py-1 text-sm ${active ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line bg-white text-muted"}`}>
      {label}
    </Link>
  );
}
