-- Fase 3 · Capa A — esquema base (doc 08 §2-3, §6).
-- Datos privados por usuario; RLS se habilita en 0003. Dinero en centavos,
-- fechas UTC, IDs UUID. El A-Number se guarda CIFRADO (bytea, AES-256-GCM
-- app-level, doc 10 §4.4); el servidor descifra, la DB sólo ve bytes opacos.

create extension if not exists vector;

-- 8 enums (doc 08 §2)
create type plan_tier     as enum ('free', 'pro');
create type case_source   as enum ('eoir', 'uscis', 'nvc');
create type case_status   as enum ('active', 'closed', 'unknown');
create type scrape_status as enum ('queued', 'running', 'done', 'failed', 'dead');
create type aaf_branch    as enum ('A', 'B', 'C', 'D');
create type aaf_status    as enum ('not_due', 'due_soon', 'due_now', 'overdue', 'paid_current', 'case_closed');
create type doc_kind      as enum ('upload', 'aaf_motion', 'aaf_receipt', 'i94', 'other');
create type notif_kind    as enum ('case_update', 'hearing', 'aaf_due', 'deadline', 'system');

-- profiles (1:1 con auth.users)
create table profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text,
  language        text not null default 'es' check (language in ('es', 'en')),
  plan            plan_tier not null default 'free',
  consent_version text,
  consent_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- cases (referencia EOIR/USCIS/NVC + último estado)
create table cases (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles (id) on delete cascade,
  source           case_source not null,
  alien_number_enc bytea,
  receipt          text,
  nvc_case_number  text,
  nationality      text,
  status           case_status not null default 'unknown',
  last_result      jsonb,
  last_synced_at   timestamptz,
  cooldown_until   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index cases_user_id_idx on cases (user_id);
create index cases_user_source_idx on cases (user_id, source);

-- case_events (timeline)
create table case_events (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references cases (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  kind       text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
create index case_events_case_created_idx on case_events (case_id, created_at desc);

-- documents (metadata; binario cifrado client-side en Storage). Antes de
-- aaf_payments porque éste referencia documents(id).
create table documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  case_id      uuid references cases (id) on delete set null,
  kind         doc_kind not null default 'upload',
  storage_path text not null,
  filename     text,
  is_encrypted boolean not null default true,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index documents_user_case_idx on documents (user_id, case_id);

-- aaf_tracking (1:1 con un caso) + aaf_payments
create table aaf_tracking (
  id                     uuid primary key default gen_random_uuid(),
  case_id                uuid not null references cases (id) on delete cascade,
  user_id                uuid not null references profiles (id) on delete cascade,
  branch                 aaf_branch,
  fiscal_year            int,
  amount_cents           int,
  next_due_date          date,
  status                 aaf_status not null default 'not_due',
  days_until_due         int,
  filing_date            date,
  filing_date_confidence text check (filing_date_confidence in ('high', 'medium', 'low')),
  active_pause           text,
  last_calculated_at     timestamptz,
  unique (case_id)
);
create table aaf_payments (
  id           uuid primary key default gen_random_uuid(),
  tracking_id  uuid not null references aaf_tracking (id) on delete cascade,
  user_id      uuid not null references profiles (id) on delete cascade,
  amount_cents int not null,
  paid_on      date not null,
  receipt_doc  uuid references documents (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- scrape_jobs (cola observable) + DLQ (status='dead')
create table scrape_jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles (id) on delete cascade,
  case_id         uuid references cases (id) on delete cascade,
  source          case_source not null,
  status          scrape_status not null default 'queued',
  attempts        int not null default 0,
  idempotency_key text,
  result          jsonb,
  error_kind      text,
  scheduled_at    timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index scrape_jobs_status_sched_idx on scrape_jobs (status, scheduled_at);
create unique index scrape_jobs_idem_idx on scrape_jobs (idempotency_key) where idempotency_key is not null;

-- IA (pgvector)
create table ai_threads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  title      text,
  created_at timestamptz not null default now()
);
create table ai_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references ai_threads (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant', 'system')),
  content    text not null,
  created_at timestamptz not null default now()
);
create table ai_embeddings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  source_ref text,
  embedding  vector(768),
  content    text
);
create index ai_embeddings_ivf_idx on ai_embeddings using ivfflat (embedding vector_cosine_ops);

-- notifications · subscriptions · idempotency · outbox · audit
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  kind       notif_kind not null,
  title      text,
  body       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references profiles (id) on delete cascade,
  plan                   plan_tier not null default 'free',
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 text,
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);
create table idempotency_keys (
  key        text primary key,
  user_id    uuid references profiles (id) on delete cascade,
  endpoint   text,
  response   jsonb,
  created_at timestamptz not null default now()
);
create table domain_events (
  id           uuid primary key default gen_random_uuid(),
  aggregate    text,
  aggregate_id uuid,
  type         text,
  payload      jsonb,
  published    boolean not null default false,
  created_at   timestamptz not null default now()
);
create table audit_log (
  id         bigint generated always as identity primary key,
  user_id    uuid,
  action     text,
  target     text,
  meta       jsonb,
  created_at timestamptz not null default now()
);
