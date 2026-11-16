"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAdult, addChild, createFamily, newChildCode, setMyColor } from "@/app/actions/family";
import { PERSON_COLORS } from "@/lib/people";

export type Member = { id: string; name: string; child: boolean; role: string; me: boolean; color: string };

/** Velg din egen farge. Den brukes overalt der det står hvem noe gjelder. */
export function MyColor({ color }: { color: string }) {
  const router = useRouter();
  const [value, setValue] = useState(color);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="card space-y-2 py-3">
      <h2 className="h2">Din farge</h2>
      <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Velg farge">
        {PERSON_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={`Farge ${c}`}
            disabled={pending}
            onClick={() => {
              const before = value;
              setValue(c);
              setError(null);
              start(async () => {
                const res = await setMyColor(c);
                if (res.ok) router.refresh();
                else {
                  setValue(before);
                  setError(res.message);
                }
              });
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ background: c, boxShadow: value === c ? `0 0 0 3px #fff, 0 0 0 5px ${c}` : undefined }}
          >
            {value === c ? "✓" : ""}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
    </section>
  );
}

export function CreateFamily() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="card space-y-3 text-center">
      <p className="font-medium">Ingen familie ennå</p>
      <p className="text-sm text-muted">Familie blir et eget område med felles avtaler, aktiviteter og handleliste.</p>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await createFamily();
            if (res.ok) router.refresh();
            else setError(res.message);
          })
        }
      >
        {pending ? "Oppretter …" : "Opprett Familie"}
      </button>
    </div>
  );
}

function CodeBox({ code, name }: { code: string; name: string }) {
  return (
    <div className="space-y-1 rounded-xl border-2 border-dashed border-brand bg-brand-soft p-3 text-center">
      <div className="text-xs text-muted">Innloggingskode for {name}, gyldig i 24 timer</div>
      <div className="font-mono text-2xl font-bold tracking-[0.2em] text-brand">{code}</div>
      <div className="text-xs text-muted">
        På {name}s iPhone eller iPad: åpne Ordna, trykk «Har du en kode?» og skriv inn koden. Én kode per enhet.
      </div>
    </div>
  );
}

export function FamilyAdmin({ members, canAdmin }: { members: Member[]; canAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [newCode, setNewCode] = useState<{ name: string; code: string } | null>(null);
  const [adult, setAdult] = useState({ name: "", email: "" });
  const [childName, setChildName] = useState("");
  const [open, setOpen] = useState<"adult" | "child" | null>(null);

  const run = <T,>(fn: () => Promise<{ ok: true; data?: T } | { ok: false; message: string }>, after?: (d?: T) => void) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        after?.(res.data);
        router.refresh();
      } else setError(res.message);
    });
  };

  return (
    <div className="space-y-4">
      <section className="card space-y-1 py-3">
        <h2 className="h2">Medlemmer</h2>
        <ul className="divide-y divide-[#f0f2f5]">
          {members.map((m) => (
            <li key={m.id} className="space-y-2 py-2.5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full font-semibold text-white" style={{ background: m.color }}>{m.name.charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {m.name} {m.me && <span className="text-xs text-muted">(deg)</span>}
                  </div>
                  <div className="text-xs text-muted">{m.child ? "Barn" : m.role === "owner" ? "Voksen · eier" : "Voksen"}</div>
                </div>
                {canAdmin && m.child && (
                  <button
                    type="button"
                    className="btn-ghost py-1.5"
                    disabled={pending}
                    onClick={() => run(() => newChildCode(m.id), (c) => c && setCodes((s) => ({ ...s, [m.id]: c })))}
                  >
                    Ny kode
                  </button>
                )}
              </div>
              {codes[m.id] && <CodeBox code={codes[m.id]} name={m.name} />}
            </li>
          ))}
        </ul>
      </section>

      {newCode && <CodeBox code={newCode.code} name={newCode.name} />}
      {error && <p className="text-sm text-bad">{error}</p>}

      {canAdmin && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={open === "adult" ? "btn-primary" : "btn-ghost"} onClick={() => setOpen(open === "adult" ? null : "adult")}>
            + Voksen
          </button>
          <button type="button" className={open === "child" ? "btn-primary" : "btn-ghost"} onClick={() => setOpen(open === "child" ? null : "child")}>
            + Barn
          </button>
        </div>
      )}

      {open === "adult" && (
        <form
          className="card space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addAdult(adult.name, adult.email), () => {
              setAdult({ name: "", email: "" });
              setOpen(null);
            });
          }}
        >
          <p className="text-sm text-muted">Den voksne logger inn på Ordna med kode på e-post, akkurat som deg.</p>
          <div>
            <label className="label" htmlFor="ad-name">Navn</label>
            <input id="ad-name" required className="input" value={adult.name} onChange={(e) => setAdult({ ...adult, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="ad-email">E-post</label>
            <input id="ad-email" required type="email" autoCapitalize="none" className="input" value={adult.email} onChange={(e) => setAdult({ ...adult, email: e.target.value })} />
          </div>
          <button className="btn-primary" disabled={pending}>{pending ? "Legger til …" : "Legg til"}</button>
        </form>
      )}

      {open === "child" && (
        <form
          className="card space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const name = childName.trim();
            run(() => addChild(name), (code) => {
              if (code) setNewCode({ name, code });
              setChildName("");
              setOpen(null);
            });
          }}
        >
          <p className="text-sm text-muted">Barnet trenger ingen e-post. Du får en kode som barnet skriver inn én gang på sin iPhone eller iPad.</p>
          <div>
            <label className="label" htmlFor="ch-name">Navn</label>
            <input id="ch-name" required className="input" value={childName} onChange={(e) => setChildName(e.target.value)} />
          </div>
          <button className="btn-primary" disabled={pending}>{pending ? "Lager …" : "Legg til og lag kode"}</button>
        </form>
      )}
    </div>
  );
}
