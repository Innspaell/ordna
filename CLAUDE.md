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
- Steg 12 (dagsoversikt): ferdig. Forsiden = Avtaler i dag → Forfalt → Frist i dag → Fokus, tellere for innboks og plukkliste.
  - buildToday/osloDayRange i src/lib/today.ts (10 tester). Fokus vinner: en oppgave vises bare ett sted. TodayView-komponent.
- Steg 13 (PWA): ferdig. src/app/manifest.ts, ikoner i public/icons + src/app/icon.png/apple-icon.png, appleWebApp-metadata.
  - /snarvei forklarer hjemskjerm og iOS-snarvei (Snarveier → /ny?tekst=). Snarveien åpner Safari, som har egen innlogging.
- Steg 14 (testdata + brukslogg): ferdig.
  - supabase/seed/testprosjekter.sql (idempotent), kjørt i prod for hei@innspaell.no 16.11.
  - UsageBeacon logger «open» én gang per dag per enhet (logOpen i src/app/actions/usage.ts).
  - /bruk viser dager brukt, dager på rad, antall registreringer, median tid og andel under 5 s (summarizeUsage, 6 tester).
- Nytt grensesnitt (16.11), etter skissene i https://claude.ai/artifact/VB5P9oT4dxQVv9A1d6RxSo:
  - Statusfarger og prosjektfarger i src/lib/ui.ts (STATUS, taskStatusKey, projectColor; 8 tester). Prosjektfarge regnes fra id, lagres ikke.
  - StatusPill/Dot, Icons. Mobil: BottomNav med ikoner (I dag, Innboks, Plukk, Prosjekter). PC (md+): SideNav med Uke, bredere .page.
  - /kalender?vis=dag|uke|maned&dato=YYYY-MM-DD: én side med Dag/Uke/Måned (src/lib/calendar.ts, 8 tester). /uke videresender hit.
    - buildRange/buildWeek i src/lib/week.ts (11 tester). Uke: mobil = én rad per dag, PC = prosjekter × dager. Måned: rutenett, prikker på mobil.
    - «I dag» (forsiden) er fortsatt egen fokusside; ukestripen lenker til dag og uke i kalenderen. Kalender er i menyen på mobil og PC.
  - I dag: ukestripe (WeekStrip) + statusmerker. Prosjekter: Aktive/Fullførte, filter på arbeidsområde, «Neste» (nextUp, 5 tester).
  - Prosjektsiden: grupper med farget stripe, tabell på PC (status fyller cellen, frist, sjekkliste), prosjektstatus kan endres.
- Familie, første versjon (16.11): migrasjon 20261116211806_familie kjørt i prod.
  - projects.kind = project|list (Handleliste er en list i Familie). child_login_codes (bare service role).
  - create_family_workspace() (innlogget), admin_add_family_member() (bare service role), ensure_my_setup gir voksne lagt til av andre Privat+Jobb; barn får bare Familie.
  - /familie: opprett familie, + Voksen (e-post, logger inn med OTP som vanlig), + Barn (navn → engangskode XXXX-XXXX, 24 t, én enhet per kode).
  - Server actions i src/app/actions/family.ts bruker createAdminClient() (src/lib/supabase/admin.ts) → krever SUPABASE_SERVICE_ROLE_KEY i Vercel.
  - Barnet logger inn på /login → «Har du en kode fra en voksen?» → redeemChildCode (generateLink + verifyOtp på serveren).
  - Barnemeny (CHILD_NAV): I dag, Kalender, Handleliste. Voksne: Familie og Handleliste i sidemenyen og på I dag.
  - Rask registrering: @navn → ansvarlig, #familie → arbeidsområde (når ingen prosjekter matcher). «Hvem» på oppgave og avtale.
  - Databasetester for familie i supabase/tests/run.mjs (49 totalt). Barnekoder i src/lib/child-code.ts (4 tester).
- Personvelger og personfarger (16.11), etter familieskissene på samme lerret: migrasjon 20261116213303_personfarge kjørt i prod.
  - profiles.color (fast palett, null = automatisk ut fra id). Innloggede kan bare oppdatere display_name og color (kolonnerettighet).
  - Regler i src/lib/people.ts (14 tester): ansvarlig → person; Familie uten navn → Felles; ellers den som laget det.
  - src/lib/family-view.ts: loadFamilyView (medlemmer + Felles, valg fra cookie ordna_hvem, rader fra ordna_rader), personOf, visible, myFocus.
  - PersonFilter (chips, slå av/på), RowsToggle (PC: Rader Prosjekt/Person), PersonBadge. Brukes på I dag og Kalender.
  - Standard: voksne ser alle, barn seg selv + Felles. Fokus er alltid ditt eget. buildPersonRows i week.ts.
  - /familie: «Din farge» for alle (også barn, Familie er i CHILD_NAV). setMyColor i actions/family.ts.
- Flere personer på én ting (16.11): migrasjon 20261116214854_flere_personer kjørt i prod (item_people erstatter items.assignee_profile_id).
  - item_people(item_id, profile_id, workspace_id): workspace settes fra elementet, personen må være medlem; følger med når elementet flytter område.
  - Rask registrering: flere @navn → flere personer; @navn uten #område/#prosjekt havner i Familie. PeoplePicker (chips) på oppgave og avtale, setPeople i actions/items.ts.
  - personKeys/isShown: en ting vises når minst én av personene er valgt; i «Rader: Person» står den på raden til hver av dem.
- Handleliste: rydding, Nylig handlet og logg (17.11): migrasjon 20261117215928_handleliste_logg kjørt i prod.
  - items.cleared_at: «Fjern avkryssede» skjuler (alle kan rydde alt, også barn). clearDone gir id-er → «Angre» i 10 s (undoClear).
  - «Nylig handlet»: ryddede varer, én per navn, ikke det som står på listen (recentlyBought). putBack legger varen på igjen.
  - list_events fylles av triggeren items_list_log (added/checked/unchecked/cleared/restored/deleted) bare for lister. Bare admin/eier kan lese.
  - /handleliste?vis=logg (fane Logg for voksne). groupEvents/eventLabel/whenLabel i src/lib/shopping.ts (8 tester).
- Handleliste fortløpende (18.11): migrasjon 20261118052533_handleliste_live (items i publikasjonen supabase_realtime).
  - ShoppingList abonnerer på postgres_changes for project_id og kaller router.refresh() (300 ms samling). Lastes også på nytt ved visibilitychange/online.
- Gjentakelser (18.11), etter skissene under «Gjentakelser» på lerretet: migrasjon 20261118094744_gjentakelser kjørt i prod.
  - item_series (freq daily|weekly|monthly|yearly, weekdays 1–7, starts_on, until_date). Sluttdato kreves, unntatt hvert år (merkedager: 10 år frem). Maks to år.
  - Hver gang er en egen rad i items (series_id, occurrence_date), alle lagt inn med en gang (saveSeries i src/lib/series-save.ts, seriesRows/templateOf i series-rows.ts).
  - Regler i src/lib/recurrence.ts (occurrences, describeRule, untilChoices; skoleferier Stjørdal 2026–2028 = siste skoledag før ferie). 13 tester.
  - Rask registrering: «hver tirsdag og torsdag», «hver dag», «hver uke», «hver måned den 20.», «hvert år», «til 18.12», «til juleferien». Mangler sluttdato → «Til og med når?».
  - Editorer: SeriesPanel (Gjentas / til og med), ScopeToggle «Bare denne | Denne og fremover» for lagre, hvem, prosjekt, slett og avlys. Frist/status/dato gjelder alltid bare denne.
  - Avlyste avtaler (status cancelled) vises overstreket. Forfalt viser alle; «Fullfør alle» (completeTasks).
- Sted med forslag (18.11): ingen databaseendring, stedet lagres fortsatt som tekst.
  - /api/sted (bare innlogget): steder brukt før (recentPlaces) + Google Places Autocomplete (New) med GOOGLE_MAPS_API_KEY på serveren. Uten nøkkel: bare brukte steder.
  - src/lib/places.ts (fromGoogle, mergePlaces, autocompleteBody med vekt på Stjørdal, mapsUrl; 6 tester). PlaceInput med «Kart»-lenke i AppointmentEditor.
- Fase 1 er ferdig bygget. Neste: daglig bruk i fire uker, deretter fase 2 (kalender, gjentakelser, planlagt dag, «Venter på», tidsestimat og kapasitet).
