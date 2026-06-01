# Fase 1 — Blueprint de implementación (fuentes ligeras Capa B)

> Derivado del doc 09 (+02/03) por workflow Opus 4.8. Orden de menor a mayor riesgo. Cada fuente = slice vertical completo (lib + endpoint + cron si aplica + test contra fixtures). **Releer este archivo y el doc 09 antes de cada slice.**

## Infra compartida (construir cuando la necesite el primer consumidor)

| # | Infra | Cuándo | Detalle |
|---|---|---|---|
| — | **YA existe (Fase 0)** | — | `lib/http/*`, `lib/feeds/config.ts` (flag/feedEnabled/FEEDS_FLAGS), `lib/cron/authorized-cron.ts`, `lib/validation/zod-helpers.ts`, `lib/aaf/config.ts`. **Molde de endpoint = `app/api/static/civics/route.ts`** |
| 1 | `lib/feeds/static.ts` (`loadStatic<T>(schema,json)`) | antes de estáticos (vacunas) | valida JSON commiteado con parseWith + cachea en module-scope |
| 2 | Extender `AAF_FLAGS` (judgeStats, courtChangeAlerts, courtIntelligenceCron) | antes de Court Intel | hoy faltan |
| 3 | `lib/feeds/pdf.ts` (`fetchPdfText`) | antes de Fee Schedule | pdf-parse v2 `new PDFParse({data}).getText().text` |
| 4 | `lib/eoir/court-intelligence/scrapers/http-client.ts` (`eoirFetch`) | antes de Visa Bulletin/Court Intel/Legal Aid | rate-limit por host (FEEDS_CONFIG.rateLimitMsByHost), backoff 1/2/4/8s+jitter en 5xx/429, detección Cloudflare (`cf-mitigated: challenge` / "just a moment") → `EoirCaptchaDetectedError`. Instala cheerio |
| 5 | `lib/eoir/court-intelligence/persistence/` | antes del 1er scraper Court Intel | LRU 500 court/judge cache + change-log (severidad ALTA si CLOSED) |

## Orden de implementación (15 pasos)

| # | Fuente | Cmplx | Flag / config | Cron |
|---|---|---|---|---|
| 1 | **ITIN** (`lib/tools/itin-check.ts`) | S | `itin` | — |
| 2 | **Selective Service** (`lib/tools/selective-service.ts`) | S | `selectiveService` | — |
| 3 | **Vacunas I-693** (`lib/static-data/vaccines.json`) | S | `vaccines` | — |
| 4 | **DMV** (`lib/static-data/dmv-manuals.json`) | S | `dmv` | — |
| 5 | **REAL ID** (`lib/static-data/real-id.json`) | S | `realId` | — |
| 6 | **Civics** (builder `scripts/build-civics-data.ts` + reemplaza stub) | M | `civics` | — |
| 7 | **Federal Register** (`lib/feeds/federal-register.ts`) | S | `federalRegister` | `0 5 * * *` |
| 8 | **Travel Advisories** (`lib/feeds/travel-advisories.ts`, UA navegador, off) | S | `travelAdvisories` | `0 9 * * 1` |
| 9 | **Fee Schedule G-1055** (`lib/feeds/fee-schedule.ts`, feeLines literales) | M | `feeSchedule` | `0 12 1 * *` |
| 10 | **Processing Times** (`processing-times/{sync,index}.ts`, node:sqlite dynamic import) | M | `processingTimes` | `0 14 * * *` |
| 11 | **Legal Aid** (`lib/legal/legal-aid.ts`, cheerio) | M | `legalAid` | — |
| 12 | **Court Intel — Operational Status** | M | `courtIntelligence`(_Cron) | `0 */6 * * *` |
| 13 | **Court Intel — Court Details** (`/courts`, `/courts/[slug]`, `/courts/by-code/[code]`) | M | `courtIntelligence` | `30 7 * * *` |
| 14 | **Court Intel — TRAC Judge Stats** (`/judges/[code]`, `/intelligence/case`) | L | `judgeStats` | `0 8 * * 1` |
| 15 | **Panel `/dev/feeds-test`** (PROBES, NODE_ENV≠production) | S | — | — |

## Reglas transversales (NO negociables)

1. **Fixtures, nunca sitios reales en CI.** Todo slice con red testea contra fixtures (`__fixtures__/` junto al test); mockear fetch/eoirFetch. El panel `/dev/feeds-test` es la única vía E2E real (fuera de Vercel, Playwright).
2. **Caches JSON en `/data` git-ignored** (los persiste cada cron). Distinto de `lib/static-data/*.json` (commiteado, versionado). Court Intel persiste en `persistence/*.json` (git-ignored, cache runtime).
3. **feeLines G-1055 NUNCA simplificar** (RNF-OPS-04, doc 10): líneas literales `string[]`; test de contrato falla si se simplifica. Igual exactitud: `enforcedSince=2025-05-07`, listas 12 estados, counts civics 100/128 — verificados por test.
4. **Civics decoding Windows-1252** en el builder (gotcha central). Builder offline. Selección pool: `filingDate < 2025-10-20 → 2008`, `≥ → 2025` (frontera estricta).
5. **Gate por `feedEnabled(key)`/`aafEnabled(key)`**, no `flag()` crudo. Court Intel usa AAF_CONFIG, no FEEDS_CONFIG. Flag off → `jsonErr('ConfigMissing')` 503 (kill switch; comportamiento esperado, no bug).
6. **Molde endpoint:** `runtime='nodejs'` → gate flag → `parseWith` → `jsonOk`. Error externo → `jsonErr('BackendUnavailable')`, NUNCA 500 crudo. `SchemaError`(500) solo si respuesta externa no valida tras retries.
7. **Molde cron:** `authorizedCron` (401/503) → gate flag (503) → sync + persiste. Secret `INTERNAL_CRON_SECRET`.
8. **eoirFetch infra compartida, NO duplicar.** No inventar cifras de rate-limit para hosts no declarados (travel.state.gov, immigrationlawhelp.org) → default conservador documentado.
9. **PII ITIN/Selective Service:** cálculo local, nunca a terceros, nunca loguear en claro (solo enmascarado). Selective Service NO pide SSN.
10. **NO inventar lo que el doc no da:** schemas Zod exactos, nombres de campos, regex TRAC, URLs oficiales (g-1055.pdf, .txt civics, DHS, CDC, DMV) y umbrales (expiring ITIN) → derivar del recurso real o dejar `TODO` con SUPUESTO declarado en constante/comentario.
11. **Packages solo al tocar el slice:** cheerio (con eoirFetch), pdf-parse v2 + pdfjs-dist (con pdf.ts). `node:sqlite` built-in (dynamic import solo en sync.ts).
12. **DoD por slice:** typecheck (sin `any`) + lint + test verde (los previos NO se rompen) + revisión de diff (scope mínimo). Commit+push.

## Progreso Fase 1
> Orden ajustado por la decisión "datos dinámicos" (2026-05-31): los ex-estáticos (vacunas/DMV/REAL-ID/civics) pasan a obtenerse de su fuente oficial vía scraping; los feeds con API limpia van primero.

- [x] 1. ITIN ✅ (lib/tools/itin-check.ts; 11 tests; lógica pura)
- [x] 2. Selective Service ✅ (lib/tools/selective-service.ts; 14 tests; lógica pura)
- [x] 3. Federal Register ✅ (lib/feeds/federal-register.ts + cache.ts + endpoint + cron + vercel.json; 11 tests; API JSON en vivo + fallback cache)
- [x] 4. Travel Advisories ✅ (lib/feeds/travel-advisories.ts + endpoint + cron; 13 tests; API JSON + UA navegador + parse Title→nivel; off por defecto)
- [x] 5. Vacunas I-693 ✅ (lib/feeds/vaccines.ts + infra lib/gemini/client.ts + endpoint + cron; 17 tests; **Gemini grounded** cache-first; validado real: 15 vacunas, covidRequired=false)
- [x] 6. REAL ID ✅ (lib/feeds/real-id.ts + endpoint ?state= + cron; 7 tests; Gemini grounded; validado real: enforcedSince 2025-05-07, 51 estados, CA/NY true, TX/FL false)
- [x] 7. Civics ✅ (lib/feeds/civics.ts + endpoint + cron; reemplaza stub Fase 0; 11 tests; Gemini grounded por pool; selección 2008/2025 por filingDate; validado real: 100 preguntas STOP)
- [x] 8. DMV ✅ (lib/feeds/dmv.ts + endpoint ?state= + cron; 7 tests; Gemini grounded; 12 estados, homepage + manual EN/ES)
- [ ] 9. Fee Schedule G-1055 (PDF, instalar pdf-parse, feeLines literales)  ← SIGUIENTE
- [ ] 10. Processing Times (mirror node:sqlite + GitHub release)
- [ ] 11. Legal Aid (cheerio) · 12-14. Court Intelligence (eoirFetch+cheerio) · 15. Panel /dev/feeds-test

**Infra creada:** `lib/feeds/cache.ts` (saveCache/loadCache en /data; molde fetch-en-vivo+fallback) · `lib/gemini/client.ts` (geminiGenerate/geminiJson/extractJson vía REST; grounding con gemini-2.5-flash). GEMINI_API_KEY en `.env.local` (rotar — fue pegada en chat).
