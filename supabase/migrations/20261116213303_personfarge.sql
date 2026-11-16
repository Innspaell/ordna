-- Personfarge: hver velger sin egen farge (barn også). Fast palett, null = automatisk.
alter table profiles add column color text
  constraint profiles_color check (color is null or color in (
    '#0e7490', '#be185d', '#7c3aed', '#4338ca', '#0f766e', '#4d7c0f', '#a21caf', '#0369a1'
  ));

-- Innloggede kan bare endre navn og farge på profilen (RLS: bare sin egen).
-- Hvem som styrer profilen og innloggingskoblingen endres bare av serveren.
revoke update on profiles from authenticated;
grant update (display_name, color) on profiles to authenticated;
