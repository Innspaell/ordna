"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { quickAdd } from "@/app/actions/quick-add";
import { osloToday, parseQuickAdd, type ChipType, type ProjectOption } from "@/lib/quick-add/parse";

const CHIP_STYLE: Record<ChipType, string> = {
  date: "bg-amber-50 text-amber-800 border-amber-200",
  time: "bg-sky-50 text-sky-800 border-sky-200",
  project: "bg-brand-soft text-brand border-brand/30",
  context: "bg-violet-50 text-violet-800 border-violet-200",
};

type Props = {
  projects: ProjectOption[];
  source: "sheet" | "page" | "shortcut";
  initialText?: string;
  /** Lagre med en gang (fra iOS-snarvei) */
  autoSubmit?: boolean;
  onSaved?: (msg: string) => void;
};

export function QuickAddForm({ projects, source, initialText = "", autoSubmit = false, onSaved }: Props) {
  const [text, setText] = useState(initialText);
  const [ignore, setIgnore] = useState<ChipType[]>([]);
  const [chosen, setChosen] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const openedAt = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoDone = useRef(false);

  useEffect(() => {
    openedAt.current = performance.now();
    if (!autoSubmit) inputRef.current?.focus();
  }, [autoSubmit]);

  const parsed = useMemo(() => parseQuickAdd(text, { today: osloToday(), projects, ignore }), [text, projects, ignore]);
  const candidates = parsed.project.status === "many" ? parsed.project.candidates : [];

  function submit(chosenProjectId = chosen) {
    if (!parsed.title || pending) return;
    setError(null);
    const durationMs = performance.now() - openedAt.current;
    startTransition(async () => {
      const res = await quickAdd({ text, ignore, chosenProjectId, durationMs, source });
      if (res.status === "saved") {
        const msg = `«${res.title}» lagret i ${res.where}`;
        setSaved(msg);
        setText("");
        setIgnore([]);
        setChosen(undefined);
        openedAt.current = performance.now();
        onSaved?.(msg);
        // Fjern ?tekst= så en ny innlasting ikke lagrer på nytt
        if (source === "shortcut") window.history.replaceState(null, "", "/ny");
        else inputRef.current?.focus();
      } else if (res.status === "choose_project") {
        setError("Velg hvilket prosjekt det gjelder.");
      } else {
        setError(res.message);
      }
    });
  }

  useEffect(() => {
    if (autoSubmit && !autoDone.current && initialText.trim()) {
      autoDone.current = true;
      if (parsed.project.status !== "many") submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmit]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-3"
    >
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(null);
          setError(null);
        }}
        placeholder="Hva må gjøres? Prøv «Ring kunden i morgen #prosjekt»"
        enterKeyHint="done"
        autoComplete="off"
        className="input text-lg"
        aria-label="Ny oppgave eller avtale"
      />

      <div className="flex min-h-7 flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {parsed.kind === "appointment" ? "Avtale" : "Oppgave"}
        </span>
        {parsed.chips.map((c) => (
          <span key={c.type} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm ${CHIP_STYLE[c.type]}`}>
            {c.label}
            <button
              type="button"
              aria-label={`Fjern ${c.label}`}
              className="-mr-1 px-1 opacity-60 hover:opacity-100"
              onClick={() => {
                setIgnore((i) => [...i, c.type]);
                if (c.type === "project") setChosen(undefined);
                inputRef.current?.focus();
              }}
            >
              ×
            </button>
          </span>
        ))}
        {parsed.inInbox && parsed.title && <span className="text-sm text-muted">→ Innboks</span>}
      </div>

      {candidates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setChosen(c.id);
                submit(c.id);
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm ${chosen === c.id ? "border-brand bg-brand-soft" : "border-line bg-white"}`}
            >
              {c.kind === "subproject" && c.projectName ? `${c.projectName} › ${c.name}` : c.name}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-bad">{error}</p>}
      {saved && <p className="text-sm text-brand">✓ {saved}</p>}

      <button className="btn-primary w-full" disabled={!parsed.title || pending || candidates.length > 0}>
        {pending ? "Lagrer …" : "Lagre"}
      </button>
    </form>
  );
}
