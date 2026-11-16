"use client";

import type { Named } from "@/lib/quick-add/parse";

/** Hvem det gjelder. Vises bare når det finnes flere personer (familie). */
export function PersonSelect({ id, value, people, onChange, disabled }: { id?: string; value: string; people: Named[]; onChange: (v: string | null) => void; disabled?: boolean }) {
  return (
    <select id={id} className="input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Ingen</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}
