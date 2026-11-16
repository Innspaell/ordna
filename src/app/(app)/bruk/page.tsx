import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { osloToday } from "@/lib/quick-add/parse";
import { summarizeUsage, type UsageEvent } from "@/lib/usage";

export const metadata = { title: "Bruk · Ordna" };

const SOURCE: Record<string, string> = { sheet: "+-knappen", page: "/ny", shortcut: "iOS-snarvei" };

export default async function UsagePage() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data } = await supabase.from("usage_events").select("event, created_at, duration_ms").gte("created_at", since).order("created_at");
  const s = summarizeUsage((data ?? []) as UsageEvent[], osloToday());

  const stat = (value: string, label: string, hint?: string) => (
    <div className="card">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-sm text-muted">{label}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );

  return (
    <main className="page space-y-4">
      <Link href="/" className="text-sm text-brand">← I dag</Link>
      <header>
        <h1 className="h1">Bruk</h1>
        <p className="mt-1 text-sm text-muted">Siste {s.windowDays} dager. Målet er daglig bruk i fire uker og registrering på under fem sekunder.</p>
      </header>
      <div className="grid grid-cols-2 gap-3">
        {stat(`${s.daysUsed} av ${s.windowDays}`, "dager brukt")}
        {stat(`${s.streak}`, "dager på rad", s.streak >= 28 ? "Målet er nådd" : `${Math.max(0, 28 - s.streak)} igjen til fire uker`)}
        {stat(`${s.quickAdds}`, "registreringer")}
        {stat(s.medianMs === null ? "–" : `${(s.medianMs / 1000).toFixed(1)} s`, "median tid", s.under5sShare === null ? undefined : `${Math.round(s.under5sShare * 100)} % under 5 s`)}
      </div>
      {s.quickAdds > 0 && (
        <section className="card space-y-1">
          <h2 className="h2">Hvor du registrerer fra</h2>
          <ul className="text-sm">
            {Object.entries(s.bySource)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <li key={k} className="flex justify-between py-0.5">
                  <span>{SOURCE[k] ?? k}</span>
                  <span className="tabular-nums text-muted">{v}</span>
                </li>
              ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-muted">Tiden måles fra registreringsfeltet åpnes til du trykker Lagre.</p>
    </main>
  );
}
