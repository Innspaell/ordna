"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setProjectStatus, type ProjectStatus } from "@/app/actions/projects";

const OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Aktivt" },
  { value: "paused", label: "På vent" },
  { value: "done", label: "Fullført" },
  { value: "cancelled", label: "Avbrutt" },
];

export function ProjectStatusSelect({ projectId, status }: { projectId: string; status: ProjectStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Status
      <select
        className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
        value={status}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            const res = await setProjectStatus(projectId, e.target.value as ProjectStatus);
            if (res.ok) router.refresh();
          })
        }
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
