# Fase 2 — AAF Tracker determinista · Blueprint

> Fuente de verdad: **doc 13** (AAF) + doc 09 §3.5 (Gemini) + doc 07 §4.4/§6 + doc 02 (RF-AAF) + doc 10 §2 (UPL).
> Patrón transversal invariable: `flag → obtención → cache → endpoint(gate 503 / Zod 400 / {ok,data} / 502) → cron autenticado`.
> Reglas duras: **dinero en CENTAVOS**, **fechas UTC**, **motor 100% determinista** (sin IA), `AAF_BYPASS_VALIDATORS` nunca `true` en prod.

---

## Bloqueo señalado (resuelto sin frenar)

- **Gemini 2.5 Pro requiere billing; hoy solo hay key de Flash.** Mitigación adoptada (no bloquea la fase):
  1. **El motor determinista NO usa Gemini** → cálculo, montos, fechas, estados, recibo PDF y endpoint `regulatory/current` funcionan sin ninguna key.
  2. **`generate-motion`** intenta Gemini (`GEMINI_PRO`) y, si falla (incl. error de billing/HTTP), **cae al template determinista** con watermark DRAFT — el endpoint siempre devuelve un PDF válido (doc 13 §3.1 "fallback a template").
  3. **`regulatory-check`** y **`icpm-check`** (crons grounded) usan **`GEMINI_FLASH` grounded** (gratis, ya probado en civics/vaccines/dmv). Desviación documentada respecto al doc 07 §6 ("singleton pro"): para *grounding* de novedades, Flash basta y no incurre en billing. El monto/pausa se siembran del doc 13 (10200¢) y el cron solo refina.
  4. Ningún endpoint núcleo depende de la disponibilidad de Gemini.

---

## Fundamento de fechas (verificado contra fuente oficial — anti-alucinación)

El doc 13 lista los **estados** y `nextDueDate` pero **no** la fórmula del vencimiento. Verificado en Federal Register (HR-1 / 8 U.S.C. §1808) + guías de práctica:

- **Presentada antes de 2024-10-01 (legacy → rama B):** la AAF vence el **30 de septiembre** de cada año que el caso siga pendiente.
- **Presentada en/después de 2024-10-01 (ramas A y D):** vence en el **aniversario de la fecha de presentación**; el primer vencimiento al cumplir **365 días** pendiente.
- **Rama C (defensiva, EOIR):** el *venue* la fija como C, pero el **calendario** sigue la misma regla temporal (legacy→Sep 30 / post→aniversario) según su `filingDate`. (SUPUESTO documentado: el doc no da una regla de fecha distinta para defensiva.)
- **USCIS emite un aviso personal** con monto y fecha exactos → se refleja como **caveat ES/EN** en cada cálculo (guardrail UPL doc 10 §2.3: "si hay duda, remite a la fuente").

Constantes (UTC): `FY2025_START=2024-10-01` · `FY2026_START=2025-10-01` · `OBBBA=2025-07-04` · `IFR_EFFECTIVE=2026-05-29` · `DUE_SOON_DAYS=30` (umbral de recordatorio, SUPUESTO documentado).

---

## Slices (orden de construcción)

**S1 — Motor determinista** (sin Gemini/PDF)
- `lib/aaf/branches.ts` → `determineBranch(filingDate, venue)` (C→D→A→B) · `getFiscalYear(date)` (Oct-Dic→año+1).
- `lib/aaf/regulatory.ts` → schema Zod `RegulatorySnapshot` (monto vigente, pausas, lastCheck, fuentes) + `loadRegulatory()` (cache `regulatory-cache` → fallback semilla doc 13).
- `lib/aaf/fee-amount.ts` → `getActiveAmountCents(snapshot)` · `getActivePause(branch, snapshot)`.
- `lib/aaf/estimate-filing-date.ts` → `estimateFilingDate(signals)` desde señales EOIR (`ClockStatus+ElapsedDays`→alta · `DocketDate`→media · `OSC_Date`→baja). Tipo `EoirCaseSignals` autónomo (Fase 6 lo poblará; no acopla a schema inexistente).
- `lib/aaf/calculator.ts` → `calculateAAF(input)` → `{ branch, fiscalYear, nextDueDate, aafStatus, daysUntilDue, amountCents, legalCitations, caveats{es,en}, pause }`. Estados: `not_due|due_soon|due_now|overdue|paid_current|case_closed`.
- Tests exhaustivos de fechas límite (OBBBA, FY, Sep 30 legacy, aniversario, paid_current, overdue, pausa, case_closed).

**S2 — Endpoints núcleo**
- `POST /api/aaf/calculate` — core, **sin flag** (doc 13 §5). Zod body → `calculateAAF` → `{ok,data}`.
- `GET /api/aaf/regulatory/current` — flag `AAF_ENABLE_REGULATORY_CHECK`; sirve `loadRegulatory()` (cache-first, fallback semilla).
- Tests de ambos (503/400/200).

**S3 — Documentos PDF + Gemini opcional** (instala `pdf-lib`)
- `lib/gemini/response-cache.ts` → cache TTL 1h (doc 13 §3.5).
- `lib/aaf/draft-motion.ts` → estructura `{caption, bodyParagraphs, prayer, signatureBlock, certificateOfService, fullText}`; Gemini `GEMINI_PRO` + **fallback template**; watermark DRAFT si pro se; cita 8 U.S.C. §1808.
- `lib/aaf/validate-calculation.ts` → validación opcional Gemini (REFERRED/CONSOLIDATED/Ms. L); fallback `{valid:true, fromFallback:true}`.
- `lib/pdf/receipt.ts` + `lib/pdf/motion.ts` → pdf-lib (recibo "AAF Status Report" + moción), disclaimer UPL embebido.
- `POST /api/aaf/generate-receipt` (core, PDF) · `POST /api/aaf/generate-motion` (flag `AAF_ENABLE_MOTION`, PDF + metadata header) · `POST /api/aaf/validate` (flag `AAF_ENABLE_GEMINI`).
- Tests (estructura moción, fallback, headers PDF, watermark pro se).

**S4 — Crons regulatorios**
- `lib/aaf/regulatory-check.ts` → Gemini Flash grounded; busca Federal Register/USCIS/EOIR/court orders/CPI; dedup por URL; actualiza `regulatory-cache`.
- `lib/aaf/icpm-check.ts` → descarga ICPM cap. 2/4; dedup SHA-256; `icpm-cache`.
- `GET /api/cron/regulatory-check` (diario 06:00) · `GET /api/cron/icpm-check` (lun 06:00) — `authorizedCron` + flag.
- `vercel.json`: +2 crons (13 → 15). Tests (auth 401, flag 503, sync mockeado).

**S5 — Integración + verificación**
- `lib/aaf/config.ts`: +flags `regulatoryCheck`, `icpmGrounding`. `.env.local.example`: +flags.
- Panel `/dev/feeds-test`: sondas AAF (calculate vía GET-probe simulada o sección POST).
- 5 gates verdes (typecheck/lint/test/format/build) por slice + revisión de diff.
- **Playwright E2E**: flags ON → 200 con datos; Gemini OFF → fallback/503 esperado.
- Actualizar `tasks/todo.md` (bitácora + marcar Fase 2 ✅), `tasks/lessons.md` si hay corrección.
- Commit + push por slice (co-autor Claude Opus 4.8).

---

## Guardrails UPL (doc 10 §2) — embebidos en código

1. Moción = **DRAFT**; copy "documento de apoyo, revísalo con un abogado antes de presentar".
2. El tracker **calcula e informa**; nunca "no pagues" ni estrategia.
3. Monto = **valor oficial vigente** + fecha/fuente; si hay duda → remite a la fuente (caveat).
4. `AAF_BYPASS_VALIDATORS` nunca en prod (ya forzado en `config.ts`).
5. Citas (8 U.S.C. §1808) son referencia, no consejo.
