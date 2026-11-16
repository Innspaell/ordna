"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPeople } from "@/app/actions/items";
import type { PersonTag } from "@/lib/week";

/** Hvem: trykk på én eller flere personer. Lagres med en gang. */
export function PeoplePicker({ itemId, options, selected }: { itemId: string; options: PersonTag[]; selected: string[] }) {
  const router = useRouter();
  const [sel, setSel] = useState(selected);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(key: string) {
    const before = sel;
    const next = sel.includes(key) ? sel.filter((k) => k !== key) : options.map((o) => o.key).filter((k) => k === key || sel.includes(k));
    setSel(next);
    setMsg(null);
    start(async () => {
      const res = await setPeople(itemId, next);
      if (res.ok) router.refresh();
      else {
        setSel(before);
        setMsg(res.message);
      }
    });
  }

  return (
    <div>
      <span className="label">Hvem</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Hvem gjelder det?">
        {options.map((p) => {
          const on = sel.includes(p.key);
          return (
            <button
              key={p.key}
              type="button"
              aria-pressed={on}
              disabled={pending}
              onClick={() => toggle(p.key)}
              className="flex h-9 items-center gap-1.5 rounded-full border-[1.5px] pr-3 pl-1 text-[13px] font-semibold"
              style={on ? { borderColor: p.color, background: `${p.color}14`, color: "#16202b" } : { borderColor: "#e3e7ec", background: "#fff", color: "#98a2b3" }}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: on ? p.color : "#c9d0d8" }}>
                {p.initial}
              </span>
              {p.name}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-muted">{msg ?? (sel.length ? "" : "Ingen valgt: gjelder alle (Felles i Familie).")}</p>
    </div>
  );
}
