# 08 · Base de datos — DIY Legal

> Dos planos de datos: (A) **Postgres privado del usuario** en Supabase con **RLS**, y (B) **datos de referencia globales** como caches JSON / mirror SQLite (capa de datos del demo), opcionalmente espejados a tablas de referencia. DDL, enums, índices y políticas.
> Versión 3.0 · Mayo 2026

---

## 1. Qué va en Postgres y qué no

| Dato | Dónde | Por qué |
|---|---|---|
| Cuentas, perfil, idioma, consentimiento | **Postgres (A)** | Privado, por usuario. |
| Casos del usuario (EOIR/USCIS/NVC) y su último estado | **Postgres (A)** | PII, por usuario, RLS. |
| Seguimiento y pagos AAF del usuario | **Postgres (A)** | PII/financiero. |
| Documentos (referencias; binario cifrado en Storage) | **Postgres (A) + Storage** | Privado, cifrado client-side. |
| Jobs de consulta (scrape jobs) + DLQ | **Postgres (A)** | Estado por usuario. |
| IA: hilos/mensajes/embeddings | **Postgres (A) + pgvector** | Privado. |
| Suscripciones/billing | **Postgres (A)** | Gating por plan. |
| Cortes, jueces, processing times, tarifas, civics, vacunas, DMV, REAL ID, visa bulletin | **Caches (B)**: JSON/SQLite (doc 09) | **Globales, sin PII**; diseño del demo. Opcional espejo a tablas `ref_*`. |

> Regla: **datos por-usuario → Postgres con RLS**; **datos globales de referencia → caches de la Capa B** (y, si se requiere consultarlos con SQL/joins, espejarlos a tablas `ref_*` de solo lectura vía cron). Dinero en **centavos**, fechas en **UTC**, IDs **UUID** (sistemas-profesionales-empresariales).

---

## 2. Enums

```sql
create type plan_tier    as enum ('free','pro');                 -- sin 'familia'
create type case_source  as enum ('eoir','uscis','nvc');
create type case_status  as enum ('active','closed','unknown');
create type scrape_status as enum ('queued','running','done','failed','dead');
create type aaf_branch    as enum ('A','B','C','D');
create type aaf_status    as enum ('not_due','due_soon','due_now','overdue','paid_current','case_closed');
create type doc_kind      as enum ('upload','aaf_motion','aaf_receipt','i94','other');
create type notif_kind    as enum ('case_update','hearing','aaf_due','deadline','system');
```

---

## 3. Esquema (Capa A — privado, con RLS)

### 3.1 profiles
```sql
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text,
  language        text not null default 'es' check (language in ('es','en')),
  plan            plan_tier not null default 'free',
  consent_version text,                 -- T&C/UPL aceptados (doc 10 §2)
  consent_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz           -- soft-delete → purga 30d (doc 10 §7)
);
```

### 3.2 cases (referencia a EOIR/USCIS/NVC + último estado)
```sql
create table cases (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  source        case_source not null,
  -- identificadores (cifrar A-Number a nivel columna; enmascarar en UI, doc 10 §4)
  alien_number_enc bytea,               -- EOIR (pgcrypto)
  receipt          text,                -- USCIS (IOE/EAC/...+10)
  nvc_case_number  text,                -- NVC
  nationality      text,                -- EOIR
  -- último estado (snapshot del resultado oficial)
  status         case_status not null default 'unknown',
  last_result    jsonb,                 -- CaseInfoResponse / Torch / NVC normalizado
  last_synced_at timestamptz,
  cooldown_until timestamptz,           -- anti-abuso/costo (doc 09 §15)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on cases (user_id);
create index on cases (user_id, source);
```

### 3.3 case_events (timeline de cambios)
```sql
create table case_events (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references cases(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null,             -- 'status_change','hearing_set',...
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
create index on case_events (case_id, created_at desc);
```

### 3.4 aaf_tracking (1:1 con un caso de asilo) + aaf_payments
```sql
create table aaf_tracking (
  id                    uuid primary key default gen_random_uuid(),
  case_id               uuid not null references cases(id) on delete cascade,
  user_id               uuid not null references profiles(id) on delete cascade,
  branch                aaf_branch,
  fiscal_year           int,
  amount_cents          int,            -- FY2026 = 10200
  next_due_date         date,
  status                aaf_status not null default 'not_due',
  days_until_due        int,
  filing_date           date,
  filing_date_confidence text check (filing_date_confidence in ('high','medium','low')),
  active_pause          text,           -- p. ej. court order ASAP
  last_calculated_at    timestamptz,
  unique (case_id)
);
create table aaf_payments (
  id           uuid primary key default gen_random_uuid(),
  tracking_id  uuid not null references aaf_tracking(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  amount_cents int not null,
  paid_on      date not null,
  receipt_doc  uuid references documents(id),
  created_at   timestamptz not null default now()
);
```

### 3.5 documents (binario cifrado en Storage; aquí metadata)
```sql
create table documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  case_id       uuid references cases(id) on delete set null,
  kind          doc_kind not null default 'upload',
  storage_path  text not null,          -- bucket privado
  filename      text,
  is_encrypted  boolean not null default true,  -- AES-GCM client-side (doc 10 §4.3)
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index on documents (user_id, case_id);
```

### 3.6 scrape_jobs (cola observable) + DLQ
```sql
create table scrape_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  case_id       uuid references cases(id) on delete cascade,
  source        case_source not null,        -- eoir | nvc (uscis suele ser síncrono)
  status        scrape_status not null default 'queued',
  attempts      int not null default 0,
  idempotency_key text,
  result        jsonb,
  error_kind    text,                          -- doc 07 §2
  scheduled_at  timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index on scrape_jobs (status, scheduled_at);
create unique index on scrape_jobs (idempotency_key) where idempotency_key is not null;
-- status='dead' = movido a DLQ tras agotar reintentos (doc 07 §5)
```

### 3.7 IA (pgvector)
```sql
create extension if not exists vector;
create table ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text, created_at timestamptz not null default now()
);
create table ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references ai_threads(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);
create table ai_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  source_ref text,            -- doc/caso del usuario (RAG, Pro)
  embedding vector(768),
  content text
);
create index on ai_embeddings using ivfflat (embedding vector_cosine_ops);
```

### 3.8 notifications · subscriptions · idempotency · outbox · audit
```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind notif_kind not null, title text, body text,   -- sin PII sensible (doc 10/11)
  read_at timestamptz, created_at timestamptz not null default now()
);
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan plan_tier not null default 'free',
  stripe_customer_id text, stripe_subscription_id text,
  status text, current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
create table idempotency_keys (
  key text primary key, user_id uuid references profiles(id) on delete cascade,
  endpoint text, response jsonb, created_at timestamptz not null default now()
);
create table domain_events (   -- outbox → notificaciones/integraciones
  id uuid primary key default gen_random_uuid(),
  aggregate text, aggregate_id uuid, type text, payload jsonb,
  published boolean not null default false, created_at timestamptz not null default now()
);
create table audit_log (
  id bigint generated always as identity primary key,
  user_id uuid, action text, target text, meta jsonb,
  created_at timestamptz not null default now()
);
```

---

## 4. RLS (Row Level Security)

```sql
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

-- Patrón: el dueño ve/edita lo suyo
create policy own_rows_profiles on profiles
  using (id = auth.uid()) with check (id = auth.uid());

create policy own_rows_cases on cases
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- (repetir el patrón user_id = auth.uid() para las demás tablas con user_id)

-- El WORKER escribe resultados con service role (bypassa RLS):
-- usar la service key SOLO en el worker/server, nunca en el cliente (doc 06/07).
```

> Storage: bucket privado por usuario; políticas que solo permiten al dueño leer/escribir su carpeta; binarios **cifrados client-side** (el servidor no descifra).

---

## 5. Capa B — datos de referencia (caches / mirror)

- Viven como **JSON** (`data/*.json`, `lib/<área>/data/*.json`) y **mirror SQLite→JSON** (processing times), generados por crons (doc 09). **Sin PII**, compartidos por todos los usuarios.
- **Opcional**: espejar a tablas `ref_*` de solo lectura (p. ej. `ref_courts`, `ref_judges`, `ref_processing_times`, `ref_fees`, `ref_civics`) vía cron, si se necesita SQL/joins o filtrado del lado servidor. No llevan RLS de usuario (son públicas) pero se exponen solo por endpoints con flag.
- Caché de captcha/resultados externos: en memoria/efímero (doc 09 §3), no en Postgres.

---

## 6. Índices, integridad y rendimiento
- Índices por `user_id` y por `(user_id, source)` en `cases`; por `status, scheduled_at` en `scrape_jobs`; ivfflat en embeddings.
- FKs con `on delete cascade` para borrado limpio (soporta soft-delete + purga, doc 10 §7).
- `updated_at` por trigger; consultas paginadas por **cursor** (doc 07 §7).
- Migraciones versionadas en `supabase/migrations/*`.

---

**Doc 08 · Base de datos** · v3.0 · Mayo 2026. Relacionados: 06 (capas), 07 (API/RLS/worker), 09 (caches/mirror), 10 (cifrado/PII/retención), 13 (AAF). Mantener bajo `/docs/`.
