# 01 · Visión y alcance — DIY Legal

> Qué es DIY Legal, para quién, qué hace y qué deliberadamente no hace. Catálogo de funcionalidades y decisiones de alcance.
> Versión 3.0 · Mayo 2026

---

## 1. Visión

**DIY Legal pone en manos del inmigrante las herramientas para gestionar su propio trámite migratorio en EE.UU.** — consultar el estado real de su caso (corte/EOIR, USCIS, consulado/NVC), saber cuánto y cuándo pagar (incluida la nueva cuota anual de asilo), preparar documentos de apoyo y entender los requisitos — todo desde el teléfono, en español/inglés, sin depender de intermediarios para tareas que son **información + organización**, no asesoría legal.

> Tagline: **"Tu trámite, en tus manos."**

**Insight central:** gran parte del costo en etapas tempranas de un trámite es organización, consulta de estado y recordatorios — no asesoría compleja. DIY Legal automatiza esa capa y mantiene un disclaimer omnipresente de que **no es un bufete ni brinda asesoría legal** (ver doc 04 y doc 10). La frontera UPL es el límite de diseño de todo el producto.

**Diferenciador real (validado en demo):** DIY Legal no "inventa" datos ni los interpreta: trae **datos oficiales** de las fuentes del gobierno (EOIR, USCIS, Departamento de Estado, IRS, CDC, DMV) de forma automatizada, y los presenta claros, bilingües y accionables. Donde el dato es sensible (tarifas, plazos), muestra el **valor exacto oficial** con su aviso correspondiente.

---

## 2. Usuarios

**Persona A — María (solicitante de asilo, defensiva en corte).** Tiene un A-Number, audiencias en EOIR, y ahora debe lidiar con la **cuota anual de asilo (AAF)**. Necesita: ver su próxima audiencia y juez, saber su "asylum clock", calcular cuándo/cuánto pagar el AAF, y generar el comprobante. Español primario. Móvil de gama media.

**Persona B — Carlos (peticionario familiar, vía USCIS/consular).** Tiene un receipt (I-130, etc.), espera fechas de prioridad (Visa Bulletin) y luego pasa al consulado (NVC). Necesita: estado del caso por receipt, tiempos de procesamiento, fechas del boletín de visas, y estado consular.

**Persona C — Ana (en proceso de naturalización / ajustes prácticos).** Prepara N-400, examen de **civics**, vacunas I-693, y necesita resolver cosas prácticas (REAL ID, licencia de conducir estatal, ITIN, Selective Service). Quiere herramientas claras de auto-servicio.

Características comunes: latinos en EE.UU., bilingües ES/EN con preferencia ES, sensibles a costos, desconfían de estafas ("notarios"), usan el teléfono como dispositivo principal.

---

## 3. Catálogo de funcionalidades (qué hace DIY Legal)

Agrupado por journey. El método técnico real está en el doc 09; los RFs en el doc 02; la UI en el doc 05.

### 3.1 Mi caso (estado real, automatizado)
- **EOIR — estado de caso en corte:** próxima audiencia, juez, asylum clock (R/S), días transcurridos, NTA/docket, apelaciones (BIA). Solo pide A-Number + nacionalidad.
- **USCIS — estado de caso:** por receipt (formato validado), vía API oficial Torch.
- **NVC CEAC — estado consular:** tras aprobación de USCIS, estado en el consulado (At NVC, In Transit, Ready, At Embassy, Issued, Refused, Administrative Processing…).

### 3.2 AAF — Annual Asylum Fee (funcionalidad estrella, doc 13)
- **Calculadora:** determina rama (A/B/C/D), monto vigente (FY2026 = **$102.00**), próxima fecha de vencimiento, estado (not_due/due_soon/due_now/overdue/paid_current/case_closed) y pausas regulatorias activas.
- **Generador de moción** "Notice of Compliance with Annual Asylum Fee Payment" (PDF, vía Gemini, con cita 8 U.S.C. § 1808; marca de agua "DRAFT" si es pro se).
- **Generador de recibo / "AAF Status Report"** (PDF).
- **Vigilancia regulatoria:** un cron mantiene actualizado el monto/pausas (Federal Register, EOIR PM, court orders).

### 3.3 Plazos, tarifas y regulaciones
- **Processing Times:** "¿cuánto tarda mi formulario?" por formulario + oficina, con la fecha desde la cual pedir *case inquiry* (mirror oficial, sin PII).
- **Fee Schedule (G-1055):** tarifas oficiales por formulario, mostrando las **líneas exactas** del PDF (sin simplificar) + aviso de "confirma el monto exacto".
- **Visa Bulletin:** fechas de prioridad por categoría/país.
- **Federal Register:** regulaciones recientes de USCIS.

### 3.4 Inteligencia de cortes y jueces
- **Court Intelligence:** estado operativo de la corte, dirección/teléfono/reglas de filing, jueces; **alertas** si una corte cambia a CLOSED.
- **Estadísticas del juez (TRAC):** tasas de concesión/denegación de asilo, nacionalidades, etc. (contexto informativo, no predicción de resultado).

### 3.5 Naturalización y requisitos prácticos
- **Examen de ciudadanía (civics):** pools 2008 (100 preguntas) y 2025 (128), eligiendo el correcto según la fecha de presentación de N-400.
- **Vacunas I-693:** lista vigente CDC/USCIS.
- **REAL ID:** requisitos federales + por estado (clave: qué estados dan licencia a indocumentados — CA AB60, NY Green Light, etc.).
- **Manuales DMV:** PDF EN/ES por estado (12 estados).

### 3.6 Herramientas personales (lógica local, sin enviar PII a terceros)
- **Detector ITIN:** alerta de expiración (regla IRS de 3 años).
- **Selective Service:** si debes registrarte (hombres 18-25), y si 26+ sin registro necesitas Status Information Letter (bloquea N-400).
- **Lector de I-94:** subes tu PDF y se extrae el historial con Gemini Vision (flujo mediado por el usuario).

### 3.7 Apoyo
- **Ayuda legal gratuita (Legal Aid):** directorio de organizaciones sin fines de lucro / pro bono por estado (referencia a ayuda gratuita; no es un marketplace de abogados).
- **Asistente IA (Gemini):** información general y orientación de uso de la app, con guardrails estrictos anti-UPL (ver doc 07 §IA y doc 10).

### 3.8 Transversal
- Cuenta de usuario, multi-caso propio, documentos cifrados, notificaciones (audiencias, vencimientos AAF, cambios de estado), bilingüe ES/EN.

---

## 4. Fuera de alcance — decisiones de alcance y conflictos resueltos

> Esta sección resuelve explícitamente las tensiones entre lo que pediste quitar (sobre MiTrámite/STITCH) y lo que trae el demo.

| Ítem | Decisión | Razón |
|---|---|---|
| **"Mi familia" / Family Dashboard** | ❌ Fuera | Decisión del usuario. No está en el demo. |
| **"Buscar abogado" / verificación de abogados** (`disciplined-practitioners`, `accredited-reps`) | ❌ Fuera | Excluido por el propio demo (§0) y por el usuario. Reduce superficie UPL. |
| **"Reportes del país" / Country Reports** (destino de navegación) | ⚠️ Off por defecto | El usuario pidió quitarlo. La capacidad existe tras flag y puede aparecer como **contexto de apoyo** dentro de un caso de asilo (condiciones del país). Reactivable. |
| **Ayuda legal gratuita (Legal Aid)** | ✅ Dentro | Es ayuda **gratuita/pro bono**, no un marketplace de abogados. Distinta de "buscar abogado". Bajo UPL. |
| **I-94 directo, ICE Detainee Locator, I-901 SEVIS** | ❌ No automatizado (futuro) | Muro anti-bot de infraestructura (reCAPTCHA Enterprise/v3 + detección de IP datacenter). Requieren ingeniería inversa del endpoint interno o IP residencial. El I-94 sí se ofrece en modo **mediado** (subir PDF). |
| **Asesoría legal específica / estrategia / predicción de resultado** | ❌ Fuera (UPL) | DIY Legal informa y organiza; no aconseja. Ver doc 10 §2. |

---

## 5. Modelo de negocio

Dos planes (sin el tier "Familia" de MiTrámite):

| | **Free** | **Pro — $17/mes** |
|---|---|---|
| Estado de caso (EOIR/USCIS/NVC) | 1 caso, refresco manual con cooldown | Multi-caso, **auto-refresh** priorizado por proximidad de audiencia |
| AAF | Calculadora + estado | Calculadora + **generación de moción y recibo (PDF)** + recordatorios |
| Processing Times / Fees / Visa Bulletin / Court Intelligence | Consulta básica | Completo + alertas (corte CLOSED, cambios) |
| Civics / Vacunas / REAL ID / DMV / Herramientas | ✅ | ✅ |
| Asistente IA | Gemini Flash, límite diario | Gemini Pro + contexto (RAG sobre sus datos) |
| Documentos | Almacenamiento básico | Mayor capacidad + export |
| Notificaciones | Push básicas | Push + email + (opcional WhatsApp) |

- **Conciencia de costo:** cada consulta con navegador+captcha (EOIR/NVC) y cada llamada a Gemini **cuesta dinero**. El producto cachea agresivamente, aplica cooldown y cuotas por plan, y vigila el costo por caso activo (doc 03, doc 09, doc 12).
- **Pagos:** Stripe en web; en móvil, evaluar IAP vs modelo "reader" por políticas de tienda (doc 11 §6). El gating por plan vive en backend (doc 07/08), así que la fuente de pago es intercambiable.

---

## 6. Métricas (Año 1, orientativas)

- **Activación:** % de usuarios que agregan al menos un caso y reciben estado en < 60s.
- **Retención:** usuarios que vuelven al acercarse una audiencia o un vencimiento AAF.
- **Conversión Free→Pro:** disparada por auto-refresh, generación de moción AAF y alertas.
- **Salud técnica:** tasa de éxito de consulta EOIR/NVC, costo de captcha/Gemini por caso, latencia p95, % de fuentes "verdes".
- **Confianza:** NPS; ausencia de quejas por exactitud de datos (tarifas/plazos).

---

## 7. Riesgos principales

| Riesgo | Mitigación |
|---|---|
| **UPL** (sobre todo mociones AAF, civics, asistente IA) | Disclaimers omnipresentes, guardrails IA, copy informativo, revisión legal (doc 10). |
| **Legalidad/estabilidad del scraping EOIR** y rechazo de token hCaptcha (401) | Endpoint interno + IP-match + failover de proveedor de captcha (CapMonster para hCaptcha) + fallback DOM + kill switch (doc 09/10). Revisión legal. |
| **Exactitud de datos** (tarifas G-1055, processing times con ~24h de lag) | Mostrar valor exacto + fecha/fuente + aviso; nunca interpretar dígitos (doc 09/10). |
| **Costo variable** (captcha/Gemini) descontrolado | Cache, cooldown, cuotas, presupuesto con corte automático (doc 12 §6). |
| **Políticas de tiendas** (pagos, apps "legales") | Decisión IAP/reader; ficha de tienda alineada al disclaimer (doc 11). |
| **Sitios que rompen** (cambian HTML/anti-bot) | Detección defensiva, fixtures, fallback, alertas, runbooks (doc 12 §7). |

---

**Doc 01 · Visión y alcance** · v3.0 · Mayo 2026. Relacionados: 02 (RFs), 05 (UI), 09 (cómo se obtiene cada dato), 10 (UPL/exactitud), 13 (AAF). Mantener bajo `/docs/`.
