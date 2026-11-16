-- Ordna – steg 4: automatisk oppsett ved første innlogging.
-- Kalles av appen rett etter innlogging. Trygg å kalle flere ganger.

create function ensure_my_setup() returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  uid     uuid := auth.uid();
  pid     uuid;
  oid     uuid;
  ws_priv uuid;
  ws_jobb uuid;
  name    text;
begin
  if uid is null then
    raise exception 'Du er ikke logget inn';
  end if;

  -- Hindre at to samtidige kall lager to oppsett for samme bruker
  perform pg_advisory_xact_lock(hashtext('ensure_my_setup:' || uid::text));

  select id into pid from profiles where auth_user_id = uid;
  if pid is not null then
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
