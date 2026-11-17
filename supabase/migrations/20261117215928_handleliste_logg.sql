-- Handleliste: rydding skjuler i stedet for å slette (kan angres, gir «Nylig handlet»),
-- og en logg over hvem som gjorde hva. Loggen kan bare leses av voksne (admin/eier).
alter table items add column cleared_at timestamptz; -- satt = ryddet bort fra listen

create type list_action as enum ('added', 'checked', 'unchecked', 'cleared', 'restored', 'deleted');

create table list_events (
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  project_id   uuid not null references projects (id) on delete cascade,
  item_id      uuid,                 -- ingen fremmednøkkel: loggen blir stående når varen slettes
  title        text not null,
  action       list_action not null,
  profile_id   uuid references profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index list_events_project_idx on list_events (project_id, created_at desc);

-- Skrives av databasen selv når varer på en liste endres (bokføring, som de andre etter-triggerne).
create function items_list_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r      items := coalesce(new, old);
  act    list_action;
begin
  if r.project_id is null or not exists (select 1 from projects p where p.id = r.project_id and p.kind = 'list') then
    return null;
  end if;

  if tg_op = 'INSERT' then
    act := 'added';
  elsif tg_op = 'DELETE' then
    act := 'deleted';
  elsif old.cleared_at is null and new.cleared_at is not null then
    act := 'cleared';
  elsif old.cleared_at is not null and new.cleared_at is null then
    act := 'restored';
  elsif old.status <> 'done' and new.status = 'done' then
    act := 'checked';
  elsif old.status = 'done' and new.status <> 'done' then
    act := 'unchecked';
  else
    return null;
  end if;

  insert into list_events (workspace_id, project_id, item_id, title, action, profile_id)
  values (r.workspace_id, r.project_id, r.id, r.title, act, current_profile_id());
  return null;
end $$;
create trigger items_list_log
  after insert or update or delete on items
  for each row execute function items_list_log();
revoke execute on function items_list_log() from public, anon, authenticated;

alter table list_events enable row level security;
create policy list_events_select on list_events for select to authenticated using (is_member(workspace_id, 'admin'));
revoke all on list_events from anon, authenticated;
grant select on list_events to authenticated;
