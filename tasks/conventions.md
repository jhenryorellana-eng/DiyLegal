# DIY Legal — Convenciones del proyecto

> Reglas transversales extraídas de los PRDs (00, 06, 07, 09). Aplican a TODO el código. Si un PRD de un slice especifica algo más concreto, ese gana.

## Respuesta de API (invariable)
- Éxito: `{ ok: true, data }` · Error: `{ ok: false, error: { kind, message? } }`.
- `kind → status`: ConfigMissing→503, ValidationError→400, BackendUnavailable→502, CaseNotFound→404, ReceiptNotFound→404, CaptchaInvalid→401, Unauthorized→401, RateLimited→429, SchemaError→500, Unknown→500.
- Helpers únicos: `lib/http/response.ts` (`ok()`, `err()`). Nunca construir respuestas a mano.

## Patrón transversal por slice (las 15 fuentes lo siguen igual)
`flag (config) → obtención (fetch/cheerio/pdf/sqlite/estático) → cache JSON → endpoint (runtime="nodejs", gate 503 si flag off, Zod 400, {ok,data}, 502 backend) → cron (authorizedCron 401, flag 503, persiste)`.

## Feature flags
- Toda fuente nace detrás de un flag en **false** (`lib/feeds/config.ts` / `lib/aaf/config.ts`).
- `flag(name, default=false)`: lee env `true|1`. Rollout gradual + kill switch.

## Datos y tipos
- **Dinero en centavos** (entero). **Fechas en UTC**. **IDs no autoincrementales** (uuid).
- Validación con **Zod v4** en todo borde (entrada de API, parsers, respuestas externas).
- TypeScript **strict**, sin `any`. Target ES2017, moduleResolution `bundler`, alias `@/*`.

## Seguridad / UPL (no negociable)
- Frontera **UPL**: informar/organizar, **nunca asesorar**. Disclaimers omnipresentes.
- Datos sensibles (tarifas G-1055, processing times): mostrar **valor exacto oficial + fecha/fuente + aviso**; nunca interpretar dígitos ni simplificar líneas.
- **Todas las claves server-side**, solo en `.env.local` (git-ignored). Claves del demo vienen enmascaradas → **rotar antes de usar**.
- PII (A-Number, receipts): cifrado a nivel columna (pgcrypto) + masking en UI/logs. Tools personales = lógica local, sin enviar PII a terceros.
- Supabase: **RLS en TODAS las tablas** de Capa A (`user_id = auth.uid()`). service_role NUNCA al cliente.

## Despliegue (split obligatorio)
- Vercel: UI + API GET (feeds/static/tools) + USCIS Torch + AAF cálculo/PDF + crons ligeros. **NO** browser/Playwright.
- Worker dedicado (contenedor long-running): HyperBrowser + 2Captcha → EOIR, NVC, questionnaire. Concurrencia 1-2 + retry backoff + DLQ.
- Flujos con navegador = asíncronos: `POST → 202 {jobId}` → progreso por Realtime → persiste con service role.

## Costo (conciencia obligatoria)
- Cada consulta browser+captcha (EOIR/NVC) y cada llamada Gemini **cuesta dinero**. Cachear agresivamente, cooldown, cuotas por plan, presupuesto con corte automático.

## Estilo de código (CLAUDE.md global)
- Funciones ≤ 50 líneas. Archivos ≤ 300 líneas. Sin dead code, sin TODOs huérfanos, sin `console.log` permanente (usar logger). Sin magic strings/numbers (constantes/enums). Catch vacío prohibido. Si repite 3+ veces → abstraer.

## Idioma
- Producto bilingüe ES/EN (preferencia ES). Código/identificadores en inglés; copy de usuario localizado.
