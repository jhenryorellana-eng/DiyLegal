# 02 · Requerimientos funcionales — DIY Legal

> RFs por módulo. Convención `RF-<MÓDULO>-<n>` · Prioridad P0 (MVP) / P1 / P2. Cada módulo corresponde a una funcionalidad del catálogo (doc 01 §3) y a archivos reales (doc 09).
> Versión 3.0 · Mayo 2026

> **Regla transversal de UX:** el usuario **nunca** ve jerga técnica (captcha, scraping, bot, proxy, "endpoint"). Todo se presenta como "consultando el sistema oficial". (Ver doc 04, doc 05.)

---

## AUTH — Cuenta y onboarding

- **RF-AUTH-01 (P0):** registro/login con email (Supabase Auth); MFA opcional; biometría en móvil (doc 11).
- **RF-AUTH-02 (P0):** onboarding con **aceptación registrada** de Términos + disclaimer UPL (doc 10 §2). AC: no se accede a funciones sin aceptar; se guarda versión y timestamp del consentimiento.
- **RF-AUTH-03 (P0):** idioma ES/EN seleccionable y persistente; ES por defecto.
- **RF-AUTH-04 (P1):** borrado de cuenta (soft-delete inmediato → purga a 30 días; ver doc 10 §7). AC: confirmación escribiendo el email.

## CASE — Estado de caso (EOIR / USCIS / NVC)

> Un caso del usuario referencia una de tres fuentes. La obtención es **asíncrona** para EOIR/NVC (navegador+captcha): el `POST` encola un job y responde **202 {jobId}**; el cliente observa por Realtime/polling (doc 07). USCIS (Torch) puede ser síncrono.

- **RF-CASE-01 (P0) — Agregar caso EOIR:** el usuario ingresa **solo A-Number + nacionalidad** (9 dígitos; idioma). NO se le pide token de captcha ni abrir DevTools.
  - **AC1:** validación de A-Number (`^A?\d{8,9}$`), normalizado/enmascarado en UI (`A1**-***-789`).
  - **AC2:** al enviar, UI muestra progreso con texto progresivo ("Conectando con el sistema de cortes…" → "Verificando tu caso…" → "Casi listo…"); nunca menciona captcha.
  - **AC3:** resultado: próxima audiencia (fecha/hora), juez (código+nombre), asylum clock (R/S) y días, docket/NTA, apelación/BIA. Se persiste en el caso del usuario.
  - **AC4 (modo diferido):** si la consulta tarda o falla transitoriamente, se ofrece "te avisamos cuando esté listo" (notificación) sin bloquear la app.
  - **AC5 (errores claros, sin jerga):** caso no encontrado → mensaje accionable ("revisa tu A-Number/nacionalidad"); sistema no disponible → reintento con espera; nunca se expone el detalle técnico (401/captcha).
- **RF-CASE-02 (P0) — Agregar caso USCIS:** ingresa **receipt** (3 letras válidas [IOE/EAC/WAC/LIN/SRC/MSC/NBC/YSC] + 10 dígitos). AC: validación de formato; estado vía Torch API; mensajes de error mapeados (ReceiptNotFound, etc.).
- **RF-CASE-03 (P1) — Agregar caso NVC:** ingresa tipo (IV/NIV) + nº de caso + passport/surname (o "NA"). AC: estado consular contra lista `NVC_STATUSES`; reintento interno hasta 3 si el captcha de imagen falla (transparente).
- **RF-CASE-04 (P1) — Refresco:** botón de actualizar con **cooldown** visible (evita costo/abuso). AC: si está en cooldown, se indica cuándo se podrá refrescar.
- **RF-CASE-05 (P1, Pro) — Auto-refresh programado:** priorizado por proximidad de audiencia/vencimiento. AC: configurable; respeta cuotas por plan.
- **RF-CASE-06 (P2):** historial de cambios del caso (timeline).

## AAF — Annual Asylum Fee (doc 13)

- **RF-AAF-01 (P0) — Calcular:** dado filing date (o estimada del caso EOIR) + venue, calcula rama (A/B/C/D), monto vigente, próxima fecha de vencimiento, estado y `daysUntilDue`, con caveats ES/EN. AC: muestra citas legales (8 U.S.C. § 1808) y pausas regulatorias activas.
- **RF-AAF-02 (P1) — Estimar fecha de presentación** desde el caso EOIR (clock+ElapsedDays → alta; DocketDate → media; OSC_Date → baja confianza). AC: indica el nivel de confianza.
- **RF-AAF-03 (P1, Pro) — Generar moción** "Notice of Compliance…" en PDF (Gemini + fallback template). AC: incluye caption/cuerpo/prayer/firma/certificate of service; **marca de agua "DRAFT"** si es pro se; disclaimer de no-asesoría.
- **RF-AAF-04 (P1, Pro) — Generar recibo / AAF Status Report** en PDF.
- **RF-AAF-05 (P1) — Recordatorios** de vencimiento AAF (push/email). AC: anticipación configurable.
- **RF-AAF-06 (P2) — Validación opcional** del cálculo con Gemini (detecta REFERRED/CONSOLIDATED/Ms. L.).

## TIMES — Processing Times

- **RF-TIMES-01 (P0):** consulta por **formulario + oficina**; devuelve rango (lower/upper/unit), nombre del formulario (ES/EN), y la **fecha desde la cual pedir case inquiry**. **Sin PII.**
- **RF-TIMES-02 (P1):** indicar fecha/release del dato (mirror, ~24h de lag) — aviso de "datos oficiales con leve retraso".

## FEE — Tarifas (G-1055)

- **RF-FEE-01 (P0):** consulta por formulario; muestra las **líneas exactas** del PDF oficial (no un solo número), porque formularios como I-589 tienen varias (filing fee + AAF). AC: **aviso obligatorio** "confirma el monto exacto; si pagas de menos, USCIS rechaza y no devuelve". Nunca interpretar/omitir dígitos (doc 10).

## VISA — Visa Bulletin

- **RF-VISA-01 (P1):** fechas de prioridad por categoría/país del boletín vigente; fallback a meses previos si aún no se publica.

## REG — Regulaciones (Federal Register)

- **RF-REG-01 (P1):** lista de regulaciones recientes de USCIS (búsqueda por término); enlace a la fuente oficial.

## COURT — Court Intelligence

- **RF-COURT-01 (P1):** ficha de corte (estado operativo, dirección, teléfono, emails, reglas de filing, jueces) por slug/código.
- **RF-COURT-02 (P1):** perfil/estadísticas del juez (TRAC: tasas de asilo, nacionalidades) — etiquetado como **contexto informativo, no predicción**.
- **RF-COURT-03 (P2, Pro) — Alertas:** notificar si la corte del usuario cambia de estado operativo (p. ej. a CLOSED).

## CIVICS — Examen de ciudadanía

- **RF-CIVICS-01 (P0):** entrega el pool correcto (2008 100q / 2025 128q) según fecha de presentación de N-400 (regla: < 2025-10-20 → 2008, ≥ → 2025). AC: modo estudio y modo práctica; bilingüe.

## VAC — Vacunas I-693

- **RF-VAC-01 (P1):** lista vigente CDC/USCIS (sin COVID desde 2025-03-11) como checklist.

## REALID — REAL ID

- **RF-REALID-01 (P1):** requisitos federales (docs, `enforcedSince:2025-05-07`) + por estado: si ofrece licencia estándar a indocumentados (CA/NY/IL/NJ/WA/NV/VA sí; TX/FL/AZ/GA/NC no). AC: filtrar por estado.

## DMV — Manuales

- **RF-DMV-01 (P2):** enlaces a manuales DMV PDF (EN/ES) + homepage por estado (12 estados).

## ITIN — Detector

- **RF-ITIN-01 (P1):** dado ITIN (`^9\d{8}$`, enmascarado `9XX-XX-####`) + último año de uso, calcula estado (active/expiring/expired/unknown) por la regla de 3 años. **No envía el ITIN a terceros** (lógica local).

## SS — Selective Service

- **RF-SS-01 (P1):** dado año de nacimiento, sexo, estatus, presencia en EE.UU. y registro, indica si debe registrarse (18-25) o si 26+ sin registro necesita Status Information Letter (bloquea N-400). **No pide SSN.**

## I94 — Lector de I-94 (mediado)

- **RF-I94-01 (P2):** el usuario **sube su PDF** de I-94; se extrae el historial de entradas/salidas con Gemini Vision. AC: deja claro que es lectura del documento que el usuario provee (no consulta directa a CBP). Borrado del archivo según política (doc 10).

## AID — Ayuda legal gratuita

- **RF-AID-01 (P1):** directorio de organizaciones sin fines de lucro / pro bono por estado. AC: presentado como **ayuda gratuita**, con disclaimer de que DIY Legal no las representa ni garantiza.

## AI — Asistente

- **RF-AI-01 (P0):** chat de información general y ayuda de uso de la app (Gemini). **Guardrails UPL:** rechaza dar consejo legal específico/estrategia/predicción y redirige a un abogado (doc 07 §IA, doc 10 §2). AC: disclaimer visible en el chat.
- **RF-AI-02 (P1, Pro):** contexto sobre los datos del propio usuario (RAG) respetando privacidad (sin exponer PII a logs; doc 10).

## DOC — Documentos

- **RF-DOC-01 (P1):** subir/organizar documentos del caso; **cifrado client-side** (doc 10 §4.3). AC: el servidor no puede leer el binario.
- **RF-DOC-02 (P2):** cámara/escaneo (Capacitor) + export.

## NOTIF — Notificaciones

- **RF-NOTIF-01 (P0):** push de eventos: cambio de estado de caso, audiencia próxima, **vencimiento AAF**, deadlines. AC: sin PII sensible en el payload (doc 10/11).
- **RF-NOTIF-02 (P1):** email; (opcional) WhatsApp.

## BILLING — Planes

- **RF-BILLING-01 (P0):** suscripción Pro vía Stripe; **gating por plan en backend** (doc 07/08). AC: ningún acceso Pro sin pago confirmado por webhook firmado.

---

## Matriz de trazabilidad (RF → fuente/método → doc técnico)

| Módulo | Método real (doc 09) | UI (doc 05) |
|---|---|---|
| CASE-EOIR | HyperBrowser + `eoir-ws` + hCaptcha | P-Caso, P-Progreso |
| CASE-USCIS | Torch API (OAuth) | P-Caso |
| CASE-NVC | Navegador + captcha imagen | P-Caso |
| AAF | Cálculo + Gemini + PDF | P-AAF, doc 13 |
| TIMES | Mirror SQLite→JSON | P-Tiempos |
| FEE | PDF G-1055 | P-Tarifas |
| VISA/REG | API/HTML | P-Recursos |
| COURT | Scraping HTML (cheerio) | P-Corte |
| CIVICS/VAC/REALID/DMV | JSON estático | P-Aprende, P-Requisitos |
| ITIN/SS | Lógica local | P-Herramientas |
| I94 | Subida + Gemini Vision | P-I94 |
| AID | HTML (cheerio) | P-Apoyo |

---

**Doc 02 · Requerimientos funcionales** · v3.0 · Mayo 2026. Relacionados: 01 (catálogo), 05 (pantallas), 07 (endpoints), 09 (métodos), 13 (AAF). Mantener bajo `/docs/`.
