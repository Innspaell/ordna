# Ordna – prosjekt- og hverdagssystem

Personlig system for prosjekter, oppgaver, avtaler og dagsplan.
Eier: Erlend (InnSpaell AS). Fase 1: én bruker, klar for flere.

Kravspesifikasjon fase 1: https://claude.ai/artifact/BbUD9P2ft4z3T6LY7TwsPi
Konseptdokument: https://claude.ai/artifact/P3PGk1LMNZxLQdUT872wNh

## Prinsipper
- Bedre kontroll med mindre administrasjon. Ingen påkrevde felt utover tittel/navn.
- Mobil først. Rask registrering skal ta under 5 sekunder.
- Avansert struktur er valgfri og skjules til den trengs.

## Teknisk
- Next.js 15 (App Router), React 19, TypeScript, Tailwind 4, @supabase/ssr, Vercel (region arn1).
- Følg mønstrene i Innspaell/vaktpilot (oppsett, Vitest) og Innspaell/showplan (databasetester).
- Norsk i grensesnittet. Engelsk i kode, tabeller og kolonner.
- Tidssone Europe/Oslo i visning, UTC i databasen.
- Alle databaseendringer som migrasjoner i supabase/migrations. Aldri direkte i prod.

## Datamodell
- projects: egen tabell.
- items: subproject | task | appointment i samme tabell, med parent_id og project_id.
- Alle rader har workspace_id. RLS på alle tabeller via is_member(workspace_id, min_role).
- Felt for senere faser finnes i databasen, men vises ikke i UI før fasen kommer.

## Regler
- Fremdrift fase 1: "x av y fullført", bare tasks (ikke appointments, sjekkliste, avbrutt).
- Tasks rett under prosjekt med delprosjekter vises i gruppen "Øvrig".
- Plukk setter focus_date = i dag. Maks 3 fokus per dag.
- Klokkeslett i hurtigregistrering = appointment. Uten = task.
- Frittstående oppgaver legges i arbeidsområdet Jobb som standard.

## Arbeidsmåte
- Én oppgave fra byggerekkefølgen om gangen. Ikke start neste uten beskjed.
- Skriv tester først for tolkning av tekst og tilgangsregler.
- Spør før du legger til biblioteker eller endrer datamodellen.
- Kravspesifikasjonen er fasit. Ved tvil: spør, ikke gjett.
- Kjør `npm run lint`, `npm run typecheck`, `npm test` og `npm run build` før commit.

## Status
- Steg 1 (oppsett): ferdig lokalt. Gjenstår: koble Supabase-prosjekt og Vercel.
