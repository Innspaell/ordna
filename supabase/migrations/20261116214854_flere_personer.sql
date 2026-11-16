-- Flere personer på én ting: «Erlend og Ingrid på kamp». Erstatter items.assignee_profile_id.
create table item_people (
  item_id      uuid not null references items (id) on delete cascade,
  profile_id   uuid not null references profiles (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade, -- settes fra elementet
  created_at   timestamptz not null default now(),
  primary key (item_id, profile_id)
);
create index item_people_profile_idx on item_people (profile_id);
create index item_people_workspace_idx on item_people (workspace_id);

-- Arbeidsområdet hentes alltid fra elementet, og personen må være med i det.
create function item_people_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select workspace_id into new.workspace_id from items where id = new.item_id;
  if new.workspace_id is null then
    raise exception 'Ukjent element';
  end if;
  if not exists (select 1 from memberships m where m.workspace_id = new.workspace_id and m.profile_id = new.profile_id) then
    raise exception 'Personen er ikke med i arbeidsområdet';
  end if;
  return new;
end $$;
create trigger item_people_before_write
  before insert or update on item_people
  for each row execute function item_people_before_write();

-- Når et element bytter arbeidsområde: fjern personer som ikke er med der, flytt resten.
create function items_people_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from item_people ip
   where ip.item_id = new.id
     and not exists (select 1 from memberships m where m.workspace_id = new.workspace_id and m.profile_id = ip.profile_id);
  update item_people set workspace_id = new.workspace_id where item_id = new.id;
  return null;
end $$;
create trigger items_people_follow
  after update of workspace_id on items
  for each row when (old.workspace_id is distinct from new.workspace_id)
  execute function items_people_follow();

revoke execute on function item_people_before_write() from public, anon, authenticated;
revoke execute on function items_people_follow()      from public, anon, authenticated;

-- Tilgang: les når du ser elementet, legg til og fjern som medlem. Ingen endring (slett og legg til i stedet).
alter table item_people enable row level security;
create policy item_people_select on item_people for select to authenticated using (is_member(workspace_id));
create policy item_people_insert on item_people for insert to authenticated with check (is_member(workspace_id, 'member'));
create policy item_people_delete on item_people for delete to authenticated using (is_member(workspace_id, 'member'));
revoke all on item_people from anon, authenticated;
grant select, insert, delete on item_people to authenticated;

-- Flytt eksisterende ansvarlige over, og fjern den gamle kolonnen.
insert into item_people (item_id, profile_id)
select i.id, i.assignee_profile_id
  from items i
 where i.assignee_profile_id is not null
   and exists (select 1 from memberships m where m.workspace_id = i.workspace_id and m.profile_id = i.assignee_profile_id);
alter table items drop column assignee_profile_id;
