-- Ordna – testdata (steg 14): de to testprosjektene fra kravspesifikasjonen.
-- Legges i arbeidsområdet Jobb for brukeren med e-posten under. Trygt å kjøre flere ganger:
-- et prosjekt med samme navn i samme arbeidsområde blir ikke laget på nytt.
-- Kjøres som databaseeier (Supabase SQL-editor eller MCP), ikke fra appen.

do $$
declare
  user_email constant text := 'hei@innspaell.no';
  pid  uuid;
  ws   uuid;
  proj uuid;
  red  uuid;
  step record;
begin
  select p.id into pid
    from profiles p join auth.users u on u.id = p.auth_user_id
   where lower(u.email) = lower(user_email);
  if pid is null then
    raise exception 'Fant ingen profil for %. Logg inn i Ordna én gang først.', user_email;
  end if;

  select w.id into ws
    from workspaces w join memberships m on m.workspace_id = w.id
   where m.profile_id = pid and w.kind = 'work'
   order by w.created_at limit 1;

  -- Testprosjekt 1: UKErevyen 2027, to avtaler
  if not exists (select 1 from projects where workspace_id = ws and name = 'UKErevyen 2027') then
    insert into projects (workspace_id, name, owner_profile_id, created_by_profile_id)
      values (ws, 'UKErevyen 2027', pid, pid) returning id into proj;
    insert into items (workspace_id, project_id, kind, title, starts_at, ends_at, created_by_profile_id) values
      (ws, proj, 'appointment', 'Skrivekurs', '2026-11-21 12:00 Europe/Oslo', '2026-11-21 20:00 Europe/Oslo', pid),
      (ws, proj, 'appointment', 'Redigering', '2026-11-22 10:00 Europe/Oslo', '2026-11-22 15:00 Europe/Oslo', pid);
  end if;

  -- Testprosjekt 2: Bryllupsvideo Ida og Sondre, delprosjekt Redigering med sju oppgaver
  if not exists (select 1 from projects where workspace_id = ws and name = 'Bryllupsvideo Ida og Sondre') then
    insert into projects (workspace_id, name, due_date, owner_profile_id, created_by_profile_id)
      values (ws, 'Bryllupsvideo Ida og Sondre', '2027-08-01', pid, pid) returning id into proj;
    insert into items (workspace_id, project_id, kind, title, created_by_profile_id)
      values (ws, proj, 'subproject', 'Redigering', pid) returning id into red;
    for step in
      select * from (values
        (0, 'Gjennomgang av opptak', null::date),
        (1, 'Grovklipp', null),
        (2, 'Finklipp', null),
        (3, 'Lyd og musikk', null),
        (4, 'Farge', null),
        (5, 'Godkjenning', null),
        (6, 'Levering', date '2027-08-01')
      ) as s(ord, title, due)
    loop
      insert into items (workspace_id, project_id, parent_id, kind, title, sort_order, due_date, created_by_profile_id)
        values (ws, proj, red, 'task', step.title, step.ord, step.due, pid);
    end loop;
  end if;
end $$;
