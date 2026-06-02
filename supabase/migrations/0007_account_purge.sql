-- Fase 3 · retención y borrado (doc 10 §7). Soft-delete = `profiles.deleted_at`
-- (lo setea el usuario vía RLS). Un job pg_cron purga las cuentas con más de 30
-- días en soft-delete, borrando de auth.users → cascade a profiles y a todo lo
-- demás (FKs on delete cascade). Cancelable dentro de la ventana (deleted_at = null).

create extension if not exists pg_cron;

create or replace function public.purge_deleted_accounts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  purged integer;
begin
  delete from auth.users u
  using public.profiles p
  where p.id = u.id
    and p.deleted_at is not null
    and p.deleted_at < now() - interval '30 days';
  get diagnostics purged = row_count;
  return purged;
end;
$$;

-- Programar diariamente a las 03:00 UTC (idempotente: desprograma si ya existía).
do $$
begin
  perform cron.unschedule('purge-deleted-accounts');
exception
  when others then null; -- el job aún no existe: nada que desprogramar
end;
$$;

select cron.schedule(
  'purge-deleted-accounts',
  '0 3 * * *',
  $$select public.purge_deleted_accounts()$$
);
