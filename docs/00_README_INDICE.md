# DIY Legal — Paquete de documentación maestro (v3.0)

> **Producto:** DIY Legal — App móvil de **auto-servicio** para trámites migratorios en EE.UU. (asilo/EOIR, USCIS, consular/NVC, y herramientas de apoyo).
> **Tipo:** Producto digital independiente (NO es el software interno de USALatino Prime).
> **Plataforma:** App móvil con **Capacitor** (codebase web Next.js → shell nativo iOS/Android), también PWA.
> **Stack real (validado en demo):** Next.js **16.2.6** (App Router) · React **19** · TypeScript strict · Tailwind v4 · Zod v4 · **HyperBrowser** (navegador en la nube vía CDP) + **2Captcha** (hCaptcha / imagen) · **Gemini 2.5 Pro** · USCIS **Torch API** (OAuth) · cheerio · pdf-parse + pdf-lib · `node:sqlite` (mirror). Capa de producto multiusuario: **Supabase** + **Stripe**.
> **Autor:** Henry Orellana / Code Open · **Versión del paquete:** 3.0 · Mayo 2026

---

## Qué cambió respecto a v2.0 (y a "MiTrámite")

La v3.0 integra el documento de **demo técnico real** (`REPLICATION-GUIDE.md`), que antes no estaba disponible. Esto corrige supuestos y **expande el alcance** de 1 fuente de datos a **~15 funcionalidades**.

1. **Adquisición de datos: del token de captcha manual → 100% automatizado y server-side.** La versión MiTrámite/STITCH pedía al usuario abrir DevTools y copiar un `Captcha-Token`. **Eliminado.** Ahora el backend lo resuelve solo; el usuario solo ingresa su A-Number / receipt / nº de caso.

2. **Mecanismo real por fuente (corrección importante).** No todo es "scraping de DOM". El demo demostró qué funciona de verdad:
   - **EOIR ACIS (estado de caso en corte):** HyperBrowser + **2Captcha (hCaptcha invisible)**, capturando la respuesta **JSON del endpoint interno `eoir-ws.eoir.justice.gov`** que el propio portal invoca (más robusto que parsear el DOM; DOM = fallback). Server-side, transparente al usuario.
   - **NVC CEAC (estado consular):** navegador + **2Captcha (captcha de imagen BotDetect)**. Funciona sin proxy.
   - **USCIS (estado de caso por receipt):** **API oficial Torch** (OAuth 2.0). Sin scraping.
   - **USCIS Processing Times:** **mirror diario** (el endpoint oficial está tras Cloudflare). Sin PII.
   - **Court Intelligence, Feeds, Datos estáticos, Herramientas:** fetch/cheerio/pdf/JSON, sin captcha.
   - **I-94 directo, ICE Locator, I-901 SEVIS:** **no automatizados** (muro anti-bot de infraestructura); quedan como trabajo futuro de ingeniería inversa.

3. **Nueva funcionalidad estrella: AAF Tracker (Annual Asylum Fee).** Calcula cuánto/cuándo debe pagar la cuota anual de asilo (OBBBA, 8 U.S.C. § 1808), y **genera con Gemini** la moción de cumplimiento y el recibo en PDF. Doc dedicado: `13_AAF_TRACKER.md`.

4. **Catálogo completo de funcionalidades nuevas en la UI** (lo que pediste mejorar): AAF, estado USCIS, estado consular NVC, tiempos de procesamiento, inteligencia de cortes y jueces, examen de ciudadanía (civics), vacunas I-693, manuales DMV, REAL ID, detector ITIN, Selective Service, lectura de I-94, ayuda legal gratuita, visa bulletin, tarifas G-1055, regulaciones (Federal Register).

5. **Reducción de scope (features eliminadas).** Se confirman fuera:
   - ❌ **"Mi familia" / Family Dashboard** (decisión del usuario).
   - ❌ **"Buscar abogado" / verificación de abogados** ("abogado sancionado" `disciplined-practitioners` y "representante acreditado DOJ" `accredited-reps`) — excluidas por el propio demo y por decisión del usuario.
   - ⚠️ **"Reportes del país" / Country Reports** como destino de navegación independiente: **off por defecto** (el usuario pidió quitarlo). La capacidad existe tras flag (`FEEDS_ENABLE_COUNTRY_REPORTS`, `FEEDS_ENABLE_TRAVEL_ADVISORIES`) y puede mostrarse como **contexto de apoyo** dentro de un caso de asilo. Ver doc 01 §Decisiones de alcance.
   - ✅ **Ayuda legal gratuita (Legal Aid)** SÍ se mantiene: es un directorio de organizaciones **sin fines de lucro / pro bono** (referencia a ayuda gratuita), distinto de un marketplace de abogados. Bajo riesgo UPL.

6. **Stack actualizado a la realidad del demo.** Next 16.2.6 / React 19 / Tailwind v4 / Zod v4; capa de datos basada en **API routes + crons + caches JSON/SQLite** (sin Supabase); capa de producto multiusuario sobre **Supabase + Stripe**. Arquitectura de **dos capas** (doc 06).

---

## Arquitectura de dos capas (resumen)

```
┌───────────────────────── CLIENTE (móvil) ─────────────────────────┐
│ Capacitor shell (iOS/Android) ──wraps──> Next.js 16 PWA            │
│ Tailwind v4 + Radix UI · Zustand · TanStack Query · Framer Motion  │
└───────────────┬──────────────────────────────────┬────────────────┘
                │ REST (datos privados)             │ REST (datos públicos)
┌───────────────▼───────────────┐  ┌───────────────▼────────────────────────┐
│  CAPA DE PRODUCTO (Supabase)   │  │  CAPA DE INTEGRACIÓN DE DATOS (demo)    │
│  Auth · Postgres+RLS · Storage │  │  Next.js API routes + 12 crons          │
│  Casos del usuario · Docs · IA │  │  Caches JSON / mirror SQLite · flags    │
│  Billing (Stripe) · Notifs     │  │  ┌────────────┬───────────┬───────────┐ │
└───────────────┬────────────────┘  │  │ Torch API  │  Feeds    │ Estáticos │ │
                │ llama a            │  │ (USCIS)    │ (GET)     │ (JSON)    │ │
                └───────────────────►│  └────────────┴───────────┴───────────┘ │
                                     │  ┌──────────────────────────────────────┐│
                                     │  │ WORKER DEDICADO (browser + captcha)  ││
                                     │  │ HyperBrowser + 2Captcha (EOIR, NVC)  ││
                                     │  │ ⚠ no corre en funciones Vercel       ││
                                     │  └──────────────────────────────────────┘│
                                     │     ↑ Gemini 2.5 Pro (mociones, OCR)     │
                                     └──────────────────────────────────────────┘
```

---

## Documentos de este paquete

| # | Documento | Para quién | Qué contiene |
|---|---|---|---|
| 00 | `00_README_INDICE.md` | Todos | Este índice. Punto de entrada, qué cambió, decisiones. |
| 01 | `01_VISION_Y_ALCANCE.md` | Producto / negocio | Visión, usuarios, **catálogo de funcionalidades**, modelo de negocio, decisiones de alcance y conflictos resueltos. |
| 02 | `02_REQUERIMIENTOS_FUNCIONALES.md` | Producto / dev / QA | RFs por módulo para **las 15 funcionalidades**, user stories, criterios de aceptación. |
| 03 | `03_REQUERIMIENTOS_NO_FUNCIONALES.md` | Dev / SRE / seguridad | Performance, resiliencia, **restricciones operativas reales** (concurrencia browser 1-2, rate-limit por host, mirror lag, IP-match). |
| 04 | `04_BRANDING.md` | Diseño / marketing | Identidad DIY Legal, voz y tono, posicionamiento "datos oficiales, no asesoría". |
| 05 | `05_DISENO_UI_DESIGN_SYSTEM.md` | Diseño / frontend | Design tokens, componentes, navegación, **pantallas de todas las funcionalidades nuevas**, disclaimers. |
| 06 | `06_ARQUITECTURA.md` | Arquitectura / dev | Dos capas, monorepo, stack real, módulos `lib/*`, patrón transversal, split de despliegue (Vercel + worker). |
| 07 | `07_BACKEND_Y_API.md` | Backend dev | Contrato `{ok,data}`, **todos los endpoints reales**, `authorizedCron`, Torch OAuth, Gemini, idempotencia, resiliencia. |
| 08 | `08_BASE_DE_DATOS.md` | Backend / DBA | Postgres (datos privados del usuario + RLS) y caches/mirror de referencia; tablas de seguimiento AAF/casos. |
| 09 | `09_INTEGRACION_DATOS_Y_SCRAPING.md` | Backend dev | **Corazón técnico.** Infra compartida (captcha solver, HyperBrowser, proxy, eoirFetch, Gemini, PDF), patrón §3, **EOIR (eoir-ws + hCaptcha)**, NVC, processing-times mirror, court intelligence, feeds, estáticos, tools, y lo no logrado. **Valores reales del demo.** |
| 10 | `10_SEGURIDAD_Y_COMPLIANCE.md` | Seguridad / legal | UPL (ampliado: mociones AAF, civics), cifrado, PII, GDPR/CCPA, retención, **avisos de exactitud de datos** (tarifas, processing times), caveat honesto del scraping. |
| 11 | `11_CAPACITOR_MOBILE.md` | Mobile dev | Capacitor, capa de plataforma, plugins nativos, **nota del worker dedicado**, stores. |
| 12 | `12_ROADMAP_Y_DEVOPS.md` | PM / dev | Roadmap por fases (rollout por flags), CI/CD, **12 crons**, split Vercel/worker, panel de prueba, testing, observabilidad, runbooks. |
| 13 | `13_AAF_TRACKER.md` | Producto / backend / legal | **Funcionalidad estrella.** Annual Asylum Fee: ramas A/B/C/D, montos, vencimientos, generación de moción y recibo (Gemini + PDF), cron regulatorio, citas legales, guardrails UPL. |

> **Orden de lectura sugerido:** 01 → 02 (qué) → 05 (cómo se ve) → 06 → 09 → 13 (cómo se construye el corazón) → 07 → 08 (backend/datos) → 03 → 10 → 11 → 12 (calidad/operación).

---

## Mapa de fuentes/funcionalidades (vista rápida — detalle en doc 09 y doc 02)

| # | Funcionalidad | Método real | ¿Captcha? | Flag |
|---|---|---|---|---|
| 1 | **EOIR — estado de caso en corte** | HyperBrowser + endpoint interno `eoir-ws` (JSON) | hCaptcha (2Captcha) | `AAF_ENABLE_COURT_INTELLIGENCE`* |
| 2 | **AAF Tracker** (cuota anual de asilo) + moción/recibo | Cálculo determinístico + Gemini + PDF | No | `AAF_ENABLE_*` |
| 3 | **USCIS — estado de caso** (receipt) | API oficial **Torch** (OAuth) | No | `AAF_ENABLE_USCIS` |
| 4 | **NVC CEAC — estado consular** | Navegador + captcha imagen | Imagen (2Captcha) | `FEEDS_ENABLE_NVC_CEAC` |
| 5 | **USCIS Processing Times** | Mirror diario (SQLite→JSON) | No (Cloudflare evitado) | `FEEDS_ENABLE_PROCESSING_TIMES` |
| 6 | **Court Intelligence** (cortes/jueces/TRAC) | Scraping HTML (cheerio) | No | `AAF_ENABLE_COURT_INTELLIGENCE` |
| 7 | **Federal Register** (regulaciones) | API JSON | No | `FEEDS_ENABLE_FEDERAL_REGISTER` |
| 8 | **Travel Advisories** (riesgo país) | API JSON (UA navegador) | No | `FEEDS_ENABLE_TRAVEL_ADVISORIES` |
| 9 | **Visa Bulletin** (fechas de prioridad) | HTML (cheerio) | No | `FEEDS_ENABLE_VISA_BULLETIN` |
| 10 | **Fee Schedule G-1055** (tarifas) | PDF (pdf-parse) | No | `FEEDS_ENABLE_FEE_SCHEDULE` |
| 11 | **Examen de ciudadanía (civics)** | JSON estático (100/128 q) | No | `FEEDS_ENABLE_CIVICS` |
| 12 | **Vacunas I-693** | JSON estático | No | `FEEDS_ENABLE_VACCINES` |
| 13 | **Manuales DMV** (12 estados) | JSON estático | No | `FEEDS_ENABLE_DMV` |
| 14 | **REAL ID** (federal + por estado) | JSON estático | No | `FEEDS_ENABLE_REAL_ID` |
| 15 | **Detector ITIN** / **Selective Service** | Lógica pura (sin red) | No | `FEEDS_ENABLE_ITIN` / `_SELECTIVE_SERVICE` |
| — | **I-94 (lectura de PDF)** | Subida del usuario + Gemini Vision | No (mediado) | `FEEDS_ENABLE_I94` |
| — | **Ayuda legal gratuita (Legal Aid)** | HTML (cheerio) | No | `FEEDS_ENABLE_LEGAL_AID` |
| — | **Country Reports** | HTML (cheerio) | No | `FEEDS_ENABLE_COUNTRY_REPORTS` (off) |
| ✗ | I-94 directo · ICE Locator · I-901 SEVIS | **No automatizado** (anti-bot infra) | — | — |

\* El estado de caso EOIR se expone hoy dentro del payload de Court Intelligence (`/api/eoir/intelligence/case`) y del flujo de consulta; ver doc 07 y doc 09.

---

## Convenciones del paquete

- Idioma: español. Markdown vivo en el repo bajo `/docs/`. Nombres `NN_NOMBRE.md`; los docs se referencian entre sí por número y por sección (`§n`).
- Los docs usan las **rutas y nombres de archivo reales** del codebase (`lib/eoir/portal-scraper.ts`, `lib/captcha/solver.ts`, etc.) para que mapeen 1:1 con el código.
- Respuesta de API uniforme: `{ ok: true, data }` | `{ ok: false, error: { kind, message? } }`.
- **Seguridad de claves:** todas las API keys (2Captcha, HyperBrowser, Torch, Gemini, proxy) son **server-side**, solo en `.env.local` (git-ignored). El demo trae claves enmascaradas: **rótalas** antes de usar.

---

**Generado:** Mayo 2026 · **Versión:** 3.0 · Basado en el demo real `REPLICATION-GUIDE.md`. Mantener en el repo bajo `/docs/`.
