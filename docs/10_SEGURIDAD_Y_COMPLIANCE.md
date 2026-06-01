# 10 · Seguridad y compliance — DIY Legal

> Cómo DIY Legal protege los datos del usuario, evita ejercer la abogacía sin licencia (UPL), y cumple con privacidad (GDPR/CCPA-CPRA). Documento de referencia para los `ver doc 10` del resto del paquete.
> Versión 3.0 · Mayo 2026 (actualizado con el demo real REPLICATION-GUIDE.md)

> ⚠️ **Este documento NO es asesoría legal.** Define la postura de ingeniería y producto, y marca con `‹REVISAR_CON_ABOGADO›` cada punto que requiere validación de un abogado de inmigración + un abogado de privacidad de EE.UU. antes de producción.

---

## 1. Modelo de amenazas (resumen)

| Activo | Amenaza | Mitigación principal |
|---|---|---|
| A-Number del usuario | Robo / correlación con identidad | Cifrado en reposo, masking en UI/logs, RLS estricto |
| Documentos del caso (pasaporte, partidas, evidencia) | Filtración de Storage | **Cifrado client-side** + RLS + URLs firmadas de corta vida |
| Sesión / cuenta | Account takeover | Supabase Auth (MFA opcional), biometría en móvil, tokens rotados |
| API keys (2Captcha, HyperBrowser, Stripe, Gemini) | Exposición → costo/abuso | **Solo server-side**, nunca en el bundle del cliente; rotación |
| Backend de scraping | Inyección vía HTML scrapeado | Parser tolerante + Zod, nunca `eval`, sandbox del worker |
| Datos personales (PII) | Acceso indebido del staff | Principio de menor privilegio, audit log, scrubbing en observabilidad |

Clasificación de datos:
- **Crítico (PII sensible):** A-Number, documentos, datos de la corte ligados a la persona.
- **Sensible:** email, teléfono, historial de trámite.
- **Interno:** métricas agregadas, logs scrubbed.
- **Público:** contenido informativo de la app.

---

## 2. UPL — Unauthorized Practice of Law (el riesgo #1 del producto)

DIY Legal **organiza, informa y automatiza tareas mecánicas**; **no** da asesoría legal. La frontera UPL es el riesgo legal más alto del producto y atraviesa todo el diseño.

### 2.1 Qué SÍ hace (permitido como herramienta de auto-servicio)
- Consultar y mostrar el estado público del propio caso del usuario (EOIR/ACIS).
- Recordatorios de fechas (audiencias, deadlines).
- Llenado mecánico de formularios con datos que **el usuario** provee (scrivener / typing service).
- Información general y educativa, claramente identificada como tal.
- Checklists de documentos genéricos por tipo de trámite.

### 2.2 Qué NO hace (cruzaría a UPL)
- ❌ Recomendar **qué** formulario presentar o **qué** estrategia seguir para *su* caso.
- ❌ Interpretar cómo la ley aplica a los hechos específicos del usuario.
- ❌ Predecir resultados ("vas a ganar tu caso").
- ❌ Representar al usuario ante USCIS/EOIR.
- ❌ Revisar documentos y opinar sobre su suficiencia legal.

### 2.3 Controles de producto contra UPL
1. **Disclaimer omnipresente** (ver doc 05 §6 y doc 04): en onboarding (con aceptación registrada), en el footer del asistente IA, y en cada pantalla de formularios.
   > "DIY Legal es una herramienta de organización y auto-servicio. **No es un bufete de abogados ni brinda asesoría legal.** La información es general y no sustituye la consulta con un abogado con licencia."
2. **Guardrails del asistente IA** (ver doc 07 §IA): system prompt que rechaza dar consejo específico y redirige ("esto requiere un abogado con licencia"); clasificador de intención que bloquea preguntas tipo "¿qué debo hacer en mi caso?".
3. **Lenguaje de información, no de consejo** en todo el copy ("muchas personas en esta etapa…", nunca "tú debes…").
4. **Aceptación de Términos + UPL disclaimer** versionados y con registro de consentimiento (tabla `audit_log` / consentimientos, doc 08).
5. **Sin garantías de resultado** en marketing ni en la app.

> `‹REVISAR_CON_ABOGADO›` La línea exacta de UPL varía por estado de EE.UU. (p. ej. reglas de "document preparers" en CA/AZ, LegalZoom precedents). Validar el copy y el alcance del llenado de formularios con abogado antes de lanzar.

---

## 3. Legalidad del scraping EOIR/ACIS

DIY Legal accede a ACIS para traer el **estado público del propio caso del usuario** (dato que el usuario tiene derecho a consultar), resolviendo el captcha de forma automatizada. Postura y controles:

- **Solo datos del propio usuario:** se requiere el A-Number que el usuario posee; no se enumeran ni se recolectan casos de terceros. No hay scraping masivo de la base.
- **Solo datos públicos:** la información mostrada es la misma que el usuario vería manualmente en el portal.
- **Rate limiting y cooldown** (doc 09): se evita carga abusiva sobre el servicio gubernamental; refresco con cooldown y auto-refresh espaciado.
- **Transparencia con el usuario:** se le informa que la app consulta el sistema en su nombre.
- **Kill switch** para suspender el subsistema ante cualquier problema legal/operativo.

Riesgos a gestionar (`‹REVISAR_CON_ABOGADO›`):
1. **Términos de uso del portal EOIR/ACIS** y de CAPTCHA: ¿prohíben automatización? Evaluar.
2. **CFAA (Computer Fraud and Abuse Act):** acceso "autorizado" — el usuario consulta su propio dato, lo que reduce riesgo, pero debe revisarse a la luz de *hiQ v. LinkedIn* y casos posteriores.
3. **Resolución de captcha de tercero (2Captcha):** revisar términos.
4. Plan de contingencia: si EOIR publica una **API oficial** o si el enfoque resulta inviable, el puerto `EoirDataSourcePort` (doc 06) permite cambiar de adaptador sin reescribir el dominio.

> Esta sección complementa el doc 09 §11. **Ningún lanzamiento sin opinión legal escrita sobre el scraping.**

---

## 4. Cifrado

### 4.1 En tránsito
- TLS 1.2+ en todo (Supabase, Stripe, APIs). HSTS. Sin endpoints HTTP.
- Certificate pinning opcional en el shell Capacitor para APIs propias (ver doc 11).

### 4.2 En reposo
- Postgres de Supabase cifrado en reposo (AES-256) a nivel de plataforma.
- Storage cifrado en reposo a nivel de plataforma.

### 4.3 Cifrado client-side de documentos (capa extra)
Los documentos del caso son el activo más sensible. Además del cifrado de plataforma:
- El **contenido del archivo se cifra en el dispositivo** (AES-GCM) **antes** de subirse a Storage.
- La clave de cifrado del usuario se deriva de un secreto del usuario y/o se guarda en el **secure enclave / Keystore** del dispositivo (vía plugin de Capacitor, doc 11), **nunca en claro en el servidor**.
- Consecuencia consciente: el servidor **no puede leer** el contenido de los documentos (zero-knowledge sobre el binario). El procesamiento IA de un documento ocurre **en el cliente** o con descifrado efímero **en el dispositivo** antes de enviar solo el texto/embedding necesario, según el caso de uso (ver doc 07 §IA y doc 09 sobre scrubbing).
- Metadatos (nombre, tipo, tamaño, caso asociado) sí viven en la BD para listar/organizar.

> **Decisión de producto** (el demo no cubre almacenamiento de documentos del usuario): el cifrado de documentos es **client-side (AES-GCM) desde v1** (más seguro; gestionar recuperación de clave y multi-dispositivo), y cifrado de plataforma + URLs firmadas para el resto de datos. La capa de datos de referencia (doc 09) no guarda PII, así que no aplica aquí.

### 4.4 A-Number
- Almacenado cifrado a nivel columna (pgcrypto o cifrado app-level) además del cifrado de plataforma.
- **Masking por defecto** en UI (`A1**-***-789`) y en TODO log/trace/error (ver doc 09 §observabilidad). El valor completo solo se descifra server-side cuando el worker lo necesita para el scraping.

---

## 5. Manejo de PII y minimización

Principios:
1. **Minimización:** se pide solo lo necesario para el trámite. No se recolecta PII "por si acaso".
2. **Propósito limitado:** el A-Number se usa para consultar el caso; no para perfilado ni venta.
3. **No venta de datos** (relevante para CCPA/CPRA): DIY Legal **no vende** datos personales.
4. **Sin PII en analytics:** PostHog/observabilidad reciben eventos sin identificadores sensibles (ver doc 12).
5. **Scrubbing en logs:** A-Number, nombres y tokens se redactan antes de loguear (doc 09 §12).
6. **Acceso del staff:** menor privilegio; cualquier acceso a datos de usuario queda en `audit_log` (doc 08). El worker usa **service role** acotado; nunca claves de servicio en el cliente.

---

## 6. Privacidad / cumplimiento normativo

> Aplicabilidad según dónde residan los usuarios. La base de usuarios objetivo está en EE.UU. (CCPA/CPRA) y potencialmente UE (GDPR si hay usuarios allí). `‹REVISAR_CON_ABOGADO›` confirmar alcance.

### 6.1 Derechos del titular (GDPR + CCPA/CPRA)
La app debe soportar, vía flujo de cuenta:
- **Acceso / portabilidad:** exportar mis datos (JSON/ZIP). → endpoint y acción de UI.
- **Rectificación:** editar mis datos.
- **Supresión ("derecho al olvido"):** borrar mi cuenta y datos (ver §7).
- **Oposición / limitación:** desactivar notificaciones, auto-refresh, procesamiento IA.
- **No discriminación** por ejercer derechos (CCPA).

### 6.2 Bases / documentos legales requeridos
- **Política de Privacidad** (qué se recolecta, por qué, con quién se comparte: Supabase, Stripe, Gemini/Google, 2Captcha, HyperBrowser como sub-procesadores).
- **Términos de Servicio** con cláusula UPL y limitación de responsabilidad.
- **Lista de sub-procesadores** (DPA con cada uno: Supabase, Stripe, Google, etc.).
- Registro de **consentimiento** versionado (onboarding).
- Banner/aviso de cookies solo si aplica en web.

### 6.3 Menores
SIJS involucra frecuentemente a **menores de edad**. Esto eleva el estándar:
- `‹REVISAR_CON_ABOGADO›` evaluar **COPPA** (EE.UU., <13) y reglas de consentimiento parental.
- Diseño: la cuenta la opera típicamente el **adulto responsable / tutor**, no el menor directamente. Documentar y reflejar en Términos.

---

## 7. Retención y borrado de datos

| Dato | Retención | Al borrar cuenta |
|---|---|---|
| Cuenta / perfil | Mientras la cuenta exista | Soft-delete inmediato → **purga a los 30 días** |
| Documentos | Mientras el usuario los conserve | Borrado de Storage en la purga (30 días) |
| A-Number / casos | Vida de la cuenta | Purgado |
| `raw_snapshot` del scraping | Ventana corta (debug) `‹CONFIRMAR›` ~30–90 días | Purgado |
| Logs scrubbed / métricas | 30–90 días | Ya no contienen PII |
| `audit_log` (legal) | Mayor (p. ej. 1 año) `‹REVISAR_CON_ABOGADO›` | Se conserva anonimizado para defensa legal |
| Datos de facturación (Stripe) | Según obligaciones fiscales/contables | Gestionado por Stripe; se conserva lo mínimo legal |

Flujo de borrado de cuenta (satisface doc 02 AC2):
1. Usuario confirma escribiendo su email.
2. Soft-delete inmediato → la cuenta deja de ser accesible.
3. Job de purga (pg_cron) elimina datos personales a los **30 días**; cancelable dentro de la ventana.
4. Se registra el borrado (anonimizado) en `audit_log`.

---

## 8. Seguridad de aplicación (AppSec)

- **RLS en todas las tablas** con datos de usuario: `user_id = auth.uid()` (doc 08). El worker accede con service role, no se salta RLS por accidente del cliente.
- **Validación de input con Zod** en todos los endpoints (doc 07).
- **Idempotencia** en mutaciones sensibles/pagos (doc 07, doc 08).
- **Rate limiting** por usuario/IP (token bucket, 429 + Retry-After) (doc 03, doc 07).
- **Webhooks** (Stripe) verificados por **firma HMAC**; rechazo si no valida (doc 07).
- **CORS** restringido a orígenes propios; el shell Capacitor usa esquema/allowlist (doc 11).
- **Secrets** en variables de entorno del backend/Edge Functions; nunca en el repo ni en el bundle. Rotación periódica de API keys.
- **Dependencias:** Dependabot/`npm audit` en CI (doc 12); pin de versiones.
- **Sin `eval`/ejecución de HTML scrapeado**; el parser trata el HTML como dato no confiable (doc 09).
- **Headers de seguridad** (CSP, X-Frame-Options, etc.) en la web.

---

## 9. Respuesta a incidentes (resumen — runbook en doc 12)

1. **Detección:** alertas de observabilidad (doc 12) — picos de error, fugas de latencia, anomalías de costo en captcha.
2. **Contención:** kill switches (scraping, IA), rotación de credenciales comprometidas, revocación de sesiones.
3. **Erradicación y recuperación:** parche, restore si aplica.
4. **Notificación:** evaluar obligaciones de **breach notification** (GDPR 72h; leyes estatales de EE.UU.). `‹REVISAR_CON_ABOGADO›`.
5. **Post-mortem** sin culpa, con acciones de mejora.

---

## 10. Checklist de compliance previo a producción

- [ ] Opinión legal escrita sobre **UPL** (alcance de formularios y del asistente IA).
- [ ] Opinión legal escrita sobre **scraping EOIR/ACIS** (CFAA, ToS, 2Captcha).
- [ ] Política de Privacidad + Términos + lista de sub-procesadores publicados.
- [ ] DPAs firmados (Supabase, Stripe, Google/Gemini, 2Captcha, HyperBrowser).
- [ ] Evaluación COPPA/menores para flujos SIJS.
- [ ] Cifrado client-side de documentos verificado (incl. recuperación de clave).
- [ ] A-Number cifrado a nivel columna + masking en UI/logs comprobado.
- [ ] RLS probado (tests negativos: usuario A no ve datos de B).
- [ ] Flujo de exportación y de borrado de cuenta (30 días) funcionando.
- [ ] Scrubbing de PII en logs/analytics verificado.
- [ ] Rotación de secrets y alertas de costo configuradas.
- [ ] Registro de consentimiento versionado operativo.

---

**Doc 10 · Seguridad y compliance** · v2.0 · Mayo 2026. Relacionados: 02 (borrado de cuenta), 03 (RNF seguridad), 04 (riesgo de marca), 05 (disclaimers UI), 07 (seguridad API/IA), 08 (RLS/cifrado/retención), 09 (legalidad del scraping). Mantener bajo `/docs/`.

---

## (v3.0) Adiciones por el demo real

### A. UPL ampliado a las nuevas funcionalidades
La frontera UPL ahora cubre superficies nuevas y más sensibles. `‹REVISAR_CON_ABOGADO›` en todas:
- **Mociones AAF** (`/api/aaf/generate-motion`, doc 13): se entregan como **borrador con marca de agua "DRAFT"** si el usuario es *pro se*; copy "documento de apoyo, revísalo con un abogado antes de presentar". Nunca se afirma que el documento es definitivo ni que sustituye asesoría. `AAF_BYPASS_VALIDATORS` **prohibido en producción**.
- **Asistente IA** (Gemini): system prompt que **rechaza** consejo legal específico, estrategia y predicción de resultado; redirige a abogado/Legal Aid; disclaimer visible. Sin PII a logs del proveedor.
- **Civics, REAL ID, Selective Service, ITIN, I-94:** se presentan como información/cálculo, no recomendación. Estadísticas de juez (TRAC): etiqueta "contexto informativo, no predicción".

### B. Exactitud de datos (obligaciones de producto)
- **Tarifas G-1055:** mostrar las **líneas exactas** del PDF oficial (`feeLines`), nunca un único número interpretado, con **aviso obligatorio**: "confirma el monto exacto; si pagas de menos, USCIS rechaza y no devuelve". Riesgo real de daño al usuario si se simplifica.
- **Processing times:** datos de **mirror** con ~24h de lag → mostrar fecha/release y "leve retraso".
- **AAF:** monto vigente desde `regulatory-cache.json` (cron), con citas (8 U.S.C. § 1808); si hay duda regulatoria, remitir a la fuente.

### C. Caveat honesto del scraping y manejo de credenciales
- **EOIR / token hCaptcha:** el backend puede recibir **401 "Invalid Captcha"** pese al IP-match (doc 09 §4). No se expone al usuario; se reintenta / failover de proveedor (CapMonster) / modo diferido / kill switch. Documentar el riesgo de estabilidad para negocio.
- **Legalidad del scraping** `‹REVISAR_CON_ABOGADO›`: revisar CFAA, *hiQ v. LinkedIn*, ToS de cada sitio gubernamental, y el uso de 2Captcha/HyperBrowser, antes de producción. Preferir **APIs oficiales** cuando existan (USCIS Torch ya se usa así).
- **Proxy/IP:** credenciales de proxy y de captcha son **server-side** (`.env.local`), nunca en cliente ni en el repo. El demo trae claves **enmascaradas** → **rotarlas**. No enviar PII en parámetros de URL hacia terceros.
- **Claves de captcha/HyperBrowser/Gemini/Torch:** solo en el worker/servidor; rotación periódica; presupuesto con corte (evita abuso y fuga de costo).

### D. PII y scrubbing
- A-Number cifrado a nivel columna (pgcrypto) y **enmascarado** en UI (`A1**-***-789`); ITIN enmascarado y **nunca enviado a terceros** (lógica local). 
- **Scrubbing obligatorio** de A-Number, nombres y tokens en logs/trazas/Sentry (doc 12). 
- I-94: el PDF lo provee el usuario; se procesa con Gemini Vision y se **borra** según retención (§7); dejar claro que no es consulta directa a CBP.

> El resto del documento (modelo de amenazas, cifrado, GDPR/CCPA, retención, AppSec, respuesta a incidentes) aplica igual; estas adiciones lo extienden a las funcionalidades nuevas.
