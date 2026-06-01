# 12 · Roadmap y DevOps — DIY Legal

> Plan de entrega por fases, entornos, CI/CD, estrategia de testing, observabilidad y runbooks operativos. Cierra los `ver doc 12` de testing (doc 03 §10) y de runbooks (doc 10 §9).
> Versión 3.0 · Mayo 2026 (actualizado con el demo real REPLICATION-GUIDE.md)

---

## 1. Roadmap por fases

Las fases priorizan validar el **corazón de riesgo** (scraping EOIR + UPL) antes de invertir en lo demás.

### Fase 0 — Fundaciones (semanas 1–2)
- Monorepo (Turborepo) con `apps/web`, `packages/core|ui|types|validators|config|platform` (doc 06).
- Supabase project (dev), Auth, esquema base + RLS (doc 08).
- CI mínimo (lint, typecheck, test) + preview deploy.
- Design system base (tokens, componentes shadcn/ui) (doc 05).

### Fase 1 — MVP del corazón: "ver mi caso" (semanas 3–6)
- **Auth + onboarding** con disclaimer UPL y consentimiento (doc 04/10).
- **Agregar caso por A-Number** → subsistema **HyperBrowser + 2Captcha** (doc 09) con `POST /v1/cases` → 202 + jobId, pantalla de progreso por Realtime (doc 05 P09), modo diferido.
- Detalle del caso + audiencias + refresco con cooldown (doc 02 RF-CASE).
- Observabilidad del scraping (tracing por etapa, alertas de costo, kill switch).
- **Gate de validación:** opinión legal de scraping + UPL (doc 10) **antes** de exponer a usuarios reales.

### Fase 2 — Valor recurrente (semanas 7–10)
- **Notificaciones** push/email (audiencias, cambios de estado) (doc 07/11).
- **Documentos** con cifrado client-side + cámara (doc 10/11).
- **Asistente IA** (Gemini) con guardrails UPL: Free Flash 30/día, Pro Pro+RAG (doc 07).
- **Auto-refresh** programado priorizado por proximidad de audiencia (doc 02 RF-CASE-04).

### Fase 3 — Monetización y formularios (semanas 11–14)
- **Stripe** (web) / decisión IAP móvil (doc 11 §6); feature gating Free/Pro (doc 07/08).
- **Llenado de formularios** (scrivener) con export PDF (doc 02), dentro de límites UPL.
- Exportación/borrado de datos (derechos del titular, doc 10).

### Fase 4 — Empaquetado móvil y stores (semanas 15–17)
- Builds Capacitor iOS/Android firmados, push end-to-end, privacy labels (doc 11).
- Hardening, pruebas de carga, runbooks completos.
- Beta cerrada (TestFlight / Play internal).

### Fase 5 — Lanzamiento y escala (post)
- Lanzamiento público gradual.
- Optimización de costo de captcha/scraping, caching, tasa de éxito.
- Preparar swap a **API oficial EOIR** si aparece (puerto `EoirDataSourcePort`, doc 06).

> Las semanas son orientativas para un equipo pequeño; ajustar a capacidad real.

---

## 2. Entornos

| Entorno | Propósito | Datos | Notas |
|---|---|---|---|
| **Local** | Desarrollo | Seed/ficticios | Supabase local o proyecto dev; secrets en `.env.local` (no commit) |
| **Preview** | Por PR | Aislados | Deploy efímero (Vercel preview) + branch de Supabase si aplica |
| **Staging** | QA / pre-prod | Ficticios realistas | Igual config que prod; aquí se prueban migraciones |
| **Producción** | Usuarios reales | PII real | Acceso restringido, alertas activas, kill switches |

- **Secrets por entorno** (Vercel/Supabase/GitHub Environments). API keys de 2Captcha/HyperBrowser/Stripe/Gemini **solo server-side** (doc 10).
- **Migraciones** expand-contract (doc 08) probadas en staging antes de prod.

---

## 3. CI/CD

**CI (GitHub Actions) en cada PR:**
1. `lint` (ESLint) + `format` (Prettier).
2. `typecheck` (tsc).
3. `test:unit` (Vitest).
4. `test:e2e` (Playwright) en jobs críticos.
5. **Lighthouse CI** con presupuesto de performance (alineado a doc 03: LCP < 2.5s, etc.). Falla el PR si se excede.
6. `npm audit` / Dependabot (seguridad de dependencias, doc 10).
7. Build de `apps/web` + (en releases) build Capacitor.

**CD:**
- **Web/PWA:** deploy automático a preview por PR; a producción al hacer merge a `main` (Vercel u host equivalente).
- **Edge Functions / worker de scraping (doc 09):** deploy versionado; el worker dedicado (contenedor) se publica con su pipeline; **feature flag / kill switch** para activarlo.
- **Móvil:** workflow manual/tag → builds firmados (AAB + iOS) → TestFlight/Play internal (doc 11).
- **Migraciones de BD:** paso de release controlado (no destructivo; contract sólo tras verificar).

Convenciones: **Conventional Commits** (encaja con el flujo `/commit` del usuario), PRs pequeños, revisión obligatoria, `main` protegido.

---

## 4. Estrategia de testing (cierra doc 03 §10)

| Nivel | Herramienta | Qué cubre |
|---|---|---|
| **Unit** | Vitest | Lógica de dominio (VOs: `ANumber` regex/format/mask; `Case` transiciones), validadores Zod, utilidades |
| **Integración** | Vitest + Supabase test | Repositorios, RLS (tests negativos: A no ve datos de B), endpoints |
| **Parser de scraping** | Vitest + **fixtures HTML reales** | Zod `CaseInfoResponse` + fallback `parseCaseDom` contra fixtures HTML/JSON reales del demo (doc 09 §4, §17); casos: sin captcha, captcha distinto, caso no encontrado, HTML cambiado |
| **Contrato de API** | Vitest/supertest | 202 + jobId, idempotencia, 429/Retry-After, webhooks HMAC |
| **E2E** | Playwright | Flujos: onboarding+consentimiento, agregar caso (mock del worker), ver caso, paywall |
| **Resiliencia (caos)** | Scripts | Circuit breaker abre/half-open, retries con backoff, DLQ, kill switch |
| **Carga** | k6/Artillery | Cola de scraping bajo presión, rate limiting, p95 de API |
| **Mobile** | Manual + device labs | Safe areas, push, cámara, biometría, offline (doc 11) |
| **A11y** | axe / Lighthouse | WCAG AA (doc 03) |

- **El worker de scraping se prueba contra fixtures, no contra el sitio real** en CI (evita costo y flakiness). Pruebas contra el sitio real: suite manual/programada aparte con presupuesto de captcha.
- Metas de cobertura: dominio y validadores altos; UI razonable. No perseguir 100% ciego.

---

## 5. Observabilidad (Four Golden Signals — doc 03)

| Pilar | Herramienta sugerida | Notas |
|---|---|---|
| **Errores / trazas** | Sentry | **Scrubbing de PII obligatorio** (A-Number, nombres, tokens) — doc 09/10 |
| **Producto / analytics** | PostHog | Eventos **sin PII** (doc 10 §5); embudos de activación |
| **Uptime / logs / alertas** | Better Stack (o Logtail/Grafana) | Heartbeats del worker, status page |
| **Métricas de scraping** | Dashboard propio | Tasa de éxito, latencia por etapa, costo de captcha/día, reintentos, tamaño de DLQ |

Señales:
- **Latency, Traffic, Errors, Saturation** en API y worker.
- **Alertas accionables:** caída de tasa de éxito de scraping, **gasto de captcha por encima de presupuesto** (doc 09), crecimiento de `scrape_jobs_dead`, error rate de pagos, breaker abierto sostenido.
- Tracing por etapa del scraping (enqueue→claim→session→captcha→parse→persist) con IDs correlacionados y PII redactada.

---

## 6. Guardrails de costo (doc 09)

Cada captcha y cada sesión headless **cuesta dinero**. Operación:
- **Presupuesto diario/mensual** de 2Captcha + HyperBrowser con alerta y **corte automático** (kill switch) al excederlo.
- Cache de resultados + cooldown de refresco + cuotas por plan (Free vs Pro) reducen llamadas.
- Métrica de **costo por caso activo** vigilada; objetivo de unit economics sano vs precio Pro ($17).
- `reportbad` a 2Captcha en fallos para no pagar soluciones inválidas (doc 09).

---

## 7. Runbooks (cierra doc 10 §9)

> Procedimientos cortos y accionables. Mantener en el repo y enlazados desde las alertas.

**R1 · Scraping caído / tasa de éxito desplomada**
1. Confirmar en dashboard (¿etapa que falla: sesión, captcha o parse?).
2. Si es el sitio EOIR (cambió HTML/captcha) → activar **kill switch** del scraping; los `POST /v1/cases` responden con estado "demorado"/diferido (doc 09).
3. Revisar fixtures/selectores reales (doc 09 §17); parchear `portal-parser` o la detección de sitekey; si baja el éxito de hCaptcha, hacer failover de proveedor (doc 09 §4).
4. Reanudar gradual; vigilar DLQ y reprocesar `scrape_jobs_dead`.

**R2 · Gasto de captcha anómalo**
1. Alerta de presupuesto → revisar volumen y tasa de fallo.
2. Si abuso/bucle → kill switch + revisar cooldown/cuotas/idempotencia.
3. Ajustar presupuesto/limites; post-mortem.

**R3 · Incidente de seguridad / posible breach**
1. Contener: rotar credenciales, revocar sesiones, kill switches.
2. Evaluar alcance (¿PII afectada?).
3. Notificación legal/regulatoria si aplica (GDPR 72h / leyes estatales) — `‹REVISAR_CON_ABOGADO›` (doc 10 §9).
4. Post-mortem sin culpa.

**R4 · Pagos / webhooks Stripe fallando**
1. Verificar firma HMAC y endpoint (doc 07).
2. Reproceso idempotente de eventos; reconciliar suscripciones.
3. Feature gating se mantiene server-side; ningún acceso Pro sin pago confirmado.

**R5 · Caída de Supabase / degradación**
1. Activar modo degradado (lectura cacheada, deshabilitar acciones de red) (doc 03/11).
2. Comunicar en status page; seguir incidente del proveedor.

**R6 · Rollback de release**
1. Revertir deploy web (Vercel) al build previo.
2. **No** revertir migraciones destructivas; usar expand-contract (por eso contract va tarde) (doc 08).
3. Postmortem y fix-forward.

---

## 8. Definición de "listo para producción" (consolidado)

- [ ] Checklists de doc 03 (RNF), doc 10 (seguridad/compliance) y doc 11 (móvil) completos.
- [ ] Opiniones legales escritas (UPL + scraping) recibidas (doc 10).
- [ ] CI verde (lint/type/unit/e2e/Lighthouse/audit) en `main`.
- [ ] Migraciones probadas en staging; rollback ensayado.
- [ ] Observabilidad + alertas + scrubbing PII activos.
- [ ] Kill switches (scraping, IA) probados.
- [ ] Presupuestos de costo con corte automático configurados.
- [ ] Runbooks publicados y enlazados a alertas.
- [ ] Builds móviles firmados + fichas de tienda con disclaimers (doc 11).
- [ ] Backups/retención verificados (doc 10 §7).

---

**Doc 12 · Roadmap y DevOps** · v2.0 · Mayo 2026. Relacionados: 03 (RNF/testing), 06 (monorepo/módulos), 07 (API/Edge/jobs), 08 (migraciones/DLQ), 09 (worker/costo/kill switch), 10 (seguridad/runbooks), 11 (builds móviles). Mantener bajo `/docs/`.

---

## (v3.0) Actualización por el demo real

### A. Rollout por flags (15 fuentes)
Cada fuente nace con su flag en `false` (doc 09 §18). Orden sugerido de activación:
1. **Núcleo de valor:** EOIR (estado de caso) + AAF (cálculo) + USCIS Torch.
2. **Plazos/tarifas:** processing-times, fees (G-1055), visa-bulletin, regulations.
3. **Cortes/jueces:** court intelligence + judge stats (+ alertas CLOSED).
4. **Naturalización/requisitos + tools:** civics, vaccines, real-id, dmv, itin, selective-service, i94 (mediado), legal-aid.
5. **NVC** (captcha imagen) cuando el worker esté estable.
6. **Generación AAF** (moción/recibo PDF) y notificaciones.
`country-report`/`travel-advisories`: **off** por decisión (reactivables).

### B. Despliegue: split Vercel + worker (doc 06 §6, doc 09 §14)
- **Vercel:** UI + API GET (feeds/static/tools/pt-read) + USCIS Torch + AAF cálculo/PDF + crons ligeros. **Playwright bloqueado** (`PlaywrightNotSupported` si `VERCEL==="1"`).
- **Worker dedicado (contenedor):** EOIR/NVC/questionnaire (HyperBrowser+2Captcha), cola **concurrencia 1-2**, `maxDuration` alto; opcionalmente el `processing-times-sync` (node:sqlite) si no va en Vercel (o `sql.js` WASM).
- Secrets (`INTERNAL_CRON_SECRET`, claves de captcha/HyperBrowser/Gemini/Torch/proxy) en el entorno del worker y de Vercel según corresponda; **rotar** las del demo (enmascaradas).

### C. Crons reales (`vercel.json`, UTC) — todos con `authorizedCron`
| Cron | Schedule | Cron | Schedule |
|---|---|---|---|
| `regulatory-check` | `0 6 * * *` | `federal-register-sync` | `0 5 * * *` |
| `icpm-check` | `0 6 * * 1` | `travel-advisories-sync` | `0 9 * * 1` |
| `eoir-status-sync` | `0 */6 * * *` | `visa-bulletin-sync` | `0 10 1 * *` |
| `eoir-court-details-sync` | `30 7 * * *` | `fee-schedule-sync` | `0 12 1 * *` |
| `trac-judge-stats-sync` | `0 8 * * 1` | `processing-times-sync` | `0 14 * * *` |

(Los crons de las dos features de abogados excluidas se eliminan de `vercel.json`.)

### D. Testing / CI (ajustes)
- **Fixtures reales** del demo para parsers (Zod `CaseInfoResponse`, `parseCaseDom`, feeds, G-1055). CI **no** toca sitios gubernamentales.
- **Panel `/dev/feeds-test`** (sondas `aid, ta, cr, fee, pt, reg, vb, civ, vac, dmv, nvc, itin, rid, sss, i94`) como base de **E2E con Playwright** (fuera de Vercel).
- Suite contra sitios reales: programada aparte, con presupuesto de captcha, no en cada PR.
- `npx tsc --noEmit` + `npm run build` limpios; `serverExternalPackages` verificado.

### E. Costo y observabilidad (guardrails)
- **Presupuesto** diario/mensual de **2Captcha + HyperBrowser + Gemini** con **alerta + corte automático** (kill switch por fuente). Métrica **costo por caso activo** vs precio Pro.
- Tracing por etapa (encolado→sesión→captcha→captura/parseo→persistencia); métricas (éxito por fuente, latencia, costo/día, reintentos, DLQ); **scrubbing PII** en Sentry/logs (doc 10 §D).
- Alertas: caída de éxito EOIR/NVC (token 401), gasto sobre presupuesto, corte de corte a CLOSED, mirror desactualizado.

### F. Runbooks nuevos
- **R-EOIR-401:** sube `CaptchaInvalid` → verificar IP-match → failover `CAPTCHA_PROVIDER=capmonster` → si persiste, kill switch EOIR + modo diferido + avisar usuarios.
- **R-COSTO:** gasto sobre umbral → revisar cooldown/cuotas → apagar fuentes no críticas → notificar.
- **R-MIRROR:** processing-times-cache desactualizado → re-ejecutar `sync-processing-times` en el worker → validar Node ≥ 22.5.
