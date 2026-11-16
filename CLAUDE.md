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
- Supabase-prosjekt: ordna (ref tycdtixfajxbhpmzfttx), org Innspaell, eu-north-1.
- Steg 1 (oppsett): ferdig. Vercel-prosjekt innspaell/ordna opprettet av Erlend.
- Steg 2 (datamodell): ferdig. Migrasjon 20261116081614_datamodell kjørt i prod. RLS på, ingen policyer ennå.
- Databasetester: `npm run test:db` (PGlite). Testprosjektene ligger i supabase/tests/run.mjs.
- Steg 3 (tilgangsregler): ferdig. Migrasjonene tilgangsregler + triggerrettigheter kjørt i prod.
  - Hjelpefunksjoner: current_profile_id(), is_member(ws, min_role), shares_workspace_with(profile).
  - created_by_profile_id på projects, items, checklist_items (settes automatisk, brukes for "medlem sletter egne").
  - Etter-triggere er security definer (bokføring). anon har ingen tabellrettigheter.
  - Supabase-advarsel om at innloggede kan kalle de tre hjelpefunksjonene er bevisst: policyene trenger dem.
- Steg 4 (innlogging): ferdig og testet i prod 16.11 (ordna-eta.vercel.app). Engangskode på e-post (som Vaktpilot) med lenke som reserve; shouldCreateUser=false.
  - ensure_my_setup() lager profil, organisasjon, Privat og Jobb ved første innlogging. Kalles etter innlogging og på forsiden.
  - E-postmal: supabase/email/innloggingskode.html (limes inn i Supabase under Auth → Email Templates → Magic Link).
  - Supabase-URL og offentlig nøkkel ligger i src/lib/supabase/config.ts (ikke miljøvariabler).
- Steg 5 (tolkning av tekst): ferdig. src/lib/quick-add/parse.ts, 39 tester i parse.test.ts.
  - parseQuickAdd(text, { today, projects, ignore }) → tittel, type, frist/avtaletid, sted, prosjekttreff, merker.
  - Datoer/klokkeslett er lokale strenger (Oslo). osloToday() og osloToUtcIso() for lagring.
- Steg 6 (rask registrering): ferdig.
  - +-knapp (src/components/QuickAddButton.tsx) i layouten for (app)-gruppen; skjema i QuickAddForm.tsx.
  - Server action src/app/actions/quick-add.ts tolker på nytt på serveren og lagrer. Logger quick_add:<kilde> med varighet i usage_events.
  - toItemRow (src/lib/quick-add/to-row.ts, 10 tester): tolket tekst → rad i items. Uten prosjekt havner det i Jobb.
  - /ny = feltet alene; /ny?tekst=... lagrer med en gang (iOS-snarvei) og fjerner ?tekst= fra adressen.
  - Forsiden viser midlertidig «Sist registrert» til dagsoversikten kommer i steg 12.
- Steg 7 (innboks): ferdig.
  - /innboks (src/app/(app)/innboks) med InboxList: Prosjekt (søk + «Nytt prosjekt»), Plukkliste (sted), Frist, Slett, og ✓ fullfør.
  - Regler i src/lib/inbox.ts (inboxPatch, 9 tester). Server actions i src/app/actions/inbox.ts.
  - BottomNav (I dag, Innboks med teller). Plukk og Prosjekter legges til i steg 8 og 11.
- Steg 8 (prosjekter): ferdig.
  - /prosjekter: liste sortert på frist (sortProjects), «x av y», fremdriftsstrek, «Vis alle», nytt prosjekt (NewProjectForm).
  - /prosjekter/[id]: ProjectView med grupper, «Øvrig», underdelprosjekter (nivå 2+ lukket), fullfør med ett trykk, skjul fullførte (?skjul=1).
  - buildProjectTree/countTasks i src/lib/project-tree.ts (12 tester). Server actions i src/app/actions/projects.ts.
  - «+ Legg til» i en gruppe tolker teksten som rask registrering (dato/klokkeslett), men uten #prosjekt.
- Steg 9 (oppgave + sjekkliste): ferdig. /oppgave/[id] med TaskEditor (lagrer ved endring/blur). Sjekkliste: legg til, kryss av, ↑↓, slett.
- Steg 10 (avtaler): ferdig. /avtale/[id] med AppointmentEditor (lagre-knapp). Hele dagen = start 00:00 Oslo, ingen slutt.
  - Validering i src/lib/item-edit.ts (taskPatch, appointmentPatch, projectFields, osloParts, moveSortOrder; 17 tester).
  - Server actions i src/app/actions/items.ts. ProjectSelect deles av begge sidene.
- Steg 11 (plukkliste + fokus): ferdig. /plukk med filter ?sted=home|computer|phone|outside, «Fokus i dag» øverst.
  - pickForToday/clearFocus i src/app/actions/focus.ts. Maks 3 fokus (fullførte teller ikke), regel i src/lib/focus.ts (4 tester).
  - BottomNav: I dag · Innboks · Plukk · Prosjekter.
- Neste: steg 12, dagsoversikt (forsiden).
