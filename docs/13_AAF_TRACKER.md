# 13 · AAF Tracker (Annual Asylum Fee) — DIY Legal

> Funcionalidad estrella: calcula la **cuota anual de asilo** (cuánto/cuándo) y genera documentos de soporte (moción y recibo en PDF). Basado en `lib/aaf/*`, `lib/gemini/*`, `lib/uscis/*` del demo.
> Versión 3.0 · Mayo 2026

> ⚠️ **No es asesoría legal.** El AAF Tracker informa, calcula y prepara borradores. La moción se entrega como **borrador ("DRAFT")** y debe revisarse antes de presentarse. Ver doc 10 §2 (UPL).

---

## 1. Qué es el AAF

**AAF = Annual Asylum Fee** — cuota anual creada por la *One Big Beautiful Bill Act* (HR-1 / Pub. L. 119-21), **8 U.S.C. § 1808**. El solicitante de asilo debe pagarla anualmente mientras su caso esté pendiente. El tracker determina **rama, monto, fecha de vencimiento y estado**, y genera la **moción de cumplimiento** y el **recibo** como evidencia.

**Por qué importa para DIY Legal:** es nueva, aplica a la persona A (asilo), tiene reglas no triviales (fechas fiscales, pausas por court orders) y un monto que cambia (CPI-U). Automatizarla aporta valor claro y diferenciado.

---

## 2. Motor de cálculo determinístico — `lib/aaf/`

> Determinístico = mismas entradas, mismo resultado, sin IA. La IA (Gemini) solo redacta documentos y valida opcionalmente.

### 2.1 Configuración — `config.ts`
`AAF_CONFIG` con flags: `enableUscis`, `enableGeminiValidation`, `enableRegulatoryCheck`, `enableMotionGeneration`, `enableIcpmGrounding`, `enableLegalCitationValidator`, `enableCourtIntelligence…`, `uscisEnv`, `uscisMock`.

### 2.2 Determinar rama — `branches.ts` → `determineBranch(filingDate, venue)`
- **C** si `venue === "EOIR_defensive"` (asilo defensivo en corte).
- **D** si `filingDate ≥ 2025-07-04` (OBBBA).
- **A** si `filingDate ≥ 2024-10-01`.
- **B** (legacy) en otro caso.
- `getFiscalYear(date)`: Oct-Dic → año+1.

### 2.3 Calcular — `calculator.ts` → `calculateAAF(input)`
Devuelve: rama + `nextDueDate` + `aafStatus` (`not_due | due_soon | due_now | overdue | paid_current | case_closed`) + `daysUntilDue` + `fiscalYear` + `amountCents` + `legalCitations` + `caveats` (ES/EN).

**Fechas clave:** `FY2025_START = 2024-10-01` · `FY2026_START = 2025-10-01` · `OBBBA = 2025-07-04` · `IFR_EFFECTIVE = 2026-05-29`.

### 2.4 Monto vigente — `fee-amount.ts`
Lee `regulatory-cache.json` → monto vigente (**FY2026 = $102.00 / `10200` centavos**). `getActivePause(branch)` (p. ej. *court order ASAP v. USCIS* pausa la rama B). El **dinero siempre en centavos** (doc: sistemas-profesionales-empresariales).

### 2.5 Estimar fecha de presentación — `estimate-filing-date.ts`
Desde el caso EOIR (doc 09 §4): `ClockStatus + ElapsedDays` → confianza **alta**; `DocketDate` → **media**; `OSC_Date` → **baja**. Permite calcular el AAF aunque el usuario no recuerde su filing date exacta (mostrando el nivel de confianza).

---

## 3. Generación de documentos (Gemini + PDF) — `lib/gemini/`, `lib/pdf/`

### 3.1 Moción — `draft-motion.ts`
Genera **"Notice of Compliance with Annual Asylum Fee Payment"** (en inglés) para EOIR:
- Estructura `{ caption, bodyParagraphs, prayer, signatureBlock, certificateOfService, fullText }`.
- Cita **8 U.S.C. § 1808** + EOIR Policy Manual; usa Court Intelligence si está disponible (corte/juez correctos).
- **Fallback a template** si Gemini falla (resiliencia).
- **Marca de agua "DRAFT…"** si es *pro se* (sin abogado).
- Salida final en **PDF** vía `pdf-lib`; metadata en header de la respuesta.

### 3.2 Recibo — `generate-receipt`
**PDF "AAF Status Report"** con el resultado del cálculo (rama, monto, vencimiento, estado, citas).

### 3.3 Vigilancia regulatoria — `regulatory-check.ts` (cron diario 06:00 UTC)
Modelo **grounded** (Google Search) busca novedades: Federal Register, USCIS newsroom, EOIR PM, court orders (ASAP/Ms. L.), ajuste CPI-U; actualiza `regulatory-cache.json` (dedup por URL). Así el **monto y las pausas se mantienen al día** sin tocar código.

### 3.4 ICPM grounding — `icpm-check.ts` (cron semanal, lunes 06:00)
Descarga el Immigration Court Practice Manual cap. 2 (Filing) y cap. 4 (Motions) a `icpm-cache.json` (dedup por SHA-256). Da contexto de formato a la moción.

### 3.5 Validación opcional — `validate-calculation.ts`
Detecta casos especiales (REFERRED / CONSOLIDATED / Ms. L.); fallback `{ valid:true, fromFallback:true }`. `response-cache.ts` cachea respuestas Gemini (TTL 1h).

---

## 4. Integración con USCIS — `lib/uscis/`

- **Estado de caso** (I-589) vía **Torch API** (`/api/cases/uscis-status`, doc 09 §6).
- **Estado del cuestionario AAF** (`questionnaire-scraper.ts` sobre `my.uscis.gov`): **solo worker/local** (Playwright bloqueado en Vercel). Endpoint `/api/cases/uscis-aaf-check`.

---

## 5. Endpoints AAF (doc 07)

| Endpoint | Método | Qué hace | Flag |
|---|---|---|---|
| `/api/aaf/calculate` | POST | Cálculo (rama, vencimiento, monto, pausa). | — (core) |
| `/api/aaf/validate` | POST | Validación opcional con Gemini. | `AAF_ENABLE_GEMINI` |
| `/api/aaf/generate-motion` | POST | Pipeline: data → ICPM grounding → research (grounded) → draft → **PDF** + metadata. | `AAF_ENABLE_MOTION` |
| `/api/aaf/generate-receipt` | POST | **PDF** "AAF Status Report". | — |
| `/api/aaf/regulatory/current` | GET | Monto vigente + pausa activa + lastCheck. | `AAF_ENABLE_REGULATORY_CHECK` |
| `/api/cases/uscis-status` | POST | Case status (I-589) vía Torch. | `AAF_ENABLE_USCIS` |
| `/api/cases/uscis-aaf-check` | POST | Estado cuestionario AAF (local-only). | `AAF_ENABLE_USCIS` |

**Crons:** `regulatory-check` (diario 06:00), `icpm-check` (lunes 06:00).

---

## 6. Modelo de datos del usuario (doc 08)

Por cada caso de asilo del usuario se guarda el seguimiento AAF (en Postgres, privado):
- `aaf_branch` (A|B|C|D), `aaf_fiscal_year`, `aaf_amount_cents`, `aaf_next_due_date`, `aaf_status`, `aaf_days_until_due`, `filing_date` (+ `filing_date_confidence`), `last_calculated_at`.
- Pagos registrados por el usuario (`aaf_payments`: `amount_cents`, fecha, comprobante) para marcar `paid_current`.
- Documentos generados (moción/recibo) referenciados en `documents` (doc 08), cifrados.

---

## 7. UI (doc 05 — pantalla P-AAF)

Flujo: caso de asilo → tarjeta **AAF** con: rama y por qué, **monto exacto** (FY2026 $102.00), **cuenta regresiva** al vencimiento (`due_soon`/`due_now`/`overdue` con color), pausa regulatoria si aplica, botones **"Generar moción (PDF)"** y **"Generar recibo (PDF)"** (Pro), y **registrar pago**. Disclaimers visibles. Recordatorios configurables (push/email).

---

## 8. Guardrails UPL específicos del AAF (doc 10 §2)

1. La moción es **borrador "DRAFT"**; copy claro: "documento de apoyo, revísalo con un abogado antes de presentar".
2. El tracker **calcula e informa**; no dice "no pagues" ni interpreta estrategias.
3. Montos: se muestra el **valor oficial vigente** con fecha/fuente; si hay duda, se remite a la fuente.
4. `AAF_BYPASS_VALIDATORS` **nunca** en producción.
5. Citas legales (8 U.S.C. § 1808) son referencia, no consejo.

---

## 9. Checklist AAF

- [ ] `branches.ts` + `calculator.ts` + `fee-amount.ts` + `estimate-filing-date.ts` con tests (fechas límite OBBBA/FY).
- [ ] `regulatory-cache.json` poblado por cron `regulatory-check`; monto FY2026 = 10200¢.
- [ ] `draft-motion.ts` con fallback template + watermark DRAFT; salida PDF (pdf-lib).
- [ ] `generate-receipt` PDF.
- [ ] Torch para estado I-589; questionnaire-scraper solo en worker/local.
- [ ] Tablas de seguimiento + pagos del usuario (doc 08); recordatorios (doc 02 RF-AAF-05).
- [ ] Disclaimers UPL en UI y en el PDF.

---

**Doc 13 · AAF Tracker** · v3.0 · Mayo 2026. Relacionados: 02 (RF-AAF), 05 (P-AAF), 07 (endpoints/Gemini), 08 (datos), 09 (Torch/EOIR/Gemini infra), 10 (UPL/exactitud). Mantener bajo `/docs/`.
