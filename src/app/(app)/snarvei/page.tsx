import Link from "next/link";
import { headers } from "next/headers";

export const metadata = { title: "Ordna på iPhone" };

export default async function ShortcutPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "ordna-eta.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${host}`;

  return (
    <main className="page space-y-5">
      <Link href="/" className="text-sm text-brand">← I dag</Link>
      <h1 className="h1">Ordna på iPhone</h1>

      <section className="card space-y-2">
        <h2 className="h2">1. Legg Ordna på hjemskjermen</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Åpne <span className="font-medium">{base}</span> i Safari.</li>
          <li>Trykk på Del-knappen (firkanten med pil opp).</li>
          <li>Velg «Legg til på Hjem-skjerm» og trykk «Legg til».</li>
          <li>Åpne Ordna fra hjemskjermen og logg inn én gang.</li>
        </ol>
        <p className="text-sm text-muted">Holder du fingeren på ikonet, får du snarveien «Ny oppgave».</p>
      </section>

      <section className="card space-y-2">
        <h2 className="h2">2. Snarvei for rask registrering</h2>
        <p className="text-sm">Med en snarvei kan du si «Hei Siri, ny oppgave», eller legge den på låseskjermen eller Action-knappen.</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Åpne appen <span className="font-medium">Snarveier</span> og trykk +.</li>
          <li>Legg til handlingen <span className="font-medium">«Spør etter inndata»</span>. Skriv «Hva skal inn i Ordna?» som spørsmål.</li>
          <li>Legg til <span className="font-medium">«URL»</span> og skriv inn adressen under. Trykk der det står <code>SVAR</code>, og velg variabelen «Gitt inndata».</li>
          <li>Legg til <span className="font-medium">«Åpne URL-er»</span>.</li>
          <li>Gi snarveien navnet <span className="font-medium">Ny oppgave</span>.</li>
        </ol>
        <pre className="overflow-x-auto rounded-lg bg-paper p-3 text-xs">{`${base}/ny?tekst=SVAR`}</pre>
        <p className="text-sm text-muted">
          Snarveien åpner Safari, ikke appen på hjemskjermen. Første gang må du derfor logge inn i Safari også. Etterpå lagres teksten med en gang, og du ser hvor den havnet.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="h2">Fra dele-menyen</h2>
        <p className="text-sm">
          Vil du sende tekst fra andre apper til Ordna? Slå på «Vis i Del-ark» i snarveiens innstillinger. Bytt ut «Spør etter inndata» med «Snarvei-inndata».
        </p>
      </section>
    </main>
  );
}
