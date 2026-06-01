# 06 · Arquitectura — DIY Legal

> Cómo se organiza el sistema: dos capas (producto + integración de datos), stack real del demo, estructura de módulos, patrón transversal y split de despliegue (Vercel + worker dedicado).
> Versión 3.0 · Mayo 2026

---

## 1. Filosofía

- **Dos capas con responsabilidades claras** (ver §2): la *capa de producto* tiene el estado privado del usuario (Supabase); la *capa de integración de datos* trae datos oficiales (Next.js API + caches + worker), tal como se validó en el demo.
- **Hexagonal ligero + Vertical Slicing.** Cada funcionalidad es un *slice* (`lib/<área>` + `app/api/<área>` + UI) con un contrato de datos (Zod) y un puerto cuando hay integración externa intercambiable (p. ej. `EoirDataSourcePort`, `CaptchaSolverPort`).
- **Método por fuente, no dogma** (doc 09 §1): API oficial > endpoint interno > captcha > mirror > scraping, según lo que funcione.
- **Flag-driven.** Toda fuente nace detrás de un flag `false` (rollout gradual, doc 12).
- **Respuesta uniforme** `{ ok, data } | { ok, error:{kind} }` en toda la API.

---

## 2. Las dos capas

### Capa A — Producto (multiusuario, datos privados) → Supabase + Stripe
Tiene lo que el demo no cubre (cuentas, datos personales): Auth, Postgres + **RLS**, Storage (documentos cifrados), Realtime (progreso de jobs), billing (Stripe), notificaciones. Aquí viven los **casos del usuario** y su seguimiento (AAF, audiencias). Detalle en doc 08, doc 07, doc 10.

### Capa B — Integración de datos (datos oficiales, mayormente públicos) → demo
Tal cual `REPLICATION-GUIDE.md`: **Next.js API routes** (App Router), **caches JSON / mirror SQLite**, **12 crons**, e infraestructura compartida (captcha solver, HyperBrowser, proxy, eoirFetch, Gemini, PDF). La mayoría sin PII. Detalle en doc 09.

### Cómo se conectan
La Capa A llama a la Capa B. Ejemplo (agregar caso EOIR): el usuario guarda su A-Number (Capa A) → se encola un job (worker, Capa B) → se captura el estado oficial → se **persiste en el caso del usuario** (Capa A) → la UI se entera por Realtime. Datos de **referencia globales** (cortes, jueces, processing times, tarifas, civics) viven en caches compartidos (Capa B), no se duplican por usuario.

> **Decisión y alternativa:** se mantiene la Capa B como en el demo (caches/crons) porque sus datos son globales y su diseño está probado; Supabase solo guarda lo privado. *Alternativa:* mover todo a Supabase (Postgres para referencia también) — más uniforme pero pelea con el mirror SQLite y los caches del demo. Recomendado: **híbrido** como aquí.

---

## 3. Stack (real, del demo)

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | **16.2.6** |
| UI | React / React DOM | **19.2.4** |
| Lenguaje | TypeScript strict | ^5 (target ES2017, moduleResolution `bundler`, `@/*`) |
| Estilos | Tailwind CSS v4 (+ `@tailwindcss/postcss`) | ^4 |
| Primitivas UI | Radix UI (dialog, select, popover, tabs, tooltip…) | varios |
| Validación | Zod | ^4.4.3 |
| Scraping HTML | cheerio | ^1.2.0 |
| Navegador local | playwright-core | ^1.59.1 |
| Navegador en la nube | `@hyperbrowser/sdk` (CDP) | ^0.90.1 |
| IA | `@google/generative-ai` (**Gemini 2.5 Pro**) | ^0.24.1 |
| PDF | `pdf-parse` (leer) / `pdf-lib` (generar) | ^2.4.5 / ^1.17.1 |
| Mirror | `node:sqlite` nativo (Node ≥ **22.5**) | — |
| Fechas | date-fns | ^4.1.0 |
| Tests | Vitest + jsdom | ^2.1.9 / ^25.0.1 |
| Ejecutar TS CLI | tsx | ^4.22.3 |
| **Producto** | **Supabase** (Auth/Postgres/Storage/Realtime) · **Stripe** | — |
| **Móvil** | **Capacitor** (iOS/Android) + PWA | doc 11 |

- `next.config.ts`: `serverExternalPackages: ["pdf-parse","pdfjs-dist"]`.
- Node **24.13.1** en desarrollo (mínimo 22.5 por `node:sqlite`). Esta versión de Next tiene breaking changes (leer `node_modules/next/dist/docs/` antes de tocar APIs del framework, según `AGENTS.md`).
- Cliente UI: **Zustand** (estado), **TanStack Query** (fetching/cache cliente), **Framer Motion** (micro-interacciones) — doc 05.

---

## 4. Estructura del repositorio

Base = el proyecto Next.js del demo, extendido con producto y móvil.

```
diy-legal/
├── app/                         # Next.js App Router (UI + API)
│   ├── (app)/...                # UI cliente (Capa A): pantallas (doc 05)
│   ├── api/
│   │   ├── aaf/{calculate,validate,generate-motion,generate-receipt,regulatory}/route.ts
│   │   ├── cases/{uscis-status,uscis-aaf-check}/route.ts
│   │   ├── eoir/{courts,courts/[slug],courts/by-code/[code],judges/[code],intelligence/case}/route.ts
│   │   ├── feeds/{regulations,travel-advisories,visa-bulletin,fees,country-report,processing-times}/route.ts
│   │   ├── static/{civics,vaccines,dmv-manual,real-id}/route.ts
│   │   ├── tools/{itin-check,selective-service,i94-parse}/route.ts
│   │   ├── legal/{legal-aid,nvc-ceac}/route.ts
│   │   └── cron/{...12 crons...}/route.ts
│   ├── dev/feeds-test/page.tsx  # panel de prueba interno (doc 09 §17)
│   └── layout.tsx, globals.css
├── lib/
│   ├── aaf/        # cálculo AAF (doc 13)
│   ├── gemini/     # client + draft-motion, regulatory-check, icpm-check, validate-calculation, response-cache
│   ├── uscis/      # torch-client (OAuth), questionnaire-scraper, receipt-format, errors
│   ├── eoir/       # portal-scraper, portal-parser, schemas, errors + court-intelligence/**
│   ├── feeds/      # config, cron-auth, federal-register, travel-advisories, visa-bulletin,
│   │               # country-reports, fee-schedule, pdf, processing-times/{index,sync}
│   ├── static-data/# civics, vaccines, dmv, real-id (+ data/*.json)
│   ├── tools/      # itin, selective-service, i94
│   ├── legal/      # legal-aid, nvc-ceac
│   ├── browser/    # hyperbrowser (CDP), proxy
│   ├── captcha/    # solver (provider-agnostic), rate-limit, result-cache
│   ├── pdf/        # generate-motion, generate-receipt
│   ├── supabase/   # (Capa A) clientes server/client, RLS helpers, repos de casos/docs
│   └── platform/   # (móvil) abstracción web/native (doc 11)
├── data/           # caches JSON (processing-times-cache.json, etc.)
├── types/          # node-sqlite.d.ts
├── scripts/        # POCs + sync (poc-eoir-portal, sync-processing-times, build-civics-data, …)
├── worker/         # WORKER DEDICADO (browser+captcha): cola, EOIR/NVC, questionnaire (doc 09 §14)
├── supabase/       # migraciones SQL, políticas RLS (doc 08)
├── ios/ android/   # Capacitor (doc 11)
├── capacitor.config.ts
└── vercel.json     # 12 crons
```

> Monorepo opcional (Turborepo) si se desea separar `ui`/`core`/`types`; no es obligatorio — el demo es un solo app Next y funciona.

---

## 5. Patrón transversal (resumen — detalle doc 09 §2)
Flag (`lib/feeds/config.ts` / `lib/aaf/config.ts`) → obtención (fetch/cheerio/pdf/sqlite/estático) → cache JSON → endpoint (`runtime="nodejs"`, gate 503, Zod 400, `{ok,data}`, 502) → cron (`authorizedCron` 401, flag 503, persiste). Lo aplican las 15 fuentes igual.

---

## 6. Despliegue (split obligatorio)

```
┌───────────────── Vercel (serverless) ─────────────────┐
│ UI (Next) · API GET (feeds, static, tools, pt-read)   │
│ USCIS Torch (API) · AAF cálculo+PDF · crons ligeros   │
│ ❌ NO browser/Playwright (PlaywrightNotSupported)      │
└───────────────────────┬───────────────────────────────┘
                         │ encola jobs (202 + jobId)
┌────────────────────────▼──────────────────────────────┐
│ WORKER DEDICADO (contenedor long-running)              │
│ HyperBrowser + 2Captcha → EOIR, NVC, questionnaire     │
│ cola concurrencia 1-2 + retry backoff · maxDuration    │
│ processing-times sync (node:sqlite) si no va en Vercel │
└───────────────────────┬────────────────────────────────┘
                         │ persiste resultado
                ┌────────▼────────┐   ┌──────────────────┐
                │ Supabase (Capa A)│   │ Gemini 2.5 Pro   │
                │ Postgres/Storage │   │ (mociones, OCR)  │
                └─────────────────┘   └──────────────────┘
```

Motivo: Playwright/HyperBrowser no corren en funciones Vercel y los flujos con navegador no deben masificarse. Lo pesado va al worker; lo liviano y público a Vercel. Ver doc 09 §14 y doc 12.

---

## 7. ADRs (decisiones de arquitectura)

1. **Dos capas (Supabase + capa de datos del demo)** en vez de todo-Supabase. *Razón:* datos de referencia son globales y el diseño del demo está probado.
2. **EOIR vía endpoint interno `eoir-ws` + hCaptcha**, no scraping de DOM. *Razón:* el DOM no fue confiable; el JSON interno sí (con token válido). Fallback DOM. (doc 09 §4)
3. **USCIS vía Torch API oficial**, no scraping. *Razón:* existe API; más estable y legal.
4. **Processing times vía mirror**, no acceso directo. *Razón:* Cloudflare bloquea el directo.
5. **Worker dedicado para navegador/captcha.** *Razón:* Playwright bloqueado en Vercel + no masificar.
6. **Captcha provider-agnostic** (`CAPTCHA_PROVIDER`). *Razón:* failover hCaptcha (2Captcha↔CapMonster) ante rechazos (401).
7. **Flag por fuente, default false.** *Razón:* rollout y kill switch.
8. **Asíncrono (202+jobId) para EOIR/NVC.** *Razón:* no bloquear al usuario; Realtime para progreso.
9. **Dinero en centavos, fechas en UTC, IDs no autoincrementales** (reglas de sistemas-profesionales-empresariales).
10. **Puertos** `EoirDataSourcePort`/`CaptchaSolverPort` para poder cambiar a una **API oficial EOIR** futura sin tocar el dominio.

---

**Doc 06 · Arquitectura** · v3.0 · Mayo 2026. Relacionados: 07 (API), 08 (datos), 09 (integración/worker), 11 (Capacitor), 12 (despliegue/CI). Mantener bajo `/docs/`.
