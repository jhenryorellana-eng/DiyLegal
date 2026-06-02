# Fase 3 — Capa A núcleo (Supabase Auth + Postgres + RLS + cifrado) · Blueprint

> Fuente de verdad: **doc 08** (base de datos) + doc 10 §2/§4/§7 (UPL/cifrado/retención) + doc 07 (auth/clientes) + doc 02 (borrado de cuenta).
> Proyecto Supabase REAL: **"Gyi Legal"** ref `jxmrhxlzjlxforvhxuuv` (sa-east-1, PG17.6, ACTIVE_HEALTHY). Estado: **vacío** (0 tablas / 0 migraciones). `pgcrypto` ya instalada; `vector` y `pg_cron` disponibles.
> Reglas duras: **RLS `user_id = auth.uid()` en TODAS las tablas** · dinero en centavos · fechas UTC · IDs UUID · service_role NUNCA al cliente · A-Number cifrado + masking.

---

## Estado actual
- No existe `supabase/`, `lib/supabase/`, ni deps `@supabase/*`. Greenfield.
- Las migraciones se **versionan** en `supabase/migrations/*.sql` y se **aplican** al proyecto real con `apply_migration` (decisión previa, [[diy-legal-supabase]]).

---

## Decisiones a confirmar (cambian el enfoque)

### D1 — Cifrado del A-Number (doc 10 §4.4: "pgcrypto **o** app-level")
**Recomendado: app-level AES-256-GCM.** Cifrar en Node (server/worker) y guardar `alien_number_enc bytea` (formato `iv(12) ‖ ciphertext ‖ authTag(16)`). Clave `APP_ENCRYPTION_KEY` en `.env.local`.
- Ventaja: la clave **nunca** toca la DB ni aparece en SQL/`pg_stat_statements`/logs (pgcrypto pasando la clave en el query la expone). Portable, no acopla a Vault. El server ya es el guardián de secretos.
- Alternativa: pgcrypto + Supabase Vault (DB-native, más complejo).

### D2 — Aplicar migraciones al proyecto real "Gyi Legal" AHORA
**Recomendado: sí**, versionar en `supabase/migrations/` y aplicar con `apply_migration` (única forma de probar Auth/RLS de verdad). Es DDL aditivo sobre una DB vacía (bajo riesgo). Confirmar por ser acción sobre infra real.

### D3 — Credenciales runtime (BLOQUEO parcial)
- DDL/migraciones/tests RLS: **no** requieren claves (van por el connector MCP).
- El wiring runtime de la app (clientes Supabase) necesita en `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` (la sé), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (obtenible vía connector), **`SUPABASE_SERVICE_ROLE_KEY`** (secreta → la debe proveer el usuario).
- Propuesta: avanzar S1–S2 (esquema+RLS+cifrado, todo verificable por SQL) sin bloquear; el wiring de clientes (S3) usa la anon key del connector y queda listo para la service_role cuando el usuario la cargue.

---

## Slices (orden de construcción)

**S1 — Esquema + RLS** (`apply_migration`)
- Extensiones (`vector`), enums (8: plan_tier, case_source, case_status, scrape_status, aaf_branch, aaf_status, doc_kind, notif_kind).
- Tablas (doc 08 §3): profiles, cases, case_events, aaf_tracking, aaf_payments, documents, scrape_jobs(+DLQ), ai_threads/messages/embeddings, notifications, subscriptions, idempotency_keys, domain_events, audit_log + índices.
- Trigger `updated_at` (moddatetime/plpgsql) en tablas con esa columna.
- **RLS `enable` + policy `user_id = auth.uid()`** en TODAS las tablas con datos de usuario (profiles por `id`).
- Verificación: `get_advisors security` limpio (sin tablas sin RLS); test RLS negativo por SQL (usuario A no ve filas de B) usando `set local role authenticated` + `request.jwt.claims`.

**S2 — Cifrado A-Number + masking**
- `lib/crypto/aes.ts` (AES-256-GCM encrypt/decrypt, clave de env) + `lib/crypto/mask.ts` (`maskANumber` → `A1**-***-789`).
- Tests unitarios (round-trip, tamper→falla auth tag, masking).
- `.env.local.example`: `APP_ENCRYPTION_KEY`.

**S3 — Clientes Supabase** (deps `@supabase/supabase-js` + `@supabase/ssr`)
- `lib/supabase/{server,client,middleware,admin}.ts` (admin = service_role solo server). Tipos generados (`generate_typescript_types`) → `types/supabase.ts`.
- `middleware.ts` (refresh de sesión). Helper `getUser()`.

**S4 — Onboarding + consentimiento versionado + idioma**
- Server actions / API para crear `profiles` (idioma ES/EN, `consent_version`+`consent_at`). Constante de versión de consentimiento. Trigger/políticas para auto-crear profile en signup (o handle_new_user).

**S5 — Soft-delete + purga 30d**
- Soft-delete (`deleted_at`) + job `pg_cron` de purga a los 30 días (cancelable en ventana). RPC de borrado de cuenta.

**S6 — Integración + verificación**
- `get_advisors` (security+performance) limpio · tests RLS · `.env.local.example` actualizado · `tasks/todo.md` (bitácora) · commit + push.

---

## Guardrails (no negociables)
1. RLS en TODAS las tablas de usuario; tests negativos obligatorios (doc 10 §6, checklist).
2. service_role solo server-side (`lib/supabase/admin.ts`), nunca expuesta al cliente.
3. A-Number cifrado a nivel columna + masking en UI/logs.
4. Claves reales solo en `.env.local` (git-ignored); nunca al repo.
5. Consentimiento UPL versionado en onboarding.
