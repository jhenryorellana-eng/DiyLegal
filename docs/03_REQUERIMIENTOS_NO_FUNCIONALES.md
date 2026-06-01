# 03 · Requerimientos no funcionales — DIY Legal

> RNFs basados en las reglas de `sistemas-profesionales-empresariales`. Cada uno con métrica objetivo y mecanismo de verificación.
> Versión 3.0 · Mayo 2026 (actualizado con el demo real REPLICATION-GUIDE.md)

**Convención:** `RNF-<categoría>-<n>`.

---

## 1. Performance

> Objetivo global: **primera carga < 2s**, contenido visible sin demora perceptible.

| ID | Requisito | Métrica objetivo | Mecanismo |
|---|---|---|---|
| RNF-PERF-01 | Largest Contentful Paint | LCP < 2.5s (p75) | RSC + streaming SSR, AVIF/WebP, critical CSS inline |
| RNF-PERF-02 | First Contentful Paint | FCP < 1.0s | Edge rendering (Vercel), code splitting por ruta |
| RNF-PERF-03 | Time to Interactive | TTI < 3.0s | Hidratación selectiva, Client Components mínimos |
| RNF-PERF-04 | Interaction to Next Paint | INP < 200ms | Debounce, optimistic UI, evitar trabajo en main thread |
| RNF-PERF-05 | Cumulative Layout Shift | CLS < 0.1 | Dimensiones reservadas, skeletons del mismo tamaño |
| RNF-PERF-06 | Total Blocking Time | TBT < 200ms | Lazy load de no-críticos |
| RNF-PERF-07 | API latency | p95 < 300ms (endpoints de lectura cacheados) | Cache multinivel + read replicas |
| RNF-PERF-08 | Performance budget en CI | build falla si excede budget | Lighthouse CI por PR |

**Estrategia de carga (de las reglas empresariales):**
- Caching multinivel: browser → CDN (Vercel/Cloudflare) → edge → app cache → DB query cache → vistas materializadas.
- Invalidación: stale-while-revalidate (SWR) + TTL + cache-aside.
- **Cursor-based pagination** siempre (jamás `OFFSET … LIMIT`).
- Evitar N+1 (eager loading / batching).
- Compresión Brotli; HTTP/2 o HTTP/3.
- Assets estáticos versionados con hash (`app.a3f9c2.js`) → cache forever.

> **Nota crítica de performance para el scraping:** la consulta a EOIR (HyperBrowser + 2Captcha) **no es** un camino de baja latencia (puede tardar segundos). Por eso **nunca** bloquea el render del dashboard: se sirve el estado cacheado del caso y el refresco es asíncrono/diferido. Ver doc 09.

---

## 2. Seguridad

| ID | Requisito | Mecanismo |
|---|---|---|
| RNF-SEC-01 | TLS 1.2+ obligatorio | HSTS, redirección forzada |
| RNF-SEC-02 | Secrets fuera del código | Vault / env del proveedor; nunca en repo |
| RNF-SEC-03 | OWASP Top 10 mitigado | Input validation (Zod), CSP, sanitización |
| RNF-SEC-04 | Cifrado de PII en reposo | Cifrado client-side de documentos; Filecoin cifrado |
| RNF-SEC-05 | Seguridad a nivel BD | **RLS** en todas las tablas con datos de usuario |
| RNF-SEC-06 | Auth segura | JWT corto + refresh; cookies HttpOnly+Secure+SameSite |
| RNF-SEC-07 | Rate limiting | Por usuario/IP/endpoint; token bucket; `429 + Retry-After` |
| RNF-SEC-08 | Protección DDoS / WAF | Cloudflare/Vercel WAF |
| RNF-SEC-09 | Scrubbing de PII en logs | A-Number, emails, IPs nunca en claro en logs/Sentry |
| RNF-SEC-10 | Manejo de credenciales de captcha | API key de 2Captcha y credenciales de HyperBrowser solo server-side, en el worker aislado; nunca expuestas al cliente |

> El cliente **nunca** ve la API key de 2Captcha ni interactúa con el resolvedor. Todo el subsistema de scraping vive en el backend (Edge Function / worker). Ver doc 09 y doc 10.

---

## 3. Resiliencia y tolerancia a fallos

| ID | Requisito | Mecanismo |
|---|---|---|
| RNF-RES-01 | Idempotencia en endpoints mutativos | `Idempotency-Key` header + tabla de keys (TTL 24h–7d), hash del body |
| RNF-RES-02 | Reintentos con backoff + jitter | 1s,2s,4s,8s + jitter; en scraping y llamadas externas |
| RNF-RES-03 | Circuit breakers | En 2Captcha, HyperBrowser, Gemini, Stripe, GREEN-API. Estados Closed→Open→Half-Open |
| RNF-RES-04 | Timeouts en cada capa | timeout cliente < timeout servidor; scraping con timeout duro |
| RNF-RES-05 | Graceful degradation | Si scraping cae → mostrar último estado cacheado; si IA cae → mensaje + reintento |
| RNF-RES-06 | Dead Letter Queue | Jobs de scraping que fallan tras N reintentos → DLQ para inspección |
| RNF-RES-07 | Health checks | Liveness + readiness separados |
| RNF-RES-08 | Graceful shutdown | SIGTERM → drenar requests/jobs en vuelo → SIGKILL |
| RNF-RES-09 | Kill switches | Apagar el scraping/IA/WhatsApp en caliente sin deploy |
| RNF-RES-10 | Maintenance mode | Página explicativa elegante, no 500 |

---

## 4. Disponibilidad y escalabilidad

| ID | Requisito | Objetivo |
|---|---|---|
| RNF-AV-01 | Uptime del servicio core | 99.9% mensual (SLO) |
| RNF-AV-02 | Error budget | Definido por SLO; gobierna releases |
| RNF-AV-03 | Auto-scaling | Horizontal según RPS/latencia/tamaño de cola (worker de scraping escala por profundidad de cola) |
| RNF-AV-04 | Connection pooling | PgBouncer/Supavisor para Postgres |
| RNF-AV-05 | Read replicas | Lecturas a réplicas; escritura a primaria |
| RNF-AV-06 | Backpressure en scraping | Si la cola crece más rápido que el throughput, se pausa el encolado y se prioriza por proximidad de audiencia |
| RNF-AV-07 | Distributed lock en crons | Un solo runner del cron de refresco aunque haya réplicas (lock con TTL) |

---

## 5. Base de datos

| ID | Requisito | Mecanismo |
|---|---|---|
| RNF-DB-01 | Transacciones donde corresponda | ACID; nivel Serializable para billing |
| RNF-DB-02 | Migraciones expand-contract | Sin downtime; compatibilidad hacia atrás |
| RNF-DB-03 | Backups + restore probado | Backups automáticos; restore testeado periódicamente |
| RNF-DB-04 | Índices monitoreados | `EXPLAIN ANALYZE`; índices en FKs y columnas de filtro |
| RNF-DB-05 | Soft deletes + audit columns | `deleted_at`, `created_at`, `updated_at`, `version` |
| RNF-DB-06 | Money en enteros | Centavos; jamás floats |
| RNF-DB-07 | UUIDs públicos | No exponer IDs autoincrementales/cardinalidad |
| RNF-DB-08 | Tiempos en UTC | Conversión a zona local solo en presentación |
| RNF-DB-09 | Optimistic locking | Columna `version` en updates concurrentes |
| RNF-DB-10 | Particionamiento | Tablas de alto volumen (logs de scraping, eventos) particionadas por fecha |

---

## 6. API y contratos

| ID | Requisito | Mecanismo |
|---|---|---|
| RNF-API-01 | Versionado | `/v1/` en URL |
| RNF-API-02 | Backward compatibility | Solo agregar campos opcionales; deprecation 6–12 meses |
| RNF-API-03 | Contrato OpenAPI | Spec mantenida; tipos compartidos front/back (paquete `types`) |
| RNF-API-04 | Webhooks robustos | Firma HMAC, reintentos con backoff, idempotencia por `event_id`, replay |
| RNF-API-05 | Quotas por plan | Cuotas de IA y de refrescos de caso por tier |
| RNF-API-06 | Request ID / Correlation ID | En cada log y devuelto al cliente para soporte |
| RNF-API-07 | ETag / If-None-Match | 304 en responses condicionales |
| RNF-API-08 | `next_cursor` en paginación | Respuestas con cursor |

---

## 7. Observabilidad

| ID | Requisito | Herramienta |
|---|---|---|
| RNF-OBS-01 | Logs estructurados centralizados | JSON; Better Stack / Supabase Logs |
| RNF-OBS-02 | Métricas (Four Golden Signals) | latencia, tráfico, errores, saturación |
| RNF-OBS-03 | Distributed tracing | Trace del flujo de scraping (encolado → sesión → captcha → parse → persist) |
| RNF-OBS-04 | Error tracking | Sentry (con scrubbing de PII) |
| RNF-OBS-05 | RUM + Web Vitals | Vercel Analytics + PostHog |
| RNF-OBS-06 | Alertas sobre síntomas | Tasa de éxito de scraping < X%, gasto de captcha > $Y/día, latencia p95 > umbral |
| RNF-OBS-07 | Métricas de negocio | MRR, churn, conversión Free→Pro, "primer caso cargado" |
| RNF-OBS-08 | Métricas de costo por usuario | Gasto de captcha/IA por usuario (detección de abuso) |

---

## 8. Compliance y privacidad (resumen — ver doc 10)

| ID | Requisito |
|---|---|
| RNF-CMP-01 | GDPR/CCPA: right to access + right to be forgotten implementados |
| RNF-CMP-02 | PII identificada, clasificada y protegida (A-Number, docs migratorios = altamente sensible) |
| RNF-CMP-03 | Audit logs inmutables de acciones sensibles |
| RNF-CMP-04 | Data retention policy definida y aplicada |
| RNF-CMP-05 | Disclaimers UPL presentes en todas las pantallas relevantes |
| RNF-CMP-06 | Consentimiento explícito para procesar datos en servicios externos (captcha solver, IA) |

---

## 9. Accesibilidad y UX

| ID | Requisito |
|---|---|
| RNF-UX-01 | WCAG 2.1 AA: contraste 4.5:1 body / 3:1 large text |
| RNF-UX-02 | Touch targets mínimo 44×44px |
| RNF-UX-03 | Skeletons + optimistic UI + error boundaries |
| RNF-UX-04 | i18n preparado (ES/EN) |
| RNF-UX-05 | 404/500 amigables con utilidad |
| RNF-UX-06 | Empty states informativos |

---

## 10. Testing (resumen — ver doc 12)

| ID | Requisito |
|---|---|
| RNF-TEST-01 | Domain layer con cobertura alta (lógica pura, fácil de testear) |
| RNF-TEST-02 | Tests de contrato (Zod `CaseInfoResponse`, parsers de feeds y G-1055) contra fixtures reales del demo (doc 09 §17); panel `/dev/feeds-test` para E2E |
| RNF-TEST-03 | E2E de flujos críticos (signup → primer caso) con Playwright |
| RNF-TEST-04 | Tests de idempotencia y concurrencia en billing y AAF |

---

## Checklist production-ready (condensado de las reglas empresariales)

- [ ] LCP<2.5s · INP<200ms · CLS<0.1 · performance budget en CI
- [ ] Idempotency keys · retries+jitter · circuit breakers · timeouts · DLQ · graceful shutdown
- [ ] RLS en todo · JWT corto+refresh · MFA disponible · rate limiting en login · audit logs
- [ ] TLS 1.2+ · secrets en vault · WAF/DDoS · CSP · PII cifrada en reposo
- [ ] Logs estructurados · Four Golden Signals · tracing · SLOs+error budget · Sentry
- [ ] CI/CD · canary/blue-green · feature flags · rollback probado · runbooks
- [ ] GDPR/CCPA · access/forgotten · retention · audit inmutable

---

## (v3.0) Restricciones operativas reales del subsistema de datos

Derivadas del demo (`REPLICATION-GUIDE.md`) y obligatorias para el diseño (ver doc 09):

- **RNF-OPS-01 — Concurrencia de navegador.** Los flujos con navegador+captcha (EOIR, NVC) corren en un **worker dedicado** con **concurrencia 1-2** + retry con backoff. *No* se ejecutan en funciones Vercel (Playwright bloqueado) ni se masifican. Verificación: prueba de carga que confirme encolado y límite de concurrencia (k6/artillery contra la cola).
- **RNF-OPS-02 — Rate-limit por host.** `eoirFetch` respeta justice.gov **2s**, tracreports.org **3s**, con backoff en 5xx/429. Verificación: test unitario del rate-limiter + métrica de 429 ≈ 0.
- **RNF-OPS-03 — Timeouts.** Endpoints con navegador: `maxDuration=300`. Objetivo: p95 de consulta EOIR/NVC < 90s (incluye captcha); si excede, modo diferido (notificación).
- **RNF-OPS-04 — Exactitud y frescura.** Processing times = mirror con **~24h de lag** (mostrar fecha/release). Tarifas G-1055 = **líneas exactas**, nunca interpretadas. Verificación: aviso visible + test que prohíbe simplificar `feeLines`.
- **RNF-OPS-05 — IP-match y captcha.** EOIR exige **IP del navegador = IP de 2Captcha** (evita 401). Failover de proveedor de captcha (2Captcha↔CapMonster para hCaptcha) configurable por env. Verificación: monitor de tasa de éxito de token y de `CaptchaInvalid`.
- **RNF-OPS-06 — Runtime.** Node ≥ **22.5** donde se use `node:sqlite` (mirror); alternativa `sql.js` (WASM) si el cron vive en Vercel.
- **RNF-OPS-07 — Costo por caso (financiero).** Cada consulta con navegador y cada llamada Gemini cuesta. Cache + cooldown + cuotas por plan + **presupuesto con corte automático** (doc 12 §6). Objetivo: costo medio por caso activo « precio Pro ($17). Verificación: dashboard de costo/día con alerta.
- **RNF-OPS-08 — Kill switch por fuente.** Cada fuente se puede apagar por flag sin redeploy. Verificación: apagar `FEEDS_ENABLE_*`/`AAF_ENABLE_*` degrada con `503 ConfigMissing`, no rompe la app.
- **RNF-OPS-09 — Scrubbing PII en logs** (también RNF de seguridad, doc 10): A-Number, nombres y tokens redactados en trazas.
