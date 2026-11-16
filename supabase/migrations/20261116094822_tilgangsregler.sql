-- Ordna – steg 3: tilgangsregler
-- Tilgang styres av medlemskap i arbeidsområdet. Rangering: owner > admin > member > viewer.
-- Enum-rekkefølgen er owner, admin, member, viewer, så "minst admin" betyr role <= 'admin'.

-- ── Hvem opprettet raden (trengs for "medlem kan slette egne rader") ──
alter table projects        add column created_by_profile_id uuid references profiles (id) on delete set null;
alter table items           add column created_by_profile_id uuid references profiles (id) on delete set null;
alter table checklist_items add column created_by_profile_id uuid references profiles (id) on delete set null;

-- ── Hjelpefunksjoner ────────────────────────────────────────────
create function current_profile_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from profiles where auth_user_id = auth.uid();
$$;

create function is_member(ws uuid, min_role member_role default 'viewer') returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from memberships m
    join profiles p on p.id = m.profile_id
    where m.workspace_id = ws
      and p.auth_user_id = auth.uid()
      and m.role <= min_role
  );
$$;

create function shares_workspace_with(profile uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from memberships theirs
    join memberships mine on mine.workspace_id = theirs.workspace_id
    where theirs.profile_id = profile
      and mine.profile_id = current_profile_id()
  );
$$;

revoke all on function current_profile_id() from public, anon;
revoke all on function is_member(uuid, member_role) from public, anon;
revoke all on function shares_workspace_with(uuid) from public, anon;
grant execute on function current_profile_id() to authenticated, service_role;
grant execute on function is_member(uuid, member_role) to authenticated, service_role;
grant execute on function shares_workspace_with(uuid) to authenticated, service_role;

-- created_by settes alltid fra innlogget bruker ved opprettelse (kan ikke forfalskes
-- fordi policyen krever at den er lik current_profile_id()).
alter table projects        alter column created_by_profile_id set default current_profile_id();
alter table items           alter column created_by_profile_id set default current_profile_id();
alter table checklist_items alter column created_by_profile_id set default current_profile_id();

-- ── Bokføring som ikke skal stoppes av RLS ──────────────────────
-- Etter-triggerne oppdaterer siste aktivitet og flytter barn med. Selve endringen
-- brukeren gjorde har allerede passert RLS, så bokføringen kjøres med eierens rettigheter.
alter function items_after_write() security definer;
alter function checklist_items_after_write() security definer;
-- Vakten for private områder må se arbeidsområdet uansett hvem som spør.
alter function memberships_private_guard() security definer;

-- ── Policyer ────────────────────────────────────────────────────
-- organizations: les hvis du er medlem av et arbeidsområde i organisasjonen.
create policy organizations_select on organizations for select to authenticated
  using (exists (select 1 from workspaces w where w.organization_id = organizations.id and is_member(w.id)));

-- profiles: les egen og de du deler arbeidsområde med; endre bare egen.
create policy profiles_select on profiles for select to authenticated
  using (auth_user_id = auth.uid() or shares_workspace_with(id));
create policy profiles_update on profiles for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- workspaces: les som medlem, endre som admin, slette som eier.
create policy workspaces_select on workspaces for select to authenticated
  using (is_member(id));
create policy workspaces_update on workspaces for update to authenticated
  using (is_member(id, 'admin'))
  with check (is_member(id, 'admin'));
create policy workspaces_delete on workspaces for delete to authenticated
  using (is_member(id, 'owner'));

-- memberships: les som medlem; admin styrer, men bare eier kan røre eier-rader.
create policy memberships_select on memberships for select to authenticated
  using (is_member(workspace_id));
create policy memberships_insert on memberships for insert to authenticated
  with check (is_member(workspace_id, 'admin') and (role <> 'owner' or is_member(workspace_id, 'owner')));
create policy memberships_update on memberships for update to authenticated
  using (is_member(workspace_id, 'admin') and (role <> 'owner' or is_member(workspace_id, 'owner')))
  with check (is_member(workspace_id, 'admin') and (role <> 'owner' or is_member(workspace_id, 'owner')));
create policy memberships_delete on memberships for delete to authenticated
  using (is_member(workspace_id, 'admin') and (role <> 'owner' or is_member(workspace_id, 'owner')));

-- projects, items, checklist_items: samme mønster.
create policy projects_select on projects for select to authenticated
  using (is_member(workspace_id));
create policy projects_insert on projects for insert to authenticated
  with check (is_member(workspace_id, 'member') and created_by_profile_id is not distinct from current_profile_id());
create policy projects_update on projects for update to authenticated
  using (is_member(workspace_id, 'member'))
  with check (is_member(workspace_id, 'member'));
create policy projects_delete on projects for delete to authenticated
  using (is_member(workspace_id, 'admin') or (is_member(workspace_id, 'member') and created_by_profile_id = current_profile_id()));

create policy items_select on items for select to authenticated
  using (is_member(workspace_id));
create policy items_insert on items for insert to authenticated
  with check (is_member(workspace_id, 'member') and created_by_profile_id is not distinct from current_profile_id());
create policy items_update on items for update to authenticated
  using (is_member(workspace_id, 'member'))
  with check (is_member(workspace_id, 'member'));
create policy items_delete on items for delete to authenticated
  using (is_member(workspace_id, 'admin') or (is_member(workspace_id, 'member') and created_by_profile_id = current_profile_id()));

create policy checklist_items_select on checklist_items for select to authenticated
  using (is_member(workspace_id));
create policy checklist_items_insert on checklist_items for insert to authenticated
  with check (is_member(workspace_id, 'member') and created_by_profile_id is not distinct from current_profile_id());
create policy checklist_items_update on checklist_items for update to authenticated
  using (is_member(workspace_id, 'member'))
  with check (is_member(workspace_id, 'member'));
create policy checklist_items_delete on checklist_items for delete to authenticated
  using (is_member(workspace_id, 'admin') or (is_member(workspace_id, 'member') and created_by_profile_id = current_profile_id()));

-- usage_events: bare egne, bare lese og skrive.
create policy usage_events_select on usage_events for select to authenticated
  using (profile_id = current_profile_id());
create policy usage_events_insert on usage_events for insert to authenticated
  with check (profile_id = current_profile_id());

-- anon skal ikke ha noe i public i det hele tatt.
revoke all on all tables in schema public from anon;
