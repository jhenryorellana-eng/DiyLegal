# 09 · Integración de datos y scraping — DIY Legal

> Subsistema de adquisición de datos oficiales. **Corazón técnico** del producto. Basado en el demo real (`REPLICATION-GUIDE.md`): infraestructura compartida, patrón transversal, y cada fuente con su método real, endpoint, cache, cron y flag. Sin placeholders.
> Versión 3.0 · Mayo 2026

> **Regla de oro (UX + seguridad):** todo este subsistema vive en el **backend**; el usuario nunca ve captcha/scraping/proxy ni copia tokens. Todas las API keys son server-side (`.env.local`).

---

## 1. Principios

1. **Método por fuente, no dogma.** Se usa el camino que **realmente funciona** para cada sitio: API oficial cuando existe (USCIS Torch), endpoint interno + captcha cuando el portal lo exige (EOIR), captcha de imagen (NVC), mirror cuando hay Cloudflare (processing times), fetch/cheerio/pdf para datos públicos.
2. **Asíncrono por defecto en flujos con navegador.** EOIR/NVC encolan un job; nunca bloquean el request HTTP del usuario (ver §14 y doc 07).
3. **Cache agresivo + cooldown + cuotas.** Cada captcha y cada sesión de navegador cuesta dinero (§15).
4. **Tolerancia a fallos del sitio.** Detección defensiva de captcha/Cloudflare, parseo tolerante (Zod), fallback, reintentos con backoff, kill switch.
5. **Datos sensibles, exactos.** Tarifas y plazos se muestran tal cual los publica el gobierno, con fecha/fuente y aviso (doc 10).
6. **Provider-agnostic en captcha.** Se puede cambiar 2Captcha ↔ CapMonster ↔ CapSolver por env.

---

## 2. Patrón transversal (replicar una vez, aplicar a las 15 fuentes)

Cada fuente sigue el mismo molde (del demo §3):

1. **Feature flag** en `lib/feeds/config.ts` (helper `flag(name, default=false)` lee env `"true"|"1"`; objeto `FEEDS_CONFIG`). AAF/EOIR usan `lib/aaf/config.ts` (`AAF_CONFIG`).
2. **Obtención:** `fetch` (API JSON) · `cheerio` (HTML) · `pdf-parse` (PDF) · `node:sqlite` (mirror) · estático (JSON commiteado).
3. **Cache** JSON en `lib/<area>/data/*.json` o `data/*.json` (lectura/escritura simple, sin DB para datos de referencia).
4. **Endpoint** `GET/POST /api/.../route.ts`: `export const runtime = "nodejs"`; gate por flag → `503 {ok:false, error:{kind:"ConfigMissing"}}`; valida query/body con **Zod** → `400`; responde `{ ok:true, data }`. Errores de backend → `502 {kind:"BackendUnavailable", message}`.
5. **Cron** `GET /api/cron/<fuente>-sync`: `authorizedCron(req)` (header `Authorization: Bearer <INTERNAL_CRON_SECRET>` o `x-vercel-cron-secret`) → `401`; flag → `503`; ejecuta el sync y persiste el cache.

**Forma de respuesta uniforme:** `{ ok:true, data }` | `{ ok:false, error:{ kind, message? } }`.
**Kinds de error estándar:** `ConfigMissing`(503) · validación Zod(400) · `BackendUnavailable`(502) · y los específicos de EOIR/USCIS (abajo).

---

## 3. Infraestructura compartida (`lib/`)

### 3.1 Captcha solver — `lib/captcha/solver.ts` (provider-agnostic)
Un cliente para 3 proveedores que comparten el **protocolo anti-captcha** (`createTask` → poll `getTaskResult` cada **3s**, timeout **120s**). `resolveProvider()` lee `CAPTCHA_PROVIDER` y mapea base URL + API key.

| Proveedor | Base URL | hCaptcha | reCAPTCHA / imagen |
|---|---|---|---|
| **2Captcha** (default) | `api.2captcha.com` | ✅ (invisible) | ✅ / ✅ |
| CapSolver | `api.capsolver.com` | ❌ (descontinuado) | ✅ / ✅ |
| CapMonster | `api.capmonster.cloud` | ✅ | ✅ / ✅ |

Funciones:
- `solveHCaptcha({ websiteURL, websiteKey, isInvisible, rqdata?, userAgent?, proxy?, signal? })` → con `proxy` usa `HCaptchaTask` (token emitido **desde esa IP**); sin proxy `HCaptchaTaskProxyless`.
- `solveRecaptcha({ websiteURL, websiteKey, version?, enterprise?, pageAction?, minScore? })` → `RecaptchaV2TaskProxyless | RecaptchaV2EnterpriseTaskProxyless | RecaptchaV3TaskProxyless`.
- `solveImageCaptcha(base64, { signal? })` → `ImageToTextTask` (usado por NVC BotDetect).

Token: `solution.gRecaptchaResponse ?? solution.token ?? solution.text`. `errorId !== 0` → `CaptchaInvalid`.

> **Failover hCaptcha:** si 2Captcha rechaza tokens hCaptcha (ver §4 caveat), cambiar `CAPTCHA_PROVIDER=capmonster` (también soporta hCaptcha). CapSolver NO sirve para hCaptcha.

### 3.2 Navegador en la nube — `lib/browser/hyperbrowser.ts`
`withSession(fn, { proxyCountry?, useStealth=true, useProxy? })`: crea sesión Hyperbrowser (`solveCaptchas:false` — el captcha lo resolvemos nosotros; `acceptCookies:true`, `useStealth:true`), conecta Playwright por **CDP** (`chromium.connectOverCDP(session.wsEndpoint)`), entrega `{ page, browser, userAgent }`, y **cierra la sesión en `finally`** (crítico para no fugar costo).
- `useProxy === false` → sin proxy (sitios sin Cloudflare, p. ej. **NVC**).
- BYO proxy (`getProxyConfig()`) → mismas credenciales que se pasan a 2Captcha → **IP match**.
- Sin BYO → proxy interno de Hyperbrowser (`useProxy:true, proxyCountry:"US"`).

### 3.3 Proxy — `lib/browser/proxy.ts`
`getProxyConfig()` lee `PROXY_*` (Webshare/IPRoyal datacenter US) y devuelve `{ server, username?, password?, type, host, port }` (formato dual: `server` con scheme para Hyperbrowser; `host`+`port` para `HCaptchaTask` de 2Captcha). **El IP-match navegador↔2Captcha evita el 401 por IP mismatch.**

### 3.4 HTTP con rate-limit — `lib/eoir/court-intelligence/scrapers/http-client.ts`
`eoirFetch(url, opts)`: rate-limit **por host** (justice.gov **2s**, tracreports.org **3s**), retry con backoff exponencial en 5xx/429, **detección defensiva** de captcha/Cloudflare (`cf-mitigated: challenge`, "just a moment") → lanza `EoirCaptchaDetectedError`. Reutilizado por Visa Bulletin y Legal Aid.

### 3.5 Gemini — `lib/gemini/client.ts`
Singleton lazy de `GoogleGenerativeAI`, modelo **`gemini-2.5-pro`**:
- `getGeminiModel()` → `responseMimeType:"application/json"`, temp **0.2**, 8192 tokens (salida JSON).
- `getGeminiGroundedModel()` → `tools:[{ googleSearch:{} }]` (búsqueda web en vivo), temp **0.1**.
- `extractJson<T>(text)` → parsea JSON tolerando fences ```` ```json ````.

### 3.6 PDF — `lib/feeds/pdf.ts` y `lib/pdf/*`
`fetchPdfText(url)` (pdf-parse v2: `new PDFParse({data}).getText() → .text`) para **leer**; `pdf-lib` para **generar** (mociones, recibos AAF). En `next.config.ts`: `serverExternalPackages:["pdf-parse","pdfjs-dist"]`.

---

## 4. EOIR ACIS — estado de caso en corte (endpoint interno `eoir-ws` + hCaptcha)

**Qué hace:** dado A-Number + nacionalidad + idioma, devuelve estado del caso (próxima audiencia, juez, asylum clock, NTA/docket, apelaciones).

**Por qué NO scraping de DOM:** `acis.eoir.justice.gov` protege el formulario con **hCaptcha invisible** y leer el DOM renderizado **no fue confiable**. La solución robusta es capturar la respuesta **JSON del backend interno que el propio portal invoca**: **`eoir-ws.eoir.justice.gov`**. Sigue siendo 100% automatizado y server-side (HyperBrowser + 2Captcha); el "endpoint interno" es solo *de dónde* salen los datos limpios (la XHR que la página ya hace), no un paso manual.

**Archivos:**
- `lib/eoir/portal-scraper.ts` — orquesta el flujo.
- `lib/eoir/portal-parser.ts` — fallback: parsea DOM con cheerio si no se capturó el JSON.
- `lib/eoir/schemas.ts` — Zod **`CaseInfoResponse`** (contrato reverse-engineered): `Language`, `AlienNumber`, `Data{ ValidAlienNumber, AlienName, OSC_Date, ClockStatus "R"|"S", ElapsedDays, LatestHearingDate, DocketDate, AppealFiled, PendingAtBIA, … }`, `Schedule{ AdjDate, IJ_Code, IJ_Name }`, `Proceeding/Appeal/MTR/Reopen`.
- `lib/eoir/errors.ts` — `EoirHttpError` con `kind`: `InvalidInput|CaseNotFound|CaptchaInvalid|RateLimited|BackendUnavailable|SchemaError|Unknown` → 400/404/401/429/502/502/500.

**Flujo real:**
1. `withSession` abre `acis.eoir.justice.gov` con Hyperbrowser **usando BYO proxy US** (IP del navegador = IP que 2Captcha usará).
2. `addInitScript` inyecta, **antes** de cargar, un interceptor que redefine `window.hcaptcha` para **capturar el callback** que hCaptcha dispara al resolverse (`window.__hcapCallbacks`).
3. Se llena el formulario: 9 inputs del A-Number + react-select de nacionalidad con `pressSequentially` (dispara los eventos de teclado que el framework espera).
4. Se extrae el `sitekey` del HTML (regex) y se resuelve el hCaptcha con `solveHCaptcha({ isInvisible:true, proxy })` (misma IP).
5. Se inyecta el token (textarea `h-captcha-response`, override de `hcaptcha.getResponse()`) y se **invoca el callback capturado** → el portal hace su llamada interna a **`eoir-ws.eoir.justice.gov`**.
6. `page.on("response", …)` filtra por el host interno y **captura el JSON** → valida con `CaseInfoResponse`. Si no se capturó → **fallback** `parseCaseDom`.

**POC:** `scripts/poc-eoir-portal.ts` (`npm run poc:portal -- 012345678 PE`).

> **⚠️ Caveat honesto de estado (del demo):** incluso con IP-match, el token hCaptcha de 2Captcha llegó a ser **rechazado por el backend con 401 "Invalid Captcha"** (ticket abierto con 2Captcha). La pieza reutilizable de mayor valor es el **conocimiento del endpoint interno y su esquema** (`eoir-ws` + `CaseInfoResponse`): **con un token hCaptcha válido, la consulta directa al endpoint interno es la vía robusta.** El parseo del DOM quedó como fallback.
>
> **Mitigaciones para producción:** (a) failover de proveedor a **CapMonster** para hCaptcha; (b) garantizar IP-match estricto; (c) retry con backoff y nuevo token; (d) si la tasa de éxito cae, **kill switch** → modo diferido ("te avisamos"); (e) monitor de tasa de éxito y costo por intento (§16, doc 12).

---

## 5. NVC CEAC — estado consular (captcha de imagen, **funciona**) — `lib/legal/nvc-ceac.ts`

**Por qué funciona:** `ceac.state.gov/CEACStatTracker/Status.aspx` es un **formulario ASP.NET clásico** (POST tradicional, sin anti-bot SPA ni Cloudflare); su captcha es **BotDetect (imagen)** → OCR con 2Captcha.

**Flujo:**
1. `withSession({ useProxy:false })` (no necesita proxy).
2. `page.goto(URL)`, selecciona `#Visa_Application_Type`, llena `#Visa_Case_Number`, `#Passport_Number` (o `"NA"`), `#Surname` (o `"NA"`).
3. Descarga la imagen del captcha (`img[src*="BotDetect"]` → Blob → FileReader → base64) y la resuelve con `solveImageCaptcha(base64)`.
4. Llena `#Captcha`, submit (`input[type=submit]` / `<a>Submit</a>` / fallback Enter), `waitForLoadState("networkidle")`.
5. Parsea contra `NVC_STATUSES` (At NVC, In Transit, Ready, At Embassy, Issued, Refused, Administrative Processing…). "does not match" → reintenta.
6. **Retry `MAX_ATTEMPTS=3`** (cada intento recarga: nuevo captcha + viewstate). OCR ~80%/intento → ~98% acumulado.

**Endpoint:** `GET /api/legal/nvc-ceac?caseNumber=&type=IV|NIV&passport=&surname=`, `maxDuration=300`. Devuelve `{ caseNumber, applicationType, found, status, details, source }`.

> **Operación:** flujo navegador+captcha **no se lanza en masa**; serializar con cola de concurrencia **1-2** + retry con backoff (§14). Las fuentes GET sí toleran ráfagas.

---

## 6. USCIS — estado de caso (API oficial Torch, OAuth) — `lib/uscis/`

- `torch-client.ts` → OAuth 2.0 **client_credentials** (`USCIS_CLIENT_ID/SECRET`); sandbox `api-int.uscis.gov` / prod `api.uscis.gov` (`USCIS_API_ENV`); `GET /case-status/{receipt}`; cachea token; `USCIS_MOCK=true` devuelve fixtures. Errores `UscisError` (Unauthorized/ReceiptNotFound/RateLimited/…).
- `receipt-format.ts` → valida receipt (3 letras [IOE/EAC/WAC/LIN/SRC/MSC/NBC/YSC] + 10 dígitos).
- `questionnaire-scraper.ts` → Playwright sobre `my.uscis.gov` (status del cuestionario AAF); **bloqueado en Vercel** (`PlaywrightNotSupported` si `process.env.VERCEL==="1"`) — **solo worker dedicado/local** (ver §14).

**Endpoints:** `POST /api/cases/uscis-status` · `POST /api/cases/uscis-aaf-check` (local-only).

---

## 7. USCIS Processing Times (mirror diario; directo bloqueado por Cloudflare)

**Por qué mirror:** `egov.uscis.gov/processing-times/api/*` responde **403 `Cf-Mitigated: challenge`** (Cloudflare managed challenge; ni un fetch residencial lo pasa). **Solución:** consumir el **mirror diario [`jzebedee/uscis`](https://github.com/jzebedee/uscis)** (un GitHub Action publica un **SQLite** por release).

**Arquitectura (SQLite solo en el sync; runtime solo lee JSON → portable):**
- `lib/feeds/processing-times/sync.ts`:
  1. `GET api.github.com/repos/jzebedee/uscis/releases/latest` → asset `.db`.
  2. Descarga el SQLite → `data/.processing-times-tmp.db`.
  3. `const { DatabaseSync } = await import("node:sqlite")` (**dynamic import** → no carga en runtime de lectura). Lee `forms`, `offices`, `processing_time`.
  4. Vuelca a `data/processing-times-cache.json` (`{ fetchedAt, release, source, forms, offices, times[] }`).
- `lib/feeds/processing-times/index.ts`: `lookupProcessingTime(form, office?)` filtra el cache (**no importa `node:sqlite`**).
- `types/node-sqlite.d.ts`: declaración mínima del módulo.

**Endpoint:** `GET /api/feeds/processing-times?form=I-130&office=NBC` → `{ form, formName{en,es}, release, publicationDate, offices[]{ office, officeName, subtype, subtypeInfoEs, lower, upper, unit, serviceRequestDate } }`. **Cron:** `processing-times-sync` (diario 14:00 UTC). Script: `node --import tsx scripts/sync-processing-times.ts`.

> Salvedad: datos oficiales con ~24h de retraso. Requiere Node ≥ 22.5 (node:sqlite) o migrar a **`sql.js` (WASM)** si el runtime no lo soporta (relevante para Vercel; ver §14).

---

## 8. Court Intelligence (justice.gov + TRAC) — scraping HTML clásico

**Scrapers** (`lib/eoir/court-intelligence/scrapers/`, vía `eoirFetch`):
- `operational-status.ts` → `justice.gov/eoir/immigration-court-operational-status` (tabla maestra).
- `court-details.ts` → `justice.gov/eoir/{slug}` (dirección, teléfono, emails, jueces, ACIJ, reglas).
- `trac-judge-stats.ts` → `tracreports.org/immigration/reports/judgereports/` + perfil del juez (regex sobre prosa: nombre, corte, FY, tasas, nacionalidades, educación).

**Persistencia** (`persistence/`): `court-cache.json`, `judge-cache.json` (LRU 500), `change-log.json` (detector de cambios; severidad alta si pasa a CLOSED).

**Endpoints:** `GET /api/eoir/courts`, `/courts/[slug]`, `/courts/by-code/[code]`, `/judges/[code]`, **`/intelligence/case?baseCityCode&judgeCode|judgeName`** (payload agregado).
**Crons:** `eoir-status-sync` (cada 6h), `eoir-court-details-sync` (diario, top-20 + cambios + stale, cap 25), `trac-judge-stats-sync` (semanal).

---

## 9. Feeds gubernamentales (sin captcha) — `lib/feeds/`

| # | Fuente | Archivo | URL / método | Endpoint | Cron |
|---|---|---|---|---|---|
| 1 | **Federal Register** | `federal-register.ts` | `federalregister.gov/api/v1/documents.json` (fetch, sin key, `agencies=u-s-citizenship-and-immigration-services`) | `/api/feeds/regulations?term=&agency=&perPage=` | `federal-register-sync` (diario 05:00) |
| 2 | **Travel Advisories** | `travel-advisories.ts` | `cadataapi.state.gov/api/TravelAdvisories` (fetch; **requiere UA de navegador**; parsea `Title`→nivel 1-4) | `/api/feeds/travel-advisories?country=` | `travel-advisories-sync` (lun 09:00) |
| 3 | **Visa Bulletin** | `visa-bulletin.ts` | `travel.state.gov/.../visa-bulletin-for-{mes}-{año}.html` (cheerio vía `eoirFetch`; filtra tablas decoy; fallback a meses previos) | `/api/feeds/visa-bulletin` | `visa-bulletin-sync` (día 1, 10:00) |
| 4 | **Country Reports** ⚠️off | `country-reports.ts` | `state.gov/reports/2024-country-reports-on-human-rights-practices/{slug}/` (fetch UA navegador; cheerio; cache 7 días) | `/api/feeds/country-report?country=` | on-demand |
| 5 | **Fee Schedule G-1055** | `fee-schedule.ts` | `uscis.gov/.../g-1055.pdf` (pdf-parse) | `/api/feeds/fees?form=N-400` | `fee-schedule-sync` (día 1, 12:00) |

**Detalle crítico G-1055:** el parser **no simplifica** a un precio — devuelve las **líneas exactas** (`feeLines: string[]`), porque I-589 tiene varias (filing fee + AAF). UI con **aviso obligatorio**: "confirma el monto exacto; si pagas de menos, USCIS rechaza y no devuelve". **Nunca interpretar/omitir dígitos** (doc 10).

---

## 10. Datos estáticos — `lib/static-data/` (JSON commiteado, sin fetch en runtime)

| # | Fuente | Datos | Endpoint |
|---|---|---|---|
| 6 | **Civics** | `civics-2008.json` (100q) / `civics-2025.json` (128q), generados por `scripts/build-civics-data.ts` desde el `.txt` oficial (decodificación Windows-1252). Regla: N-400 < 2025-10-20 → 2008, ≥ → 2025 | `/api/static/civics?version=2025\|filingDate=` |
| 7 | **Vacunas I-693** | Lista CDC/USCIS (sin COVID desde 2025-03-11) | `/api/static/vaccines` |
| 8 | **Manuales DMV** | 12 estados (CA,TX,NY,FL,IL,NJ,AZ,GA,NC,WA,NV,VA): PDF EN/ES + homepage | `/api/static/dmv-manual?state=CA` |
| 9 | **REAL ID** | `REAL_ID_FEDERAL` (docs, `enforcedSince:2025-05-07`) + por estado `offersStandardLicense` (CA AB60, NY Green Light, IL, NJ, WA, NV, VA sí; TX/FL/AZ/GA/NC no) | `/api/static/real-id?state=CA` |

---

## 11. Herramientas locales — `lib/tools/` (lógica pura, sin red, sin PII a terceros)

| # | Herramienta | Lógica | Endpoint |
|---|---|---|---|
| 10 | **Detector ITIN** | Regla IRS de 3 años (vence 31-dic del 3er año sin uso). Valida `^9\d{8}$`, enmascara `9XX-XX-####`. Estados active/expiring/expired/unknown | `/api/tools/itin-check?itin=&lastUsedYear=` |
| 11 | **Selective Service** | Hombres 18-25 deben registrarse (incl. indocumentados); exentos no-inmigrantes (F/J/H); 26+ sin registro → Status Information Letter (bloquea N-400). No pide SSN | `/api/tools/selective-service?birthYear=&status=&male=&registered=&presentUS=` |
| 12 | **I-94 (mediado)** | Subida de PDF del usuario → OCR con **Gemini Vision** → historial entradas/salidas. No consulta CBP directamente | `POST /api/tools/i94-parse` (multipart) |

## 12. Ayuda legal gratuita — `lib/legal/legal-aid.ts`
`immigrationlawhelp.org/search?state=XX` (fetch + cheerio, `.directory-organization-summary`, cache memoria 1h). `GET /api/legal/legal-aid?state=CA`. Presentado como ayuda gratuita/pro bono (doc 01 §4).

---

## 13. Funcionalidades NO logradas — requieren ingeniería inversa del endpoint interno

> No se documenta solución porque **no se logró automatizar**. Camino correcto: identificar la API JSON interna que la SPA consume y replicar su request/response (como EOIR), o IP residencial real, o flujo mediado por el usuario.

- **CBP I-94 directo** (`i94.cbp.dhs.gov`): SPA con **reCAPTCHA Enterprise** + detección de IP datacenter (el submit ni dispara la llamada). Workaround disponible: **modo mediado** (usuario sube su PDF, §11 #12). La automatización directa **no se logró**.
- **ICE Detainee Locator** (`locator.ice.gov`): SPA Angular + **reCAPTCHA v3** + anti-bot de infraestructura (score bajo con headless+datacenter). Sin PDF → sin user-mediated. **No automatizado.**
- **I-901 SEVIS** (`fmjfee.com/i901fee/...`): SPA montado por JS, bajo ROI. **No automatizado.**

---

## 14. Modelo de ejecución asíncrona y dónde corre el worker

**Problema:** los flujos con navegador (EOIR, NVC, questionnaire-scraper) **no corren en funciones de Vercel** (Playwright bloqueado: `PlaywrightNotSupported` si `VERCEL==="1"`) y **no deben lanzarse en masa**.

**Diseño:**
- **Vercel (o equivalente serverless):** sirve la UI, las API routes **GET** (feeds, estáticos, tools, processing-times read), USCIS Torch (API), AAF (cálculo + PDF), y los **crons** ligeros.
- **Worker dedicado (contenedor long-running):** ejecuta HyperBrowser + 2Captcha (EOIR, NVC) y el questionnaire-scraper. Consume una **cola** con **concurrencia 1-2** y retry con backoff. La app encola un job (`POST /api/cases` → **202 {jobId}**) y el cliente observa por Realtime/polling (doc 07). `maxDuration=300` donde aplica.
- **processing-times sync:** corre donde haya Node ≥ 22.5 (node:sqlite); si el cron vive en Vercel, usar `sql.js` (WASM) o ejecutar el sync en el worker y publicar el JSON.

> Esto reconcilia el demo (Next.js + Vercel) con la realidad operativa: lo pesado y con navegador va al worker; lo liviano y público va a Vercel. Ver doc 06 (despliegue) y doc 12.

---

## 15. Estrategia de costo

- **Cache** por fuente (TTL acorde: cortes/jueces días, feeds horas/semana, casos por usuario hasta refresco).
- **Cooldown** de refresco por caso (evita reconsultas seguidas).
- **Cuotas por plan** (Free vs Pro) sobre consultas con navegador/Gemini.
- **Presupuesto** diario/mensual de 2Captcha/HyperBrowser/Gemini con **alerta + corte automático** (kill switch) (doc 12 §6).
- `reportbad` (o equivalente) al proveedor en fallos para no pagar soluciones inválidas.
- Métrica **costo por caso activo** vigilada vs precio Pro ($17).

---

## 16. Resiliencia y observabilidad

- **Resiliencia:** detección defensiva captcha/Cloudflare (`eoirFetch`), parseo tolerante + Zod, fallback (DOM en EOIR; meses previos en Visa Bulletin), retry+backoff, circuit breaker por fuente, **kill switch** por fuente, cierre de sesión en `finally`.
- **Observabilidad:** tracing por etapa (encolado→sesión→captcha→captura/parseo→persistencia) con IDs correlacionados; métricas (tasa de éxito por fuente, latencia por etapa, **costo de captcha/día**, reintentos, tamaño de DLQ); alertas (caída de éxito EOIR/NVC, gasto sobre presupuesto, corte CLOSED).
- **Scrubbing PII obligatorio** en logs/trazas: A-Number, nombres y tokens **redactados** (doc 10).

## 17. Testing
- **Parser/fixtures:** `AcisParser`, `CaseInfoResponse`, parsers de feeds y G-1055 contra **fixtures HTML/PDF/JSON reales** (sin tocar el sitio en CI). Casos: sin captcha, captcha distinto, caso no encontrado, HTML cambiado, fee con múltiples líneas.
- **Panel de prueba** `app/dev/feeds-test/page.tsx` (no producción): una sonda por fuente (`PROBES`: aid, ta, cr, fee, pt, reg, vb, civ, vac, dmv, nvc, itin, rid, sss + `i94`), útil para verificación E2E con Playwright.
- Pruebas contra sitios reales: suite manual/programada aparte con presupuesto de captcha.

---

## 18. Variables de entorno y flags

**Servicios (server-side, en `.env.local`; el demo trae valores enmascarados → ROTAR):**
`GEMINI_API_KEY` · `USCIS_CLIENT_ID` / `USCIS_CLIENT_SECRET` / `USCIS_API_ENV` · `HYPERBROWSER_API_KEY` · `TWOCAPTCHA_API_KEY` · `CAPSOLVER_API_KEY` · `CAPTCHA_PROVIDER` (`twocaptcha`|`capsolver`|`capmonster`) · `PROXY_SERVER` / `PROXY_USERNAME` / `PROXY_PASSWORD` / `PROXY_TYPE` · `INTERNAL_CRON_SECRET`.

**Flags (default `false`):**
- **AAF:** `AAF_ENABLE_USCIS`, `AAF_ENABLE_GEMINI`, `AAF_ENABLE_REGULATORY_CHECK`, `AAF_ENABLE_MOTION`, `AAF_ENABLE_NOTIFICATIONS`, `AAF_ENABLE_ICPM_GROUNDING`, `AAF_ENABLE_LEGAL_CITATION_VALIDATOR`, `AAF_BYPASS_VALIDATORS` (nunca true en prod), `USCIS_MOCK`.
- **Court Intelligence:** `AAF_ENABLE_COURT_INTELLIGENCE`, `AAF_ENABLE_JUDGE_STATS`, `AAF_ENABLE_COURT_CHANGE_ALERTS`, `AAF_ENABLE_COURT_INTELLIGENCE_CRON`.
- **Feeds/tools:** `FEEDS_ENABLE_FEDERAL_REGISTER`, `_TRAVEL_ADVISORIES`, `_VISA_BULLETIN`, `_COUNTRY_REPORTS` (off por decisión), `_PROCESSING_TIMES`, `_FEE_SCHEDULE`, `_CIVICS`, `_VACCINES`, `_DMV`, `_REAL_ID`, `_LEGAL_AID`, `_NVC_CEAC`, `_ITIN`, `_SELECTIVE_SERVICE`, `_I94`.

---

## 19. Checklist de implementación

- [ ] Infra: `captcha/solver` (3 proveedores), `browser/hyperbrowser` (`finally`), `browser/proxy` (IP-match), `eoirFetch` (rate-limit+defensiva), `gemini/client`, `pdf`.
- [ ] EOIR: `portal-scraper` + `schemas (CaseInfoResponse)` + `errors` + fallback `portal-parser`; failover hCaptcha (CapMonster); kill switch.
- [ ] NVC: `nvc-ceac` con `solveImageCaptcha` + retry 3; `maxDuration=300`.
- [ ] USCIS: `torch-client` (OAuth) + `receipt-format`; `USCIS_MOCK` para dev.
- [ ] Processing times: `sync` (node:sqlite dynamic import) + `index` (lee JSON) + `types/node-sqlite.d.ts`; cron 14:00.
- [ ] Court Intelligence: 3 scrapers + caches + change-log; crons 6h/diario/semanal.
- [ ] Feeds (5) + estáticos (4) + tools (3) + legal-aid, cada uno con flag + Zod + cache.
- [ ] Worker dedicado para flujos con navegador + cola concurrencia 1-2 (doc 06/12).
- [ ] `authorizedCron` en todos los `/api/cron/*`; 12 crons en `vercel.json`.
- [ ] Cache + cooldown + cuotas + presupuesto con corte; scrubbing PII; tracing; fixtures + panel `/dev/feeds-test`.
- [ ] Revisión legal del scraping (doc 10).

---

**Doc 09 · Integración de datos y scraping** · v3.0 · Mayo 2026. Relacionados: 02 (RFs), 06 (despliegue/worker), 07 (API/`{ok,data}`/Torch/Gemini), 08 (caches vs Postgres), 10 (legal/exactitud/scrubbing), 12 (crons/costo/runbooks), 13 (AAF). Mantener bajo `/docs/`.
