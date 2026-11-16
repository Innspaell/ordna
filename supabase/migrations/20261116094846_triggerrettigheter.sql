-- Ordna – steg 3b: triggerfunksjoner skal ikke kunne kalles via API-et.
-- Triggere trenger ikke EXECUTE-rettighet for å fyre, så den fjernes for alle roller.
revoke execute on function set_updated_at()                 from public, anon, authenticated;
revoke execute on function memberships_private_guard()      from public, anon, authenticated;
revoke execute on function items_before_write()             from public, anon, authenticated;
revoke execute on function items_after_write()              from public, anon, authenticated;
revoke execute on function projects_after_update()          from public, anon, authenticated;
revoke execute on function checklist_items_before_write()   from public, anon, authenticated;
revoke execute on function checklist_items_after_write()    from public, anon, authenticated;
