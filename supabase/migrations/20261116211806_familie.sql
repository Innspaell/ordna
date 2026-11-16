-- Ordna – familie, første versjon.
-- Lister (handleliste), familieområde, familiemedlemmer laget av en voksen, og innloggingskoder for barn.

-- ── Lister: et prosjekt kan være en enkel liste (handleliste) ──
alter table projects add column kind text not null default 'project' check (kind in ('project', 'list'));

-- ── Innloggingskoder for barn. Bare serveren (service role) leser og skriver. ──
create table child_login_codes (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles (id) on delete cascade,
  code_hash   text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_by_profile_id uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index child_login_codes_profile_idx on child_login_codes (profile_id);
alter table child_login_codes enable row level security;
revoke all on child_login_codes from anon, authenticated;

-- ── Opprett familieområdet (eller hent det som finnes) ──────────
create function create_family_workspace(p_name text default 'Familie') returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  pid uuid := current_profile_id();
  ws  uuid;
  org uuid;
  nm  text := coalesce(nullif(btrim(p_name), ''), 'Familie');
begin
  if pid is null then
    raise exception 'Du er ikke logget inn';
  end if;

  select w.id into ws
    from workspaces w join memberships m on m.workspace_id = w.id
   where m.profile_id = pid and w.kind = 'family'
   order by w.created_at limit 1;
  if ws is not null then
    return ws;
  end if;

  select w.organization_id into org
    from workspaces w join memberships m on m.workspace_id = w.id
   where m.profile_id = pid
   order by (w.kind = 'private') desc, w.created_at limit 1;
  if org is null then
    raise exception 'Fant ingen organisasjon';
  end if;

  insert into workspaces (organization_id, name, kind) values (org, nm, 'family') returning id into ws;
  insert into memberships (workspace_id, profile_id, role) values (ws, pid, 'owner');
  insert into projects (workspace_id, name, kind, owner_profile_id, created_by_profile_id)
    values (ws, 'Handleliste', 'list', pid, pid);
  return ws;
end;
$$;
revoke all on function create_family_workspace(text) from public, anon;
grant execute on function create_family_workspace(text) to authenticated;

-- ── Legg til et familiemedlem. Kalles av serveren med service role etter at innloggingen er laget. ──
-- Serveren sjekker først at den som ber om det, er eier eller admin i familien.
create function admin_add_family_member(p_workspace uuid, p_auth_user_id uuid, p_name text, p_managed_by uuid)
  returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  ws_kind workspace_kind;
begin
  select kind into ws_kind from workspaces where id = p_workspace;
  if ws_kind is distinct from 'family' then
    raise exception 'Ikke et familieområde';
  end if;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Navn mangler';
  end if;

  select id into pid from profiles where auth_user_id = p_auth_user_id;
  if pid is null then
    insert into profiles (auth_user_id, display_name, managed_by_profile_id)
      values (p_auth_user_id, btrim(p_name), p_managed_by) returning id into pid;
  end if;

  insert into memberships (workspace_id, profile_id, role)
    values (p_workspace, pid, case when p_managed_by is null then 'admin'::member_role else 'member'::member_role end)
    on conflict (workspace_id, profile_id) do nothing;
  return pid;
end;
$$;
revoke all on function admin_add_family_member(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function admin_add_family_member(uuid, uuid, text, uuid) to service_role;

-- ── Første innlogging: profiler laget av andre får det de mangler ──
-- Voksne som er lagt til i en familie får Privat og Jobb i samme organisasjon. Barn får ingenting ekstra.
create or replace function ensure_my_setup() returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  uid     uuid := auth.uid();
  pid     uuid;
  managed uuid;
  oid     uuid;
  ws_priv uuid;
  ws_jobb uuid;
  name    text;
begin
  if uid is null then
    raise exception 'Du er ikke logget inn';
  end if;

  perform pg_advisory_xact_lock(hashtext('ensure_my_setup:' || uid::text));

  select id, managed_by_profile_id into pid, managed from profiles where auth_user_id = uid;

  if pid is not null then
    -- Voksen lagt til av andre: lag Privat og Jobb første gang
    if managed is null and not exists (
      select 1 from workspaces w join memberships m on m.workspace_id = w.id
       where m.profile_id = pid and w.kind = 'private'
    ) then
      select w.organization_id into oid
        from workspaces w join memberships m on m.workspace_id = w.id
       where m.profile_id = pid order by w.created_at limit 1;
      if oid is not null then
        insert into workspaces (organization_id, name, kind, owner_profile_id)
          values (oid, 'Privat', 'private', pid) returning id into ws_priv;
        insert into workspaces (organization_id, name, kind)
          values (oid, 'Jobb', 'work') returning id into ws_jobb;
        insert into memberships (workspace_id, profile_id, role)
          values (ws_priv, pid, 'owner'), (ws_jobb, pid, 'owner');
      end if;
    end if;
    return pid;
  end if;

  select coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1), 'Meg')
    into name
    from auth.users u
   where u.id = uid;

  insert into organizations (name) values (name) returning id into oid;
  insert into profiles (auth_user_id, display_name) values (uid, name) returning id into pid;
  insert into workspaces (organization_id, name, kind, owner_profile_id)
    values (oid, 'Privat', 'private', pid) returning id into ws_priv;
  insert into workspaces (organization_id, name, kind)
    values (oid, 'Jobb', 'work') returning id into ws_jobb;
  insert into memberships (workspace_id, profile_id, role)
    values (ws_priv, pid, 'owner'), (ws_jobb, pid, 'owner');

  return pid;
end;
$$;
revoke all on function ensure_my_setup() from public, anon;
grant execute on function ensure_my_setup() to authenticated;
