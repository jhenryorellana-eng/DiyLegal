-- Fase 3 · auto-provisión del perfil al registrarse (doc 08 §3.1, doc 10 §2).
-- Trigger SECURITY DEFINER (corre como owner → bypassa RLS para el INSERT inicial).
-- search_path = '' y todo calificado por schema (hardening Supabase: evita
-- secuestro de search_path). El idioma sale del metadata del signup (es/en),
-- por defecto 'es'. El consentimiento se registra después, en el onboarding.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, language, full_name)
  values (
    new.id,
    case
      when new.raw_user_meta_data ->> 'language' in ('es', 'en')
        then new.raw_user_meta_data ->> 'language'
      else 'es'
    end,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
