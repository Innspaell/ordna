"use client";

import { useMemo, useState, useTransition } from "react";
import { createProjectFromInbox, deleteItem, processInboxItem, type ActionResult } from "@/app/actions/inbox";
import { PICK_CONTEXTS } from "@/lib/inbox";
import { matchProjects, osloToday, type ProjectOption } from "@/lib/quick-add/parse";

export type InboxItem = { id: string; title: string; createdAt: string; kind: "task" | "appointment" };

type Panel = "project" | "pick" | "due" | "delete" | null;

const created = new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function InboxList({ items, projects }: { items: InboxItem[]; projects: ProjectOption[] }) {
  if (!items.length) {
    return (
      <div className="card text-center">
        <p className="font-medium">Innboksen er tom</p>
        <p className="mt-1 text-sm text-muted">Alt du registrerer uten prosjekt, sted eller frist havner her.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <InboxRow key={i.id} item={i} projects={projects} />
      ))}
    </ul>
  );
}

function InboxRow({ item, projects }: { item: InboxItem; projects: ProjectOption[] }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);

  const hits = useMemo(() => (query.trim() ? matchProjects(query, projects) : projects).slice(0, 8), [query, projects]);
  const today = osloToday();

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) setGone(true);
      else setError(res.message);
    });
  }
  const toggle = (p: Panel) => {
    setPanel((cur) => (cur === p ? null : p));
    setError(null);
  };

  if (gone) return null;

  const tab = (p: Panel, label: string) => (
    <button
      type="button"
      onClick={() => toggle(p)}
      className={`rounded-md px-2.5 py-1 text-sm ${panel === p ? "bg-brand-soft font-semibold text-brand" : "text-muted hover:bg-paper"}`}
    >
      {label}
    </button>
  );

  return (
    <li className={`card space-y-2 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        {item.kind === "task" && (
          <button
            type="button"
            aria-label={`Fullfør «${item.title}»`}
            onClick={() => run(() => processInboxItem(item.id, { type: "done" }))}
            className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-line hover:border-brand"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium break-words">{item.title}</div>
          <div className="text-xs text-muted">{created.format(new Date(item.createdAt))}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {tab("project", "Prosjekt")}
        {item.kind === "task" && tab("pick", "Plukkliste")}
        {item.kind === "task" && tab("due", "Frist")}
        {tab("delete", "Slett")}
      </div>

      {panel === "project" && (
        <div className="space-y-2">
          <input
            autoFocus
            className="input"
            placeholder="Søk eller skriv navn på nytt prosjekt"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            {hits.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={pending}
                onClick={() => run(() => processInboxItem(item.id, { type: "project", optionId: p.id }))}
                className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-paper"
              >
                {p.kind === "subproject" && p.projectName ? (
                  <>
                    <span className="text-muted">{p.projectName} › </span>
                    {p.name}
                  </>
                ) : (
                  p.name
                )}
              </button>
            ))}
            {!projects.length && !query.trim() && <p className="px-2 text-sm text-muted">Ingen prosjekter ennå. Skriv et navn for å lage ett.</p>}
            {query.trim() && !projects.some((p) => p.name.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => createProjectFromInbox(item.id, query))}
                className="rounded-md px-2 py-1.5 text-left text-sm font-medium text-brand hover:bg-brand-soft"
              >
                + Nytt prosjekt «{query.trim()}»
              </button>
            )}
          </div>
        </div>
      )}

      {panel === "pick" && (
        <div className="flex flex-wrap gap-2">
          {PICK_CONTEXTS.map((c) => (
            <button
              key={c.value}
              type="button"
              disabled={pending}
              onClick={() => run(() => processInboxItem(item.id, { type: "pick", context: c.value }))}
              className="btn-ghost py-1.5"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {panel === "due" && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost py-1.5" disabled={pending} onClick={() => run(() => processInboxItem(item.id, { type: "due", date: today }))}>
            I dag
          </button>
          <button type="button" className="btn-ghost py-1.5" disabled={pending} onClick={() => run(() => processInboxItem(item.id, { type: "due", date: addDays(today, 1) }))}>
            I morgen
          </button>
          <input type="date" className="input w-auto py-1.5" value={date} min={today} onChange={(e) => setDate(e.target.value)} aria-label="Velg dato" />
          <button type="button" className="btn-primary py-1.5" disabled={!date || pending} onClick={() => run(() => processInboxItem(item.id, { type: "due", date }))}>
            Sett frist
          </button>
        </div>
      )}

      {panel === "delete" && (
        <div className="flex items-center gap-2">
          <span className="text-sm">Slette for godt?</span>
          <button type="button" className="rounded-lg bg-bad px-3 py-1.5 text-sm font-semibold text-white" disabled={pending} onClick={() => run(() => deleteItem(item.id))}>
            Slett
          </button>
          <button type="button" className="text-sm text-muted" onClick={() => setPanel(null)}>
            Avbryt
          </button>
        </div>
      )}

      {error && <p className="text-sm text-bad">{error}</p>}
    </li>
  );
}
