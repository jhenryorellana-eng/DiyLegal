# 07 · Backend y API — DIY Legal

> Contrato de API, endpoints reales (del demo), autenticación, patrón asíncrono, integración Torch/Gemini, idempotencia y resiliencia. Mapea 1:1 con `app/api/**` y `lib/**`.
> Versión 3.0 · Mayo 2026

---

## 1. Principios

- **Contrato uniforme:** `{ ok:true, data }` | `{ ok:false, error:{ kind, message? } }`. El cliente decide por `ok` y `kind`, no por el status crudo.
- **`runtime = "nodejs"`** en toda route que use scraping/PDF/sqlite/Gemini.
- **Gate por flag → 503** `{kind:"ConfigMissing"}`; **Zod → 400**; **backend caído → 502** `{kind:"BackendUnavailable"}`.
- **Asíncrono para flujos con navegador** (EOIR/NVC): `POST` encola y responde **202 {jobId}**; el cliente observa por Realtime/polling. (doc 09 §14)
- **Dos orígenes de datos:** Capa A (privado, Supabase, requiere sesión) y Capa B (oficial, mayormente público) — doc 06.
- **Idempotencia y resiliencia** según `sistemas-profesionales-empresariales.md` (§7-8).

---

## 2. Kinds de error (catálogo)

| kind | status | Origen |
|---|---|---|
| `ConfigMissing` | 503 | Flag apagado / falta env |
| (Zod) `ValidationError` | 400 | Body/query inválidos |
| `BackendUnavailable` | 502 | Fuente externa caída |
| `InvalidInput` | 400 | EOIR: A-Number/nacionalidad |
| `CaseNotFound` | 404 | EOIR/USCIS/NVC: no existe |
| `CaptchaInvalid` | 401 | EOIR: token hCaptcha rechazado (doc 09 §4) |
| `RateLimited` | 429 | Límite de fuente o de usuario (+ `Retry-After`) |
| `SchemaError` | 500 | Respuesta no valida contra Zod |
| `Unauthorized` | 401 | USCIS Torch / sesión |
| `ReceiptNotFound` | 404 | USCIS Torch |
| `Unknown` | 500 | No clasificado |

> El cliente traduce cada `kind` a un mensaje **sin jerga** (doc 04/05). `CaptchaInvalid`/`RateLimited` → "el sistema oficial está ocupado, reintenta en un momento" + modo diferido.

---

## 3. Autenticación

- **Usuario (Capa A):** Supabase Auth (JWT). Las routes privadas validan sesión y aplican **RLS** (doc 08). El worker usa **service role** para persistir resultados.
- **Crons (Capa B):** `authorizedCron(req)` exige `Authorization: Bearer <INTERNAL_CRON_SECRET>` o `x-vercel-cron-secret` → `401` si falla.
- **Servicios externos:** Torch (OAuth client_credentials), HyperBrowser/2Captcha/Gemini/proxy con keys **server-side** (doc 09 §18). **Nunca** se exponen al cliente.

---

## 4. Endpoints

### 4.1 Casos del usuario (Capa A → encola Capa B)
| Endpoint | Método | Cuerpo | Respuesta | Notas |
|---|---|---|---|---|
| `/api/user/cases` | GET | — | `{ ok, data: Case[] }` | Casos del usuario (RLS). |
| `/api/user/cases` | POST | `{ source:"eoir"\|"uscis"\|"nvc", … }` | **202** `{ ok, data:{ jobId } }` (EOIR/NVC) · `{ ok, data:Case }` (USCIS) | EOIR/NVC asíncrono. |
| `/api/user/cases/:id/refresh` | POST | — | 202 `{ jobId }` | Respeta **cooldown**/cuota. |
| `/api/jobs/:jobId` | GET | — | `{ ok, data:{ status, result?, error? } }` | Polling; o Realtime. |

### 4.2 Integración EOIR / NVC (Capa B, las usa el worker/encolador)
| Endpoint | Método | Query/Body | Notas |
|---|---|---|---|
| `/api/eoir/intelligence/case` | GET | `baseCityCode&judgeCode\|judgeName` | Payload agregado caso+corte+juez. |
| `/api/eoir/courts` · `/courts/[slug]` · `/courts/by-code/[code]` · `/judges/[code]` | GET | — | Court Intelligence (doc 09 §8). Flag `AAF_ENABLE_COURT_INTELLIGENCE`. |
| `/api/legal/nvc-ceac` | GET | `caseNumber&type=IV\|NIV&passport&surname` | `maxDuration=300`. Flag `FEEDS_ENABLE_NVC_CEAC`. |

> La consulta de **estado EOIR** se ejecuta en el worker (HyperBrowser+2Captcha, doc 09 §4) y su resultado se persiste en el caso del usuario; el payload agregado se compone con Court Intelligence.

### 4.3 USCIS (Torch API oficial)
| Endpoint | Método | Cuerpo | Notas |
|---|---|---|---|
| `/api/cases/uscis-status` | POST | `{ receipt }` | OAuth Torch; valida `receipt-format`; `USCIS_MOCK` en dev. Flag `AAF_ENABLE_USCIS`. |
| `/api/cases/uscis-aaf-check` | POST | `{ … }` | Cuestionario AAF (Playwright `my.uscis.gov`) — **solo worker/local**. |

### 4.4 AAF (doc 13)
`/api/aaf/calculate` (POST) · `/api/aaf/validate` (POST, `AAF_ENABLE_GEMINI`) · `/api/aaf/generate-motion` (POST, `AAF_ENABLE_MOTION`, devuelve **PDF**) · `/api/aaf/generate-receipt` (POST, **PDF**) · `/api/aaf/regulatory/current` (GET).

### 4.5 Feeds / estáticos / tools / legal
| Endpoint | Método |
|---|---|
| `/api/feeds/regulations?term=&agency=&perPage=` · `/travel-advisories?country=` · `/visa-bulletin` · `/fees?form=` · `/country-report?country=` (off) · `/processing-times?form=&office=` | GET |
| `/api/static/civics?version=\|filingDate=` · `/vaccines` · `/dmv-manual?state=` · `/real-id?state=` | GET |
| `/api/tools/itin-check?itin=&lastUsedYear=` · `/selective-service?birthYear=&status=&male=&registered=&presentUS=` · `/i94-parse` (POST multipart) | GET/POST |
| `/api/legal/legal-aid?state=` | GET |

Todas: `runtime="nodejs"`, gate por flag (503), Zod (400), `{ok,data}` (doc 09 §9-12).

### 4.6 Crons (12) — `/api/cron/*`
`regulatory-check` (06:00) · `federal-register-sync` (05:00) · `icpm-check` (lun 06:00) · `travel-advisories-sync` (lun 09:00) · `eoir-status-sync` (cada 6h) · `visa-bulletin-sync` (día 1, 10:00) · `eoir-court-details-sync` (07:30) · `fee-schedule-sync` (día 1, 12:00) · `trac-judge-stats-sync` (lun 08:00) · `processing-times-sync` (14:00). Todos con `authorizedCron`. (vercel.json, doc 12)

### 4.7 Billing
`/api/billing/checkout` (POST, crea sesión Stripe) · `/api/billing/webhook` (POST, **firma HMAC** verificada; activa/renueva Pro). Gating por plan en backend (doc 08).

---

## 5. Patrón asíncrono (EOIR/NVC) — detalle

```
Cliente            API (Vercel)         Cola            Worker            Supabase
  │  POST /cases  ───►  valida+encola ──► job(queued) ─►  toma (conc.1-2)
  │  ◄── 202 {jobId}                                      HyperBrowser+2Captcha
  │  (Realtime sub)                                       captura eoir-ws JSON
  │                                                       persiste resultado ──► UPDATE case
  │  ◄────────────── Realtime: case.updated ◄──────────────────────────────────┘
```
- Estados del job: `queued → running → done | failed`. Reintentos con backoff; al agotar → **DLQ** + notificación "no pudimos consultar, intenta luego".
- Idempotencia: `Idempotency-Key` por (usuario, caso, ventana) evita encolar duplicados.

---

## 6. Integración Gemini (doc 09 §3.5, doc 13)
- Cliente singleton `gemini-2.5-pro`; variante JSON (temp 0.2) y **grounded** (googleSearch, temp 0.1).
- Usos: **mociones AAF** (`draft-motion`, con fallback template + watermark DRAFT), **regulatory-check** (cron grounded), **ICPM**, **validación de cálculo**, **OCR I-94** (Gemini Vision), **asistente IA**.
- **Guardrails IA (UPL, doc 10 §2):** system prompt que prohíbe consejo legal específico/estrategia/predicción de resultado; respuestas con disclaimer; si la consulta pide asesoría → redirige a abogado/Legal Aid. Salidas tratadas como **borrador/informativo**. Sin PII a logs.

---

## 7. Resiliencia y rendimiento (reglas de sistemas-profesionales-empresariales)
- **Retries con backoff + jitter** en fuentes externas; **circuit breaker** y **kill switch** por fuente; **bulkheads** (el worker de navegador no tumba la API).
- **Rate limiting** por usuario (token bucket) → `429 + Retry-After`.
- **Caching** por fuente con TTL; **paginación por cursor** en listados.
- **Idempotencia** en POST que mutan; **outbox** para eventos de dominio (notificaciones); **DLQ** para jobs fallidos.
- **maxDuration=300** en endpoints con navegador; objetivos de latencia en doc 03.
- Webhooks (Stripe) con **verificación HMAC** y dedupe por event id.

---

**Doc 07 · Backend y API** · v3.0 · Mayo 2026. Relacionados: 06 (arquitectura), 08 (datos/RLS), 09 (integración/worker), 10 (UPL/seguridad), 13 (AAF). Mantener bajo `/docs/`.
