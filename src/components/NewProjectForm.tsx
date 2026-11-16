"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/app/actions/projects";

type Ws = { id: string; name: string; kind: string };

export function NewProjectForm({ workspaces }: { workspaces: Ws[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const [ws, setWs] = useState(workspaces.find((w) => w.kind === "work")?.id ?? workspaces[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" className="btn-ghost w-full" onClick={() => setOpen(true)}>
        + Nytt prosjekt
      </button>
    );
  }

  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await createProject({ name, workspaceId: ws, dueDate: due || undefined });
          if (res.ok && res.data) router.push(`/prosjekter/${res.data}`);
          else if (!res.ok) setError(res.message);
        });
      }}
    >
      <div>
        <label className="label" htmlFor="pname">Navn</label>
        <input id="pname" autoFocus required className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="label" htmlFor="pws">Arbeidsområde</label>
          <select id="pws" className="input" value={ws} onChange={(e) => setWs(e.target.value)}>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="label" htmlFor="pdue">Frist (valgfritt)</label>
          <input id="pdue" type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={!name.trim() || pending}>{pending ? "Lager …" : "Lag prosjekt"}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Avbryt</button>
      </div>
    </form>
  );
}
