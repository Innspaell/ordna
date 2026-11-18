-- Handlelisten oppdateres fortløpende: Realtime sender endringer i items til innloggede som har lov til å se dem (RLS gjelder).
alter publication supabase_realtime add table items;
