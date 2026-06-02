-- Fase 3 · RLS (doc 08 §4, doc 10 §6). Cada usuario sólo ve/edita lo suyo
-- (user_id = auth.uid()). El worker/server usa service_role (bypassa RLS); la
-- service key NUNCA va al cliente. Las tablas de sistema habilitan RLS sin
-- política permisiva → sólo accesibles vía service_role.

-- Tablas con datos de usuario
alter table profiles      enable row level security;
alter table cases         enable row level security;
alter table case_events   enable row level security;
alter table aaf_tracking  enable row level security;
alter table aaf_payments  enable row level security;
alter table documents     enable row level security;
alter table scrape_jobs   enable row level security;
alter table ai_threads    enable row level security;
alter table ai_messages   enable row level security;
alter table ai_embeddings enable row level security;
alter table notifications enable row level security;
alter table subscriptions enable row level security;

-- profiles: el dueño es la propia fila (id = auth.uid())
create policy own_profiles on profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- patrón user_id = auth.uid() para el resto
create policy own_cases on cases
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_case_events on case_events
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_aaf_tracking on aaf_tracking
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_aaf_payments on aaf_payments
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_documents on documents
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_scrape_jobs on scrape_jobs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_ai_threads on ai_threads
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_ai_messages on ai_messages
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_ai_embeddings on ai_embeddings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_notifications on notifications
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_subscriptions on subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tablas de sistema: RLS on sin política → sólo service_role (server) accede.
alter table idempotency_keys enable row level security;
alter table domain_events    enable row level security;
alter table audit_log        enable row level security;
