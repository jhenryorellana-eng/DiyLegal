-- Fase 3 · hardening (advisor 0028/0029). Las funciones SECURITY DEFINER se
-- crean con EXECUTE para PUBLIC, lo que las expone vía /rest/v1/rpc a anon y
-- authenticated. Ninguna debe ser invocable por clientes:
--   · handle_new_user()      → sólo la dispara el trigger (contexto interno).
--   · purge_deleted_accounts() → sólo la ejecuta el job pg_cron (rol postgres).
-- Revocar EXECUTE cierra la superficie sin afectar trigger ni cron.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.purge_deleted_accounts() from public, anon, authenticated;
