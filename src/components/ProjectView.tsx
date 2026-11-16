"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSubproject, addToGroup, setTaskDone, type Result } from "@/app/actions/projects";
import type { Count, Group, ProjectTree, TreeItem } from "@/lib/project-tree";
import { formatAppointment, formatDate } from "@/lib/format";
import { APPOINTMENT_COLOR, NO_PROJECT_COLOR, projectColor, STATUS, taskStatusKey } from "@/lib/ui";

type Ctx = { projectId: string; today: string; run: (fn: () => Promise<Result<unknown>>) => Promise<boolean>; pending: boolean };

const COLS = "md:grid md:grid-cols-[minmax(0,1fr)_150px_150px_130px] md:gap-1";

export function ProjectView({ projectId, tree, today }: { projectId: string; tree: ProjectTree; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run: Ctx["run"] = (fn) =>
    new Promise((resolve) => {
      setError(null);
      start(async () => {
        const res = await fn();
        if (!res.ok) setError(res.message);
        else router.refresh();
        resolve(res.ok);
      });
    });
  const ctx: Ctx = { projectId, today, run, pending };

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-bad">{error}</p>}

      {!tree.hasSubprojects && (
        <GroupSection title="Oppgaver og avtaler" color={projectColor(projectId)} count={tree.count} empty={false} ctx={ctx} parentId={null} items={tree.rootItems} />
      )}

      {tree.groups.map((g) => (
        <GroupSection key={g.id} title={g.title} color={projectColor(g.id)} count={g.count} empty={g.empty} ctx={ctx} parentId={g.id} items={g.items} subgroups={g.children} />
      ))}

      {tree.other && <GroupSection title="Øvrig" color={NO_PROJECT_COLOR} count={tree.other.count} empty={false} ctx={ctx} parentId={null} items={tree.other.items} noSub />}

      <AddSubproject parentId={null} ctx={ctx} label="+ Delprosjekt" />
    </div>
  );
}

function GroupSection({
  title,
  color,
  count,
  empty,
  ctx,
  parentId,
  items,
  subgroups = [],
  noSub,
}: {
  title: string;
  color: string;
  count: Count;
  empty: boolean;
  ctx: Ctx;
  parentId: string | null;
  items: TreeItem[];
  subgroups?: Group[];
  noSub?: boolean;
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 md:hidden">
        <h2 className="text-base font-semibold break-words" style={{ color }}>{title}</h2>
        <span className="shrink-0 text-sm tabular-nums text-muted">{empty ? "tomt" : count.total ? `${count.done} av ${count.total}` : "–"}</span>
      </div>
      <div className={`hidden items-end ${COLS}`}>
        <h2 className="text-xl font-semibold break-words" style={{ color }}>
          {title} <span className="text-sm font-normal text-muted">{empty ? "tomt" : count.total ? `${count.done} av ${count.total}` : ""}</span>
        </h2>
        <span className="text-center text-xs text-muted">Status</span>
        <span className="text-center text-xs text-muted">Frist</span>
        <span className="text-center text-xs text-muted">Sjekkliste</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-line border-l-[5px] bg-white md:space-y-1 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent" style={{ borderLeftColor: color }}>
        <ul className="divide-y divide-[#f0f2f5] md:divide-y-0 md:space-y-1">
          {items.map((i) => (
            <ItemRow key={i.id} item={i} ctx={ctx} color={color} />
          ))}
        </ul>
        {subgroups.map((sg) => (
          <SubGroup key={sg.id} group={sg} ctx={ctx} />
        ))}
        <div className="flex flex-wrap gap-x-4 px-3.5 py-1 md:border-l-[5px] md:bg-white md:px-4" style={{ borderColor: `${color}55` }}>
          <AddItem parentId={parentId} ctx={ctx} />
          {!noSub && parentId && <AddSubproject parentId={parentId} ctx={ctx} label="+ Underdelprosjekt" />}
        </div>
      </div>
    </section>
  );
}

/** Innrykket undergruppe. Nivå 1 vises åpent; dypere nivåer åpnes ved trykk. */
function SubGroup({ group, ctx }: { group: Group; ctx: Ctx }) {
  const [open, setOpen] = useState(group.depth <= 1);
  const color = projectColor(group.id);
  return (
    <div className="ml-3 border-l-2 pl-3 md:ml-6 md:border-l-0 md:pl-0" style={{ borderColor: color }}>
      <button type="button" className="flex w-full items-baseline justify-between gap-3 px-3.5 py-2 text-left md:px-0" onClick={() => setOpen((o) => !o)}>
        <span className="text-sm font-semibold" style={{ color }}>
          <span className="mr-1 inline-block w-3 text-muted">{open ? "▾" : "▸"}</span>
          {group.title}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted">
          {group.empty ? "tomt" : group.count.total ? `${group.count.done} av ${group.count.total}` : "–"}
        </span>
      </button>
      {open && (
        <div className="md:space-y-1">
          <ul className="divide-y divide-[#f0f2f5] md:divide-y-0 md:space-y-1">
            {group.items.map((i) => (
              <ItemRow key={i.id} item={i} ctx={ctx} color={color} />
            ))}
          </ul>
          {group.children.map((c) => (
            <SubGroup key={c.id} group={c} ctx={ctx} />
          ))}
          <div className="flex flex-wrap gap-x-4 px-3.5 py-1 md:border-l-[5px] md:bg-white md:px-4" style={{ borderColor: `${color}55` }}>
            <AddItem parentId={group.id} ctx={ctx} />
            <AddSubproject parentId={group.id} ctx={ctx} label="+ Underdelprosjekt" />
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, ctx, color }: { item: TreeItem; ctx: Ctx; color: string }) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  if (item.kind === "appointment") {
    const when = item.starts_at ? formatAppointment(item.starts_at, item.ends_at) : "";
    return (
      <li className={`flex items-center gap-3 px-3.5 py-2.5 ${COLS} md:h-11 md:items-stretch md:px-0 md:py-0`}>
        <div className="flex min-w-0 flex-1 items-center gap-3 md:border-l-[5px] md:bg-white md:px-4" style={{ borderColor: color }}>
          <span className="h-8 w-1 shrink-0 rounded-full md:h-5" style={{ background: APPOINTMENT_COLOR }} />
          <div className="min-w-0">
            <Link href={`/avtale/${item.id}`} className="block text-[15px] break-words hover:text-brand md:truncate">{item.title}</Link>
            <div className="text-xs md:hidden" style={{ color: APPOINTMENT_COLOR }}>{when}</div>
          </div>
        </div>
        <div className="shrink-0 md:flex">
          <span className="rounded-md px-2 py-1 text-xs font-semibold text-white md:hidden" style={{ background: APPOINTMENT_COLOR }}>Avtale</span>
          <span className="hidden h-full w-full items-center justify-center md:flex" style={{ background: APPOINTMENT_COLOR }}>Avtale</span>
        </div>
        <div className="hidden items-center justify-center bg-white text-sm md:flex">{when}</div>
        <div className="hidden bg-white md:block" />
      </li>
    );
  }

  const done = optimistic ?? item.status === "done";
  const status = done ? "done" : taskStatusKey(item.status, item.due_date, ctx.today);
  const s = STATUS[status];
  const cl = item.checklist;
  const meta = [
    item.due_date && !done ? `${status === "overdue" ? "Forfalt" : "Frist"} ${formatDate(item.due_date, ctx.today)}` : null,
    cl && cl.total ? `Sjekkliste ${cl.done} av ${cl.total}` : null,
  ].filter(Boolean);

  return (
    <li className={`flex items-center gap-3 px-3.5 py-2.5 ${COLS} md:h-11 md:items-stretch md:px-0 md:py-0`}>
      <div className="flex min-w-0 flex-1 items-center gap-3 md:border-l-[5px] md:bg-white md:px-4" style={{ borderColor: color }}>
        <button
          type="button"
          aria-label={done ? `Angre fullført «${item.title}»` : `Fullfør «${item.title}»`}
          onClick={async () => {
            setOptimistic(!done);
            const ok = await ctx.run(() => setTaskDone(item.id, !done));
            if (!ok) setOptimistic(null);
          }}
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 text-xs ${done ? "border-[#1f7a4d] bg-[#1f7a4d] text-white" : "border-[#c9d0d8] hover:border-brand"}`}
        >
          {done ? "✓" : ""}
        </button>
        <div className="min-w-0 flex-1">
          <Link href={`/oppgave/${item.id}`} className={`block text-[15px] break-words hover:text-brand md:truncate ${done ? "text-muted line-through" : ""}`}>
            {item.title}
          </Link>
          {meta.length > 0 && <div className={`text-xs md:hidden ${status === "overdue" ? "font-semibold text-bad" : "text-muted"}`}>{meta.join(" · ")}</div>}
        </div>
      </div>
      <div className="shrink-0 md:flex">
        <span className="rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap text-white md:hidden" style={{ background: s.bg }}>{s.label}</span>
        <span className="hidden w-full items-center justify-center text-sm font-semibold text-white md:flex" style={{ background: s.bg }}>{s.label}</span>
      </div>
      <div className={`hidden items-center justify-center bg-white text-sm md:flex ${status === "overdue" ? "font-semibold text-bad" : ""}`}>
        {item.due_date ? formatDate(item.due_date, ctx.today) : ""}
      </div>
      <div className="hidden items-center gap-2 bg-white px-3.5 text-xs text-muted md:flex">
        {cl && cl.total > 0 && (
          <>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e9edf1]">
              <div className="h-full bg-brand" style={{ width: `${(cl.done / cl.total) * 100}%` }} />
            </div>
            <span className="tabular-nums">{cl.done}/{cl.total}</span>
          </>
        )}
      </div>
    </li>
  );
}

function AddItem({ parentId, ctx }: { parentId: string | null; ctx: Ctx }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open) {
    return (
      <button type="button" className="py-2 text-sm text-brand" onClick={() => setOpen(true)}>
        + Legg til
      </button>
    );
  }
  return (
    <form
      className="flex w-full gap-2 py-1.5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        const ok = await ctx.run(() => addToGroup(ctx.projectId, parentId, text));
        if (ok) setText("");
      }}
    >
      <input
        autoFocus
        className="input py-1.5 text-sm"
        placeholder="Oppgave, eller avtale med tid: «Møte fre kl 10»"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => !text && setOpen(false)}
      />
      <button className="btn-primary py-1.5" disabled={!text.trim() || ctx.pending}>Legg til</button>
    </form>
  );
}

function AddSubproject({ parentId, ctx, label }: { parentId: string | null; ctx: Ctx; label: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  if (!open) {
    return (
      <button type="button" className="py-2 text-sm text-muted hover:text-brand" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }
  return (
    <form
      className="flex w-full gap-2 py-1.5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const ok = await ctx.run(() => addSubproject(ctx.projectId, parentId, name));
        if (ok) {
          setName("");
          setOpen(false);
        }
      }}
    >
      <input autoFocus className="input py-1.5 text-sm" placeholder="Navn på delprosjekt" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => !name && setOpen(false)} />
      <button className="btn-primary py-1.5" disabled={!name.trim() || ctx.pending}>Lag</button>
    </form>
  );
}
