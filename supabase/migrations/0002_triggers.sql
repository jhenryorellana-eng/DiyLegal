-- Fase 3 · trigger updated_at (doc 08 §6) en las tablas que tienen esa columna.
create extension if not exists moddatetime schema extensions;

create trigger handle_updated_at before update on profiles
  for each row execute procedure extensions.moddatetime (updated_at);
create trigger handle_updated_at before update on cases
  for each row execute procedure extensions.moddatetime (updated_at);
create trigger handle_updated_at before update on subscriptions
  for each row execute procedure extensions.moddatetime (updated_at);
