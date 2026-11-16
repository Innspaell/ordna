-- Ordna – steg 2: datamodell
-- Typer, tabeller, regler og triggere. RLS slås på for alle tabeller her;
-- policyene kommer i steg 3. Uten policyer er alt stengt for anon og authenticated.

-- ── Typer ────────────────────────────────────────────────────────
create type workspace_kind  as enum ('private', 'work', 'family');
create type member_role     as enum ('owner', 'admin', 'member', 'viewer');
create type item_kind       as enum ('subproject', 'task', 'appointment');
create type item_status     as enum ('ready', 'in_progress', 'waiting', 'done', 'cancelled');
create type project_status  as enum ('active', 'paused', 'done', 'cancelled');
create type pick_context    as enum ('home', 'computer', 'phone', 'outside');
create type progress_method as enum ('equal', 'weighted', 'milestone');

-- ── Felles hjelpefunksjon ───────────────────────────────────────
create function set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── Organisasjoner, profiler, arbeidsområder, medlemskap ────────
create table organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (btrim(name) <> ''),
  created_at timestamptz not null default now()
);

create table profiles (
  id                    uuid primary key default gen_random_uuid(),
  auth_user_id          uuid unique references auth.users (id) on delete set null, -- null = profil uten innlogging (barn, senere)
  display_name          text not null check (btrim(display_name) <> ''),
  managed_by_profile_id uuid references profiles (id) on delete set null,
  created_at            timestamptz not null default now()
);

create table workspaces (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete cascade,
  name             text not null check (btrim(name) <> ''),
  kind             workspace_kind not null,
  owner_profile_id uuid references profiles (id) on delete cascade,
  created_at       timestamptz not null default now(),
  constraint private_has_owner check (kind <> 'private' or owner_profile_id is not null)
);

create table memberships (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  profile_id   uuid not null references profiles (id) on delete cascade,
  role         member_role not null default 'member',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, profile_id)
);
create index memberships_profile_idx on memberships (profile_id);

-- Et privat arbeidsområde har bare én medlem: eieren, som owner.
create function memberships_private_guard() returns trigger language plpgsql set search_path = public as $$
declare
  ws workspaces;
begin
  select * into ws from workspaces where id = new.workspace_id;
  if ws.kind = 'private' and (new.profile_id <> ws.owner_profile_id or new.role <> 'owner') then
    raise exception 'Et privat arbeidsområde kan bare ha eieren som medlem';
  end if;
  return new;
end;
$$;
create trigger memberships_private_guard
  before insert or update on memberships
  for each row execute function memberships_private_guard();

-- ── Prosjekter ──────────────────────────────────────────────────
create table projects (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces (id) on delete cascade,
  name             text not null check (btrim(name) <> ''),
  description      text,
  owner_profile_id uuid references profiles (id) on delete set null,
  status           project_status not null default 'active',
  due_date         date,
  priority         smallint check (priority between 1 and 3),
  progress_method  progress_method not null default 'equal',
  last_activity_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz
);
create index projects_workspace_idx on projects (workspace_id);

create trigger projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

-- ── Elementer: delprosjekter, oppgaver og avtaler ───────────────
create table items (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces (id) on delete cascade,
  project_id          uuid references projects (id) on delete cascade,
  parent_id           uuid references items (id) on delete cascade,
  kind                item_kind not null,
  title               text not null check (btrim(title) <> ''),
  notes               text,
  assignee_profile_id uuid references profiles (id) on delete set null,
  status              item_status not null default 'ready',
  in_inbox            boolean not null default false,
  due_date            date,                                  -- frist (fase 1)
  planned_date        date,                                  -- planlagt dag (fase 2)
  focus_date          date,                                  -- valgt som fokus denne dagen
  estimate_minutes    integer check (estimate_minutes > 0),  -- fase 2
  weight              numeric not null default 1 check (weight > 0), -- fase 3
  is_pickable         boolean not null default false,
  pick_context        pick_context,
  starts_at           timestamptz,                           -- avtale
  ends_at             timestamptz,
  all_day             boolean not null default false,
  location            text,
  waiting_for         text,                                  -- fase 2
  follow_up_date      date,                                  -- fase 2
  count_checklist     boolean not null default false,        -- fase 3
  sort_order          double precision not null default 0,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint subproject_needs_project  check (kind <> 'subproject' or project_id is not null),
  constraint parent_needs_project      check (parent_id is null or project_id is not null),
  constraint parent_not_self           check (parent_id is null or parent_id <> id),
  constraint appointment_needs_start   check (kind <> 'appointment' or starts_at is not null),
  constraint appointment_ends_after    check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint times_only_on_appointment check (kind = 'appointment' or (starts_at is null and ends_at is null))
);
create index items_workspace_idx on items (workspace_id);
create index items_project_idx   on items (project_id);
create index items_parent_idx    on items (parent_id);
create index items_due_idx       on items (due_date) where due_date is not null;
create index items_focus_idx     on items (focus_date) where focus_date is not null;
create index items_starts_idx    on items (starts_at) where starts_at is not null;
create index items_inbox_idx     on items (workspace_id) where in_inbox;
create index items_pickable_idx  on items (workspace_id) where is_pickable;

-- Før lagring: arbeidsområde fra prosjektet, gyldig forelder, fullført-tidspunkt.
create function items_before_write() returns trigger language plpgsql set search_path = public as $$
declare
  proj_ws  uuid;
  par      items;
  cursor_id uuid;
  depth    int := 0;
begin
  if new.project_id is not null then
    select workspace_id into proj_ws from projects where id = new.project_id;
    new.workspace_id := proj_ws;
  end if;

  if new.parent_id is not null then
    select * into par from items where id = new.parent_id;
    if par.kind <> 'subproject' then
      raise exception 'Et element kan bare ligge under et delprosjekt';
    end if;
    if par.project_id is distinct from new.project_id then
      raise exception 'Forelderen må være i samme prosjekt';
    end if;
    -- Hindre sirkler: gå oppover fra forelderen
    cursor_id := new.parent_id;
    while cursor_id is not null loop
      if cursor_id = new.id then
        raise exception 'Et delprosjekt kan ikke ligge under seg selv';
      end if;
      depth := depth + 1;
      if depth > 50 then
        raise exception 'For mange nivåer';
      end if;
      select parent_id into cursor_id from items where id = cursor_id;
    end loop;
  end if;

  if new.status = 'done' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger items_before_write
  before insert or update on items
  for each row execute function items_before_write();

-- Etter lagring: flytt barn med når et delprosjekt bytter prosjekt,
-- hold sjekklister i samme arbeidsområde, og oppdater prosjektets aktivitet.
create function items_after_write() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.project_id is not null then
      update projects set last_activity_at = now() where id = old.project_id;
    end if;
    return null;
  end if;

  if tg_op = 'UPDATE' then
    if new.kind = 'subproject' and new.project_id is distinct from old.project_id then
      update items set project_id = new.project_id where parent_id = new.id;
    end if;
    if new.workspace_id is distinct from old.workspace_id then
      update checklist_items set workspace_id = new.workspace_id where item_id = new.id;
    end if;
    if old.project_id is not null and old.project_id is distinct from new.project_id then
      update projects set last_activity_at = now() where id = old.project_id;
    end if;
  end if;

  if new.project_id is not null then
    update projects set last_activity_at = now() where id = new.project_id;
  end if;
  return null;
end;
$$;
create trigger items_after_write
  after insert or update or delete on items
  for each row execute function items_after_write();

-- Når et prosjekt bytter arbeidsområde, følger elementene med.
create function projects_after_update() returns trigger language plpgsql set search_path = public as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    update items set workspace_id = new.workspace_id where project_id = new.id;
  end if;
  return null;
end;
$$;
create trigger projects_after_update
  after update on projects
  for each row execute function projects_after_update();

-- ── Sjekklister ─────────────────────────────────────────────────
create table checklist_items (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  item_id      uuid not null references items (id) on delete cascade,
  text         text not null check (btrim(text) <> ''),
  is_done      boolean not null default false,
  sort_order   double precision not null default 0,
  created_at   timestamptz not null default now()
);
create index checklist_items_item_idx on checklist_items (item_id);

create function checklist_items_before_write() returns trigger language plpgsql set search_path = public as $$
declare
  it items;
begin
  select * into it from items where id = new.item_id;
  if it.kind <> 'task' then
    raise exception 'Sjekklister kan bare høre til en oppgave';
  end if;
  new.workspace_id := it.workspace_id;
  return new;
end;
$$;
create trigger checklist_items_before_write
  before insert or update on checklist_items
  for each row execute function checklist_items_before_write();

-- Aktivitet i sjekklisten teller som aktivitet i prosjektet.
create function checklist_items_after_write() returns trigger language plpgsql set search_path = public as $$
declare
  proj uuid;
begin
  if tg_op = 'DELETE' then
    select project_id into proj from items where id = old.item_id;
  else
    select project_id into proj from items where id = new.item_id;
  end if;
  if proj is not null then
    update projects set last_activity_at = now() where id = proj;
  end if;
  return null;
end;
$$;
create trigger checklist_items_after_write
  after insert or update or delete on checklist_items
  for each row execute function checklist_items_after_write();

-- ── Brukslogg ───────────────────────────────────────────────────
create table usage_events (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles (id) on delete cascade,
  event       text not null check (btrim(event) <> ''),
  duration_ms integer check (duration_ms >= 0),
  created_at  timestamptz not null default now()
);
create index usage_events_profile_idx on usage_events (profile_id, created_at);

-- ── RLS: på for alt. Policyer kommer i steg 3. ──────────────────
alter table organizations   enable row level security;
alter table profiles        enable row level security;
alter table workspaces      enable row level security;
alter table memberships     enable row level security;
alter table projects        enable row level security;
alter table items           enable row level security;
alter table checklist_items enable row level security;
alter table usage_events    enable row level security;
