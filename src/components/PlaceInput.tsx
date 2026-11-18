"use client";

import { useEffect, useRef, useState } from "react";
import { mapsUrl, type PlaceSuggestion } from "@/lib/places";

/** Sted med forslag mens du skriver: steder brukt før først, så Google. «Åpne i kart» når noe er valgt. */
export function PlaceInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [google, setGoogle] = useState(false);
  const [active, setActive] = useState(-1);
  const session = useRef<string>("");
  const typed = useRef(false);

  useEffect(() => {
    if (!open || !typed.current) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        if (!session.current) session.current = crypto.randomUUID();
        const res = await fetch(`/api/sted?q=${encodeURIComponent(value)}&s=${session.current}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: PlaceSuggestion[]; google: boolean };
        setItems(data.suggestions);
        setGoogle(data.google && data.suggestions.some((s) => s.source === "google"));
        setActive(-1);
      } catch {
        /* avbrutt eller uten nett: ingen forslag */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, open]);

  const pick = (s: PlaceSuggestion) => {
    onChange(s.value);
    setOpen(false);
    typed.current = false;
    session.current = ""; // ny økt neste gang
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          id={id}
          className="input"
          placeholder="Søk etter sted eller adresse"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={`${id}-list`}
          value={value}
          onFocus={() => {
            typed.current = true;
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            typed.current = true;
            onChange(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!open || !items.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && active >= 0) {
              e.preventDefault();
              pick(items[active]);
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
        {value.trim() && (
          <a href={mapsUrl(value)} target="_blank" rel="noopener noreferrer" className="btn-ghost shrink-0 whitespace-nowrap" aria-label={`Åpne ${value} i kart`}>
            Kart
          </a>
        )}
      </div>
      {open && items.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-line bg-white py-1 shadow-lg">
          {items.map((s, i) => (
            <li key={`${s.source}-${s.value}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className={`flex w-full flex-col px-3 py-2 text-left ${i === active ? "bg-brand-soft" : "hover:bg-[#f6f7f9]"}`}
              >
                <span className="text-[15px]">{s.label}</span>
                {s.detail && <span className="text-xs text-muted">{s.detail}</span>}
              </button>
            </li>
          ))}
          {google && <li className="px-3 pt-1 pb-1.5 text-right text-[11px] text-muted">Forslag fra Google</li>}
        </ul>
      )}
    </div>
  );
}
