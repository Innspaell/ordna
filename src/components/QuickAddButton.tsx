"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QuickAddForm } from "./QuickAddForm";
import type { ProjectOption } from "@/lib/quick-add/parse";

/** +-knappen nede til høyre på alle skjermer. Åpner rask registrering. */
export function QuickAddButton({ projects }: { projects: ProjectOption[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ny oppgave eller avtale"
        className="fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-3xl leading-none text-white shadow-lg transition hover:brightness-110"
      >
        +
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-start sm:pt-24" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Rask registrering"
            className="w-full max-w-md rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="h2">Ny</h2>
              <button type="button" className="text-sm text-muted" onClick={() => setOpen(false)}>
                Lukk
              </button>
            </div>
            <QuickAddForm projects={projects} source="sheet" onSaved={() => router.refresh()} />
          </div>
        </div>
      )}
    </>
  );
}
