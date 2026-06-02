# DIY Legal — Plan Maestro de Implementación

> App móvil de auto-servicio para trámites migratorios en EE.UU. (asilo/EOIR, USCIS, consular/NVC + herramientas).
> Stack: Next.js 16.2.6 (App Router) · React 19 · TS strict · Tailwind v4 · Zod v4 · Supabase + Stripe · Capacitor · HyperBrowser+2Captcha · Gemini 2.5 Pro · USCIS Torch API.
> Arquitectura de DOS CAPAS: A) Producto (Supabase/Stripe, datos privados) ↔ B) Integración de datos (Next API + caches + 12 crons + worker dedicado).
> Límite de diseño: **UPL** (informar/organizar, nunca asesorar). Patrón transversal invariable: `flag → obtención → cache → endpoint(gate 503 / Zod 400 / {ok,data} / 502) → cron autenticado`.
> Fuente de verdad: los 13 PRDs en `/docs` (00–13). **Releer el PRD del slice ANTES de implementarlo.**

---

## Estado general

- [x] **Plan aprobado** (2026-05-31). Decisiones: single-app en raíz · worker stub primero · Supabase migraciones+local · orden propuesto.
- [x] **Fase 0 — Fundación** ✅ (2026-05-31). Scaffold Next 16.2.6 + infra transversal. 5 gates verdes (build/format/lint/typecheck/test 16/16).
- [ ] Fase 1 — Slices ligeros Capa B (feeds + estáticos + tools)  ← **SIGUIENTE**
- [ ] Fase 1 — Slices ligeros Capa B (feeds + estáticos + tools)
- [ ] Fase 2 — AAF Tracker determinista
- [ ] Fase 3 — Capa A núcleo (Supabase Auth + RLS + cifrado)
- [ ] Fase 4 — USCIS Torch (caso síncrono) + persistencia de caso
- [ ] Fase 5 — Worker dedicado + cola async (202/jobId) + infra navegador/captcha
- [ ] Fase 6 — EOIR estado de caso + GATE LEGAL
- [ ] Fase 7 — NVC CEAC (captcha imagen)
- [ ] Fase 8 — UI completa + asistente IA con guardrails
- [ ] Fase 9 — Billing Stripe + notificaciones + documentos
- [ ] Fase 10 — Empaquetado móvil Capacitor + capa de plataforma
- [ ] Fase 11 — Hardening, observabilidad, runbooks, gate de producción

**Ruta crítica:** `0 → 3 → 4 → 5 → 6 → 8 → 9 → 10 → 11` (Fases 1 y 2 en paralelo tras la 0 para de-riesgar el patrón y construir el AAF determinista temprano).

---

## DECISIONES (resueltas 2026-05-31)

1. ✅ **Estructura:** single-app Next en raíz `E:\Dyi Legal`, PRDs → `/docs`. Separable a monorepo después.
2. ✅ **Worker EOIR/NVC:** stub/mock con fixtures primero (cero costo). Worker real en iteración posterior.
3. ✅ **Supabase (Fase 3):** proyecto REAL disponible → "Gyi Legal", ref `jxmrhxlzjlxforvhxuuv` (`https://jxmrhxlzjlxforvhxuuv.supabase.co`, sa-east-1, PG17), accesible vía connector claude.ai. Migraciones se versionan en `supabase/migrations/` y se aplican con `apply_migration`. Claves reales (anon/service_role/DB) SOLO en `.env.local`, nunca al repo.
7. ✅ **Orden:** plan propuesto (ligeras + AAF antes de EOIR).

### Pendientes (resolver al llegar a su fase)
4. **Credenciales/cuentas:** Gemini, USCIS Torch (sandbox?), HyperBrowser, 2Captcha/CapMonster, proxy US, Stripe, Apple Dev ($99), Google Play ($25) — claves del demo enmascaradas → rotar. (Fases 2/4/5/9/10)
5. **Gate legal:** opinión escrita UPL + legalidad scraping EOIR/ACIS = bloqueo duro pre-usuarios. (Fase 6)
6. **Pagos móvil:** IAP nativo vs reader. (Fase 10)

---

## Fases (detalle)

### Fase 0 — Fundación: scaffolding + infra compartida + design tokens  · **M** · deps: []
**Meta:** esqueleto Next 16 + TS strict + Tailwind v4 + estructura de carpetas (doc 06) + infra transversal de la que dependen TODOS los slices.
**Entregables clave:**
- Proyecto Next 16.2.6 booteable (target ES2017, moduleResolution bundler, alias `@/*`).
- Tailwind v4 con design tokens (Indigo #5B4FE9, Coral #FF6B6B, warm grays; Cabinet Grotesk/Inter/JetBrains Mono).
- Estructura `lib/ app/api/ types/ data/ scripts/ worker/ supabase/`.
- `lib/http/response.ts` (ok()/err() + catálogo de error kinds → status: ConfigMissing 503, ValidationError 400, BackendUnavailable 502, CaseNotFound 404, CaptchaInvalid 401, RateLimited 429, SchemaError 500, Unauthorized 401, ReceiptNotFound 404, Unknown 500).
- `lib/feeds/config.ts` (`flag(name, default=false)` + FEEDS_CONFIG) y `lib/aaf/config.ts` (AAF_CONFIG) — todos en false.
- `lib/cron/authorized-cron.ts` (Bearer INTERNAL_CRON_SECRET / x-vercel-cron-secret → 401).
- `next.config.ts` (serverExternalPackages: [pdf-parse, pdfjs-dist]) · `.env.local.example` · `types/node-sqlite.d.ts`.
- CI mínimo (lint + Prettier + tsc + Vitest) · carpeta `tasks/`.
**Verificación:** endpoint stub `GET /api/static/civics` → 503 ConfigMissing con flag false, {ok,data} Zod-validado con flag true; test Vitest de ambos caminos; `tsc --noEmit` + `build` limpios.
Docs: 06, 03, 04, 05, 07.

### Fase 1 — Slices ligeros Capa B (feeds GET + estáticos + tools)  · **L** · deps: [0]
**Meta:** validar el patrón transversal end-to-end con fuentes de menor riesgo (sin navegador/captcha/costo/PII).
**Entregables:** `eoirFetch` (rate-limit por host + backoff + detección Cloudflare) · `lib/feeds/pdf.ts` · feeds (Federal Register, Travel Advisories[off], Visa Bulletin, Fee Schedule G-1055 con feeLines exactas — NUNCA simplificar) · mirror processing-times (sync node:sqlite → JSON + index portable + cron) · Court Intelligence (cheerio: operational-status/court-details/trac-judge-stats + persistencia LRU/change-log) · estáticos (civics 2008/2025, vacunas I-693, DMV 12 estados, REAL ID) + builder · tools puras (itin-check regla 3 años, selective-service) · Legal Aid · panel `/dev/feeds-test` · tests contra fixtures.
Docs: 09, 02, 10, 12.

### Fase 2 — AAF Tracker determinista (motor + PDFs + cron regulatorio)  · **M** · deps: [0,1]
**Meta:** funcionalidad estrella autocontenida y testeable; motor 100% determinista + generación PDF.
**Entregables:** `lib/aaf/{branches,calculator,fee-amount,estimate-filing-date}.ts` (ramas A/B/C/D, FY Oct-Dic→año+1, estados not_due/due_soon/due_now/overdue/paid_current/case_closed, monto en centavos, OBBBA/IFR) · `POST /api/aaf/calculate` (core sin flag) + `GET /api/aaf/regulatory/current` · PDFs pdf-lib (generate-motion "Notice of Compliance" cita 8 U.S.C. §1808, marca DRAFT si pro se, fallback si Gemini falla; generate-receipt) · crons regulatory-check + icpm-check · cliente Gemini singleton (gemini-2.5-pro) + response-cache TTL 1h · tests de fechas límite. `AAF_BYPASS_VALIDATORS` nunca true en prod.
Docs: 13, 09, 07, 10.

### Fase 3 — Capa A núcleo (Supabase Auth + Postgres+RLS + cifrado)  · **L** · deps: [0]
**Meta:** capa de producto multiusuario; cimiento de todo lo privado.
**Entregables:** proyecto Supabase + Auth + clientes server/client · migraciones SQL con enums (plan_tier, case_source, case_status, scrape_status, aaf_branch, aaf_status, doc_kind, notif_kind) y tablas (profiles, cases, case_events, aaf_tracking, aaf_payments, documents, scrape_jobs+DLQ, ai_threads/messages/embeddings, notifications, subscriptions, idempotency_keys, domain_events, audit_log) · **RLS `user_id = auth.uid()` en TODAS las tablas** + tests negativos · cifrado A-Number a nivel columna (pgcrypto) + masking · pgvector(768) · bucket Storage privado + AES-GCM client-side · onboarding con consentimiento versionado + idioma ES/EN · borrado soft-delete + purga 30d (pg_cron).
Docs: 08, 10, 02, 07.

### Fase 4 — USCIS Torch (caso síncrono) + persistencia de caso  · **M** · deps: [0,2,3]
**Meta:** primer slice de CASO PRIVADO completo end-to-end con la fuente síncrona más estable.
**Entregables:** `lib/uscis/torch-client.ts` (OAuth client_credentials, sandbox/prod por env, cache token, USCIS_MOCK fixtures) + receipt-format + errors · `POST /api/cases/uscis-status` (flag AAF_ENABLE_USCIS) · flujo Capa A: `POST /api/user/cases` source=uscis síncrono → persiste last_result/last_synced_at/cooldown_until; refresh con cooldown/cuota + Idempotency-Key · integración AAF (estimate-filing-date + uscis-aaf-check worker/local-only) · timeline case_events + aaf_tracking 1:1.
Docs: 09, 07, 13, 02.

### Fase 5 — Worker dedicado + cola async (202/jobId) + infra navegador/captcha  · **XL** · deps: [3,4]
**Meta:** subsistema de mayor riesgo operativo; habilitador de EOIR y NVC.
**Entregables:** worker `worker/` (claim scrape_jobs queued→running→done|failed|dead, concurrencia 1-2, retry backoff+jitter, DLQ, graceful SIGTERM) · `lib/captcha/solver.ts` provider-agnostic (anti-captcha createTask→poll, solveHCaptcha/solveImageCaptcha, CAPTCHA_PROVIDER, failover 2Captcha→CapMonster, reportbad) · `lib/browser/{hyperbrowser,proxy}.ts` (CDP, stealth, IP-match) · patrón async (POST→202 jobId; `GET /api/jobs/:jobId`; Realtime case.updated; modo diferido >p95 90s; maxDuration 300) · idempotencia por (usuario,caso,ventana) · bulkheads · tracing con PII scrubbing · CI/CD worker + heartbeats + dashboard scraping + presupuesto con corte (kill switch).
Docs: 09, 07, 06, 03, 12.

### Fase 6 — EOIR estado de caso (alto riesgo) + gate legal  · **L** · deps: [5,2]
**Meta:** consulta EOIR sobre worker (JSON `eoir-ws` vía HyperBrowser+hCaptcha, fallback DOM). Corazón de riesgo.
**Entregables:** `lib/eoir/portal-scraper.ts` (acis.eoir.justice.gov, proxy US, interceptor callback hCaptcha, form 9 inputs A-Number + react-select nacionalidad, hCaptcha invisible, captura JSON eoir-ws) · `portal-parser.ts` (fallback cheerio) · `schemas.ts` (Zod CaseInfoResponse) · `errors.ts` · job EOIR en worker (persiste + case_events + Realtime, service role) · integración AAF estimate-filing-date (ClockStatus+ElapsedDays alta / DocketDate media / OSC_Date baja) · runbooks R1 + R-EOIR-401 · monitor éxito/costo · tests fixtures. **GATE LEGAL = bloqueo duro pre-usuarios.**
Docs: 09, 13, 10, 07, 12.

### Fase 7 — NVC CEAC (captcha imagen) sobre worker estable  · **M** · deps: [5]
**Entregables:** `lib/legal/nvc-ceac.ts` (BotDetect → base64 → solveImageCaptcha, parse vs NVC_STATUSES, retry 3 con nuevo captcha+viewstate) · `GET /api/legal/nvc-ceac` (flag FEEDS_ENABLE_NVC_CEAC) + rama nvc en POST /api/user/cases (async 202) · job NVC en worker + persistencia + Realtime · tests fixtures · sonda nvc.
Docs: 09, 07, 02.

### Fase 8 — UI completa + asistente IA con guardrails  · **XL** · deps: [1,2,3,4,6,7]
**Meta:** toda la superficie visual (~30 pantallas) + biblioteca componentes + i18n + a11y + asistente IA.
**Entregables:** stack UI (React 19 + Tailwind v4 + Radix + Framer Motion + Zustand + TanStack Query) · componentes doc 05 (AppShell, CaseCard, StatusBadge, ProgressConsulta, DataNoticeBanner, DisclaimerBar, Inputs, FeeLines, AAFCard, JudgeStatsCard, QuizCard, Checklist, ToolResultCard, Uploader, EmptyState, ErrorState, PaywallSheet) · pantallas P-* cableadas (P-Progreso 100% automática vía Realtime + modo diferido) · asistente IA Gemini (Free Flash/Pro Pro+RAG, system prompt anti-UPL + clasificador intención + disclaimer) · i18n ES/EN real · WCAG AA · I-94 mediado (Uploader → Gemini Vision).
Docs: 05, 04, 07, 02, 10, 13.

### Fase 9 — Billing Stripe + notificaciones + documentos  · **L** · deps: [3,8]
**Entregables:** Stripe checkout + webhook (HMAC, dedupe event id, idempotente) + tabla subscriptions; gating Free/Pro 100% server-side · notificaciones outbox (domain_events) push/email (Resend) sin PII + deep link; recordatorios AAF; alertas corte CLOSED (Pro) · documentos cifrados (subir/escanear/export, mociones/recibos AAF) · auto-refresh programado (Pro) priorizado por proximidad de audiencia · runbook R4.
Docs: 07, 11, 08, 10, 02.

### Fase 10 — Empaquetado móvil Capacitor + capa de plataforma  · **L** · deps: [8,9]
**Entregables:** `capacitor.config.ts` (appId provisional legal.diy.app) + ios/android · `packages/platform` (storage Preferences, secure Keychain/Keystore para clave AES-GCM, push APNs/FCM sin PII, camera, biometrics, filesystem, share, app-info; selección por isNativePlatform) · push end-to-end (device token + deep links) · manejo móvil (safe-areas, back button, offline, dark mode) · builds firmados desde CI + privacy labels + ficha alineada doc 10 · decisión IAP vs reader.
Docs: 11, 10, 04, 05, 03.

### Fase 11 — Hardening, observabilidad, runbooks, gate de producción  · **L** · deps: [5,6,9]
**Entregables:** Sentry (PII scrubbing) + PostHog (sin PII) + Four Golden Signals + dashboard scraping + alertas · presupuestos diario/mensual con corte automático + kill switches probados + costo por caso vs $17 · suite testing (contrato 202/idempotencia/429/HMAC, resiliencia/caos, carga k6, a11y axe/Lighthouse, E2E Playwright worker mock, Lighthouse CI LCP<2.5s) · migraciones expand-contract + rollback ensayado · runbooks R1–R6 + R-EOIR-401/R-COSTO/R-MIRROR · rotación de claves del demo · checklist gate de producción (doc 12).
Docs: 03, 12, 10, 09.

---

## Bitácora (actualizar al cerrar cada fase)

- 2026-05-30 — Análisis de los 13 PRDs completado (workflow 14 agentes Opus 4.8). Plan maestro de 12 fases generado. Pendiente aprobación + decisiones abiertas.
- 2026-05-31 — Decisiones aprobadas. **Fase 0 cerrada.** Repo: Next 16.2.6 single-app en raíz, PRDs en `/docs`, git `main`. Infra transversal creada: `lib/http/{errors,response}.ts` (contrato {ok,data} web-estándar), `lib/feeds/config.ts` (flag()+FEEDS_FLAGS), `lib/aaf/config.ts`, `lib/cron/authorized-cron.ts` (compara en tiempo constante), `lib/validation/zod-helpers.ts`, `types/node-sqlite.d.ts`. Endpoint stub `GET /api/static/civics` valida el patrón (503/400/200). Tokens STITCH en `globals.css`, fuentes Inter/Plus Jakarta/JetBrains Mono. CI en `.github/workflows/ci.yml`. 5 gates verdes.
- 2026-06-01 — **Fase 1: slice 10/15 (Processing Times) cerrado.** Mirror `jzebedee/uscis` (SQLite por release diario). `lib/feeds/processing-times/{index,sync}.ts` (node:sqlite dynamic import SOLO en sync; endpoint cache-only sin node:sqlite), endpoint `GET /api/feeds/processing-times?form=&office=`, cron `processing-times-sync` (diario 14:00 UTC, 10º cron), `scripts/sync-processing-times.ts`. Esquema real inspeccionado contra la fuente (anti-alucinación): units `lower`/`upper` expuestas SEPARADAS (difieren/no-numéricas en origen). Verificado E2E real: 43 forms/96 offices/497 times. 124 tests verdes (+15). 5 gates verdes. (Commit local `6963c8e`; push pendiente de autorización.)
- 2026-06-02 — **Fase 1: slice 11/15 (Legal Aid) cerrado.** `lib/legal/legal-aid.ts` (cheerio) + endpoint `GET /api/legal/legal-aid?state=`. **Estrena la infra compartida `eoirFetch`** (`lib/eoir/court-intelligence/scrapers/http-client.ts`: rate-limit por host vía FEEDS_CONFIG + default conservador 1500ms, backoff exponencial+jitter en 5xx/429, detección Cloudflare → `EoirCaptchaDetectedError`). Selectores cheerio VERIFICADOS contra el HTML real de immigrationlawhelp.org (fixture real en `__fixtures__/`). Cache en MEMORIA 1h por estado + fallback stale (sin cron, doc §12). 144 tests verdes (+19). 5 gates verdes. Verificado E2E real: 20 orgs CA. Nota: 2 vulns moderate de `postcss` (transitivo de next) preexistentes — NO arreglar con `audit fix --force` (downgradearía next).
