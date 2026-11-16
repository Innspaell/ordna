"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/next-path";
import { redeemChildCode } from "@/app/actions/family";

/**
 * Innlogging med engangskode på e-post. Koden skrives inn her, så den virker også
 * i appen på hjemskjermen (en lenke åpnes ofte i Safari i stedet).
 * E-posten inneholder også en lenke som reserve.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code" | "child">("email");
  const [childCode, setChildCode] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const cleanEmail = () => email.trim().toLowerCase();

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    const { error } = await createClient().auth.signInWithOtp({
      email: cleanEmail(),
      // Nye kontoer opprettes ikke herfra. Brukere legges til i Supabase.
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: false,
      },
    });
    setBusy(false);
    if (error) {
      const noUser = /signup|not allowed|not found|otp_disabled/i.test(`${error.code ?? ""} ${error.message}`);
      setError(
        error.status === 429
          ? "For mange forsøk. Vent et minutt og prøv igjen."
          : noUser
            ? "Vi fant ingen bruker med denne e-posten. Sjekk at den er skrevet riktig."
            : "Kunne ikke sende kode. Prøv igjen om litt.",
      );
      return;
    }
    setStep("code");
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length < 6) {
      setError("Skriv inn hele koden.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email: cleanEmail(), token, type: "email" });
    if (error) {
      setBusy(false);
      setError("Koden er feil eller utløpt. Sjekk e-posten eller be om en ny kode.");
      return;
    }
    await supabase.rpc("ensure_my_setup");
    window.location.href = safeNextPath(new URLSearchParams(window.location.search).get("next"));
  }

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await redeemChildCode(childCode);
    if (!res.ok) {
      setBusy(false);
      setError(res.message);
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <div className="mb-8">
        <div className="text-sm font-semibold uppercase tracking-wider text-brand">Ordna</div>
        <h1 className="h1 mt-1">Logg inn</h1>
        <p className="mt-2 text-muted">
          {step === "email" ? "Vi sender deg en kode på e-post." : step === "child" ? "Skriv inn koden du har fått av en voksen." : `Vi har sendt en kode til ${email}. Den gjelder i en time.`}
        </p>
      </div>

      {step === "child" ? (
        <form onSubmit={redeem} className="card space-y-4">
          <div>
            <label className="label" htmlFor="child-code">Kode</label>
            <input
              id="child-code"
              required
              autoFocus
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={9}
              placeholder="ABCD-EFGH"
              className="input text-center font-mono text-2xl font-semibold tracking-[0.2em] uppercase"
              value={childCode}
              onChange={(e) => setChildCode(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Logger inn …" : "Logg inn"}</button>
          <button type="button" className="w-full text-sm text-brand" onClick={() => { setStep("email"); setError(null); }}>
            Logg inn med e-post i stedet
          </button>
        </form>
      ) : step === "email" ? (
        <form onSubmit={sendCode} className="card space-y-4">
          <div>
            <label className="label" htmlFor="email">E-post</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Sender …" : "Send kode"}</button>
          <button type="button" className="w-full text-sm text-brand" onClick={() => { setStep("child"); setError(null); }}>
            Har du en kode fra en voksen?
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="card space-y-4">
          <div>
            <label className="label" htmlFor="code">Kode fra e-posten</label>
            <input
              id="code"
              ref={codeRef}
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9 ]*"
              maxLength={10}
              className="input text-center text-2xl font-semibold tracking-[0.4em] tabular-nums"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Logger inn …" : "Logg inn"}</button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-brand" onClick={() => { setStep("email"); setCode(""); setError(null); }}>
              Annen e-post
            </button>
            <button type="button" className="text-brand" disabled={busy} onClick={() => sendCode()}>
              Send ny kode
            </button>
          </div>
          <p className="text-xs text-muted">Fikk du en lenke i stedet? Den virker også. Åpne den på denne enheten.</p>
        </form>
      )}
    </main>
  );
}
