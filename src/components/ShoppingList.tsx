"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { addToList, clearDone, putBack, undoClear } from "@/app/actions/list";
import { setTaskDone } from "@/app/actions/projects";

export type ListRow = { id: string; title: string; done: boolean; by: string | null };
export type RecentRow = { id: string; title: string };

export function ShoppingList({ projectId, rows, recent }: { projectId: string; rows: ListRow[]; recent: RecentRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flip, setFlip] = useState<Record<string, boolean>>({});
  const input = useRef<HTMLInputElement>(null);
  // Angre etter rydding: vises i noen sekunder
  const [undo, setUndo] = useState<string[] | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showUndo = (ids: string[]) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(ids);
    undoTimer.current = setTimeout(() => setUndo(null), 10000);
  };

  // Ny tilstand fra serveren (egen eller andres endring) erstatter det vi viste midlertidig
  useEffect(() => setFlip({}), [rows]);

  // Fortløpende: andres endringer på listen kommer inn med en gang, og listen lastes på nytt når appen åpnes igjen.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };
    const supabase = createClient();
    const channel = supabase
      .channel(`handleliste-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: `project_id=eq.${projectId}` }, refresh)
      .subscribe();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
      supabase.removeChannel(channel);
    };
  }, [projectId, router]);

  const isDone = (r: ListRow) => flip[r.id] ?? r.done;
  const open = rows.filter((r) => !isDone(r));
  const done = rows.filter((r) => isDone(r));

  const toggle = (r: ListRow) => {
    const next = !isDone(r);
    setFlip((f) => ({ ...f, [r.id]: next }));
    start(async () => {
      const res = await setTaskDone(r.id, next);
      if (!res.ok) {
        setFlip((f) => ({ ...f, [r.id]: !next }));
        setError(res.message);
      } else router.refresh();
    });
  };

  const row = (r: ListRow) => (
    <li key={r.id}>
      <button type="button" onClick={() => toggle(r)} className="flex w-full items-center gap-3 py-3 text-left">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm ${isDone(r) ? "border-[#1f7a4d] bg-[#1f7a4d] text-white" : "border-[#c9d0d8]"}`}>
          {isDone(r) ? "✓" : ""}
        </span>
        <span className={`flex-1 text-[16px] break-words ${isDone(r) ? "text-muted line-through" : ""}`}>{r.title}</span>
        {r.by && <span className="text-xs text-muted">{r.by}</span>}
      </button>
    </li>
  );

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setError(null);
          start(async () => {
            const res = await addToList(projectId, text);
            if (res.ok) {
              setText("");
              router.refresh();
              input.current?.focus();
            } else setError(res.message);
          });
        }}
      >
        <input
          ref={input}
          className="input text-base"
          placeholder="Melk, brød, egg …"
          value={text}
          onChange={(e) => setText(e.target.value)}
          enterKeyHint="enter"
          aria-label="Legg til på handlelisten"
        />
        <button className="btn-primary" disabled={!text.trim() || pending}>Legg til</button>
      </form>
      {error && <p className="text-sm text-bad">{error}</p>}

      <section className="card py-1">
        {!open.length ? (
          <p className="py-4 text-center text-sm text-muted">Ingenting på listen.</p>
        ) : (
          <ul className="divide-y divide-[#f0f2f5]">{open.map(row)}</ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted">Handlet ({done.length})</h2>
            <button
              type="button"
              className="text-sm text-brand"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await clearDone(projectId);
                  if (res.ok) {
                    setFlip({});
                    if (res.ids.length) showUndo(res.ids);
                    router.refresh();
                  } else setError(res.message);
                })
              }
            >
              Fjern avkryssede
            </button>
          </div>
          <ul className="card divide-y divide-[#f0f2f5] py-1 opacity-80">{done.map(row)}</ul>
        </section>
      )}

      {recent.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-semibold text-muted">
            Nylig handlet <span className="font-normal">({recent.length})</span> <span className="inline-block transition group-open:rotate-90">›</span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {recent.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await putBack(r.id);
                    if (res.ok) router.refresh();
                    else setError(res.message);
                  })
                }
                className="rounded-full border border-line bg-white px-3 py-2 text-sm"
                aria-label={`Legg ${r.title} på listen igjen`}
              >
                + {r.title}
              </button>
            ))}
          </div>
        </details>
      )}

      {undo && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg md:bottom-6">
          <span>{undo.length === 1 ? "1 vare ryddet" : `${undo.length} varer ryddet`}</span>
          <button
            type="button"
            className="font-semibold text-[#9fd6c3]"
            onClick={() => {
              const ids = undo;
              setUndo(null);
              start(async () => {
                const res = await undoClear(ids);
                if (res.ok) router.refresh();
                else setError(res.message);
              });
            }}
          >
            Angre
          </button>
        </div>
      )}
    </div>
  );
}
