"use client";

import type { ProjectOption } from "@/lib/quick-add/parse";

/** Velg prosjekt eller delprosjekt. Tom verdi = uten prosjekt. */
export function ProjectSelect({
  id,
  value,
  options,
  onChange,
  disabled,
}: {
  id?: string;
  value: string;
  options: ProjectOption[];
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const projects = options.filter((o) => o.kind === "project");
  return (
    <select id={id} className="input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Uten prosjekt</option>
      {projects.map((p) => (
        <optgroup key={p.id} label={p.name}>
          <option value={p.id}>{p.name}</option>
          {options
            .filter((o) => o.kind === "subproject" && o.projectId === p.id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {p.name} › {s.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
