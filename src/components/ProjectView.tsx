"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSubproject, addToGroup, setTaskDone, type Result } from "@/app/actions/projects";
import type { Count, Group, ProjectTree, TreeItem } from "@/lib/project-tree";
import { formatAppointment, formatDate } from "@/lib/format";

type Ctx = { projectId: string; today: string; run: (fn: () => Promise<Result<unknown>>) => Promise<boolean>; pending: boolean };

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
    <div className="space-y-3">
      {error && <p className="text-sm text-bad">{error}</p>}

      {!tree.hasSubprojects && (
        <section className="card space-y-2">
          <ItemList items={tree.rootItems} ctx={ctx} />
          <AddItem parentId={null} ctx={ctx} />
        </section>
      )}

      {tree.groups.map((g) => (
        <GroupCard key={g.id} group={g} ctx={ctx} />
      ))}

      {tree.other && (
        <section className="card space-y-2">
          <GroupHeader title="Øvrig" count={tree.other.count} empty={false} />
          <ItemList items={tree.other.items} ctx={ctx} />
          <AddItem parentId={null} ctx={ctx} />
        </section>
      )}

      <AddSubproject parentId={null} ctx={ctx} label="+ Delprosjekt" />
    </div>
  );
}

function GroupHeader({ title, count, empty }: { title: string; count: Count; empty: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="h2 break-words">{title}</h2>
      <span className="shrink-0 text-sm tabular-nums text-muted">{empty ? "tomt" : count.total ? `${count.done} av ${count.total}` : "–"}</span>
    </div>
  );
}

function GroupCard({ group, ctx }: { group: Group; ctx: Ctx }) {
  return (
    <section className="card space-y-2">
      <GroupHeader title={group.title} count={group.count} empty={group.empty} />
      <ItemList items={group.items} ctx={ctx} />
      {group.children.map((c) => (
        <SubGroup key={c.id} group={c} ctx={ctx} />
      ))}
      <div className="flex flex-wrap gap-x-4">
        <AddItem parentId={group.id} ctx={ctx} />
        <AddSubproject parentId={group.id} ctx={ctx} label="+ Underdelprosjekt" />
      </div>
    </section>
  );
}

/** Innrykket undergruppe. Nivå 1 vises åpent; dypere nivåer åpnes ved trykk. */
function SubGroup({ group, ctx }: { group: Group; ctx: Ctx }) {
  const [open, setOpen] = useState(group.depth <= 1);
  return (
    <div className="ml-3 space-y-2 border-l-2 border-line pl-3">
      <button type="button" className="flex w-full items-baseline justify-between gap-3 text-left" onClick={() => setOpen((o) => !o)}>
        <span className="text-sm font-semibold">
          <span className="mr-1 inline-block w-3 text-muted">{open ? "▾" : "▸"}</span>
          {group.title}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted">
          {group.empty ? "tomt" : group.count.total ? `${group.count.done} av ${group.count.total}` : "–"}
        </span>
      </button>
      {open && (
        <>
          <ItemList items={group.items} ctx={ctx} />
          {group.children.map((c) => (
            <SubGroup key={c.id} group={c} ctx={ctx} />
          ))}
          <div className="flex flex-wrap gap-x-4">
            <AddItem parentId={group.id} ctx={ctx} />
            <AddSubproject parentId={group.id} ctx={ctx} label="+ Underdelprosjekt" />
          </div>
        </>
      )}
    </div>
  );
}

function ItemList({ items, ctx }: { items: TreeItem[]; ctx: Ctx }) {
  if (!items.length) return null;
  return (
    <ul className="divide-y divide-line">
      {items.map((i) => (
        <ItemRow key={i.id} item={i} ctx={ctx} />
      ))}
    </ul>
  );
}

function ItemRow({ item, ctx }: { item: TreeItem; ctx: Ctx }) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const done = optimistic ?? item.status === "done";
  const overdue = item.kind === "task" && !done && item.due_date && item.due_date < ctx.today;

  if (item.kind === "appointment") {
    return (
      <li className="flex items-start gap-3 py-2">
        <span className="mt-0.5 text-xs font-semibold uppercase text-sky-700">Avtale</span>
        <div className="min-w-0 flex-1">
          <Link href={`/avtale/${item.id}`} className="block text-sm break-words hover:text-brand">{item.title}</Link>
          {item.starts_at && <div className="text-xs text-muted">{formatAppointment(item.starts_at, item.ends_at)}</div>}
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 py-2">
      <button
        type="button"
        aria-label={done ? `Angre fullført «${item.title}»` : `Fullfør «${item.title}»`}
        onClick={async () => {
          setOptimistic(!done);
          const ok = await ctx.run(() => setTaskDone(item.id, !done));
          if (!ok) setOptimistic(null);
        }}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs ${done ? "border-brand bg-brand text-white" : "border-line hover:border-brand"}`}
      >
        {done ? "✓" : ""}
      </button>
      <div className="min-w-0 flex-1">
        <Link href={`/oppgave/${item.id}`} className={`block text-sm break-words hover:text-brand ${done ? "text-muted line-through" : ""}`}>
          {item.title}
        </Link>
        {item.due_date && (
          <div className={`text-xs ${overdue ? "font-semibold text-bad" : "text-muted"}`}>
            {overdue ? "Forfalt · " : "Frist "}
            {formatDate(item.due_date, ctx.today)}
          </div>
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
      <button type="button" className="py-1 text-sm text-brand" onClick={() => setOpen(true)}>
        + Legg til
      </button>
    );
  }
  return (
    <form
      className="flex w-full gap-2"
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
      <button type="button" className="py-1 text-sm text-muted hover:text-brand" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }
  return (
    <form
      className="flex w-full gap-2"
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
