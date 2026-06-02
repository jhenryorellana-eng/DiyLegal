-- Fase 3 · políticas deny-all explícitas en tablas de sistema (doc 08 §3.8).
-- Estas tablas NO son por-usuario: sólo el server las toca con service_role
-- (que bypassa RLS). La política `using (false)` deniega explícitamente a
-- authenticated/anon y documenta la intención (además limpia el lint INFO).

create policy no_client_access on idempotency_keys
  for all to authenticated, anon using (false) with check (false);
create policy no_client_access on domain_events
  for all to authenticated, anon using (false) with check (false);
create policy no_client_access on audit_log
  for all to authenticated, anon using (false) with check (false);
