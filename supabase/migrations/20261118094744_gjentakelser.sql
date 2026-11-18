-- Gjentakelser: en serie beskriver mønsteret, og hver gang finnes som en egen rad i items (alle legges inn med en gang).
create type repeat_freq as enum ('daily', 'weekly', 'monthly', 'yearly');

create table item_series (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  freq         repeat_freq not null,
  weekdays     smallint[],        -- ukentlig: 1 = mandag … 7 = søndag
  starts_on    date not null,
  until_date   date,              -- til og med; kan bare mangle for hvert år (merkedager)
  created_by_profile_id uuid references profiles (id) on delete set null default current_profile_id(),
  created_at   timestamptz not null default now(),
  constraint item_series_until_needed check (freq = 'yearly' or until_date is not null),
  constraint item_series_until_range  check (until_date is null or (until_date >= starts_on and until_date <= starts_on + interval '2 years')),
  constraint item_series_weekdays     check (
    (freq <> 'weekly' and weekdays is null)
    or (freq = 'weekly' and weekdays is not null and cardinality(weekdays) between 1 and 7 and weekdays <@ '{1,2,3,4,5,6,7}'::smallint[])
  )
);
create index item_series_workspace_idx on item_series (workspace_id);

alter table items
  add column series_id       uuid references item_series (id) on delete set null,
  add column occurrence_date date; -- hvilken gang i serien (lokal dato)
create index items_series_idx on items (series_id, occurrence_date);

-- En ting kan bare høre til en serie i samme område; ellers kobles den fra.
create function items_series_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.series_id is not null
     and not exists (select 1 from item_series s where s.id = new.series_id and s.workspace_id = new.workspace_id) then
    new.series_id := null;
    new.occurrence_date := null;
  end if;
  return new;
end $$;
create trigger items_series_guard
  before insert or update of series_id, workspace_id on items
  for each row execute function items_series_guard();
revoke execute on function items_series_guard() from public, anon, authenticated;

alter table item_series enable row level security;
create policy item_series_select on item_series for select to authenticated using (is_member(workspace_id));
create policy item_series_insert on item_series for insert to authenticated
  with check (is_member(workspace_id, 'member') and created_by_profile_id is not distinct from current_profile_id());
create policy item_series_update on item_series for update to authenticated
  using (is_member(workspace_id, 'member')) with check (is_member(workspace_id, 'member'));
create policy item_series_delete on item_series for delete to authenticated using (is_member(workspace_id, 'member'));
revoke all on item_series from anon, authenticated;
grant select, insert, update, delete on item_series to authenticated;
