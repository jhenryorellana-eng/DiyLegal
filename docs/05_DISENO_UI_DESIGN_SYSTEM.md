# 05 · Diseño UI y Design System — DIY Legal

> Sistema de diseño + especificación de pantallas para **todas** las funcionalidades (incluidas las nuevas del demo). Conserva los design tokens de STITCH y **elimina el paso manual de captcha**: la consulta de caso es 100% automática (pantalla de progreso, sin DevTools ni token).
> Versión 3.0 · Mayo 2026

---

## 1. Principios de diseño

1. **Claridad sobre densidad.** Un trámite es estresante; cada pantalla resuelve **una** pregunta.
2. **Bilingüe ES/EN** real (no solo etiquetas): copy, fechas y montos localizados.
3. **Cero jerga técnica.** Nunca se nombra captcha, scraping, bot, proxy, "endpoint". Todo es "el sistema oficial".
4. **Datos oficiales con respeto al dato.** Montos/plazos se muestran exactos, con fecha/fuente y aviso (doc 10).
5. **Disclaimer UPL omnipresente** (doc 04/10): "DIY Legal te da información y herramientas; no es un bufete ni da asesoría legal."
6. **Accesible** (WCAG AA): contraste, targets ≥ 44px, soporte de lector de pantalla, tipografías escalables.
7. **Móvil primero** (Capacitor), con micro-interacciones tipo *spring* y estados de carga progresivos.

---

## 2. Design tokens (preservados de STITCH)

### Color
| Token | Hex | Uso |
|---|---|---|
| `--primary` Indigo | `#5B4FE9` | Marca, CTAs primarios, foco. |
| `--accent` Coral | `#FF6B6B` | Acentos, highlights, badges puntuales. |
| `--success` | `#10B981` | Estados OK (caso activo, pagado). |
| `--warning` | `#F59E0B` | Vencimientos próximos (`due_soon`). |
| `--error` | `#F43F5E` | Vencido (`overdue`), errores. |
| Neutros warm-gray | `#FAFAF9` → `#1C1917` | Fondos, texto, bordes. |

Semáforo AAF/estado: `not_due`=neutro · `due_soon`=warning · `due_now`/`overdue`=error · `paid_current`=success · `case_closed`=neutro.

### Tipografía
- **Display:** Cabinet Grotesk (títulos, números grandes).
- **Body:** Inter (texto, UI).
- **Mono:** JetBrains Mono (A-Number, receipt, montos, fechas técnicas).

### Forma y movimiento
- Radius: `12` (controles) / `16` (cards) / `24` (modales/hero).
- Grid de 8pt; espaciados múltiplos de 8.
- **Glassmorphism** sutil en overlays; sombras suaves.
- Micro-interacciones **spring** (Framer Motion): press, aparición de cards, progreso.

### Stack de implementación
React 19 + Tailwind v4 + **Radix UI** (dialog, select, popover, tabs, tooltip) + Framer Motion. Estado: Zustand. Datos: TanStack Query. (doc 06)

---

## 3. Arquitectura de navegación

**Bottom nav (5 tabs):**

| Tab | Icono | Contenido |
|---|---|---|
| **Inicio** | home | Dashboard: resumen de casos, alerta de **AAF por vencer**, próxima audiencia, accesos rápidos. |
| **Casos** | folder | Lista de casos (EOIR/USCIS/NVC) + agregar caso; detalle de caso (incl. **AAF** en casos de asilo). |
| **Herramientas** | grid | Hub de utilidades (plazos, tarifas, cortes, naturalización, mis cálculos, apoyo). |
| **IA** | sparkle | Asistente (Gemini) con guardrails UPL. |
| **Más** | menu | Perfil, **Documentos**, plan/billing, idioma, notificaciones, ajustes, ayuda. |

**Pantallas ELIMINADAS** (vs MiTrámite/STITCH): ❌ "Mi familia" / Family Dashboard · ❌ "Buscar abogado" / verificación de abogados · ⚠️ "Reportes del país" como destino (off por defecto; ver §5.4).

**Hub "Herramientas"** (agrupado):
- **Plazos y tarifas:** Processing Times · Fee Schedule (G-1055) · Visa Bulletin · Regulaciones.
- **Cortes y jueces:** Court Intelligence (corte + juez).
- **Naturalización y requisitos:** Examen civics · Vacunas I-693 · REAL ID · Manuales DMV.
- **Mis cálculos:** Detector ITIN · Selective Service · Lector de I-94.
- **Apoyo:** Ayuda legal gratuita (Legal Aid).

---

## 4. Biblioteca de componentes (núcleo)

- **AppShell** (tab bar, header contextual, safe-area móvil).
- **CaseCard** (fuente, identificador enmascarado, estado con color, última actualización, CTA refrescar con cooldown).
- **StatusBadge** (semáforo de estado/AAF).
- **ProgressConsulta** (pantalla/overlay de progreso automático — §6).
- **DataNoticeBanner** (aviso de exactitud: "datos oficiales · {fecha} · confirma el monto exacto").
- **DisclaimerBar** (UPL, persistente en pantallas sensibles).
- **InputA-Number / InputReceipt / InputCaseNVC** (con validación y máscara mono).
- **FeeLines** (lista de **líneas exactas** del G-1055, sin simplificar).
- **AAFCard** (rama, monto, cuenta regresiva, pausa, acciones).
- **JudgeStatsCard** (tasas TRAC + etiqueta "contexto informativo, no predicción").
- **QuizCard** (civics: pregunta, opciones, modo estudio/práctica).
- **Checklist** (vacunas, REAL ID).
- **ToolResultCard** (ITIN/Selective Service: estado + explicación).
- **Uploader** (I-94 PDF + documentos, con cifrado client-side).
- **EmptyState / ErrorState** (mensajes sin jerga, accionables).
- **PaywallSheet** (gating Pro).

---

## 5. Especificación de pantallas

> Formato: **P-XX** · objetivo · contenido · estados · disclaimers.

### 5.1 Onboarding y cuenta
- **P-Onboarding:** idioma (ES/EN), valor en 3 slides, **aceptación de T&C + disclaimer UPL** (bloqueante, registra versión/timestamp). 
- **P-Auth:** registro/login (Supabase), biometría móvil.
- **P-Perfil/Ajustes:** idioma, notificaciones, plan, borrar cuenta.

### 5.2 Inicio (dashboard)
- **P-Inicio:** cards de casos con estado; **banner AAF** si hay vencimiento próximo; próxima audiencia; accesos rápidos a Herramientas; CTA "Agregar caso". EmptyState si no hay casos.

### 5.3 Casos
- **P-Casos (lista):** CaseCard por caso; filtro por fuente; botón "Agregar caso".
- **P-AgregarCaso:** selector de fuente (EOIR / USCIS / NVC) → formulario:
  - **EOIR:** A-Number (9 dígitos, máscara) + nacionalidad + idioma. *Texto de ayuda:* "Solo tu número A y tu país; nosotros consultamos el sistema oficial por ti." **Sin campo de token, sin DevTools.**
  - **USCIS:** receipt (validación IOE/EAC/...). 
  - **NVC:** tipo IV/NIV + nº de caso + passport/surname (o "NA").
- **P-Progreso (P-Consulta):** ver §6 (automática).
- **P-DetalleCaso (EOIR):** próxima audiencia (fecha/hora), juez (link a P-Corte), asylum clock (R/S) + días, docket/NTA, apelación/BIA; **AAFCard** embebida; timeline (case_events); refrescar (cooldown). 
- **P-DetalleCaso (USCIS):** estado por receipt + acciones; link a Processing Times del formulario.
- **P-DetalleCaso (NVC):** estado consular (At NVC, Ready, Issued, Refused, Administrative Processing…), detalle.

### 5.3.1 AAF (dentro del caso de asilo) — **nuevo**
- **P-AAF:** rama (A/B/C/D) + por qué; **monto exacto** (FY2026 $102.00, JetBrains Mono); **cuenta regresiva** al vencimiento con color (`due_soon`/`due_now`/`overdue`); pausa regulatoria si aplica; botones **"Generar moción (PDF)"** y **"Generar recibo (PDF)"** (Pro → PaywallSheet); **"Registrar pago"**; DisclaimerBar ("borrador, revísalo con un abogado"). Detalle en doc 13.

### 5.4 Herramientas — Plazos y tarifas (nuevas)
- **P-Tiempos (Processing Times):** selector formulario + oficina → rango (lower/upper/unit) + **fecha para case inquiry**; DataNoticeBanner ("datos oficiales · release {fecha} · leve retraso"). Sin PII.
- **P-Tarifas (Fee Schedule G-1055):** selector de formulario → **FeeLines** (líneas exactas del PDF, p. ej. I-589: filing fee + AAF); **aviso obligatorio** "confirma el monto exacto; si pagas de menos, USCIS rechaza y no devuelve". Nunca un solo número interpretado.
- **P-VisaBulletin:** fechas de prioridad por categoría/país; nota de mes/fuente.
- **P-Regulaciones (Federal Register):** lista de regulaciones recientes de USCIS (búsqueda por término) + enlace a fuente.
- **P-ReportesPais (Country Reports):** ⚠️ **oculta por defecto** (flag off). Si se habilita, aparece como **contexto de apoyo** dentro de un caso de asilo (condiciones del país), no como tab.

### 5.5 Herramientas — Cortes y jueces (nuevas)
- **P-Corte (Court Intelligence):** estado operativo (badge; **alerta si CLOSED**), dirección, teléfono, reglas de filing, lista de jueces.
- **P-Juez:** **JudgeStatsCard** (tasas TRAC de asilo, nacionalidades) con etiqueta "contexto informativo, no predicción de tu resultado".

### 5.6 Herramientas — Naturalización y requisitos (nuevas)
- **P-Civics:** elige pool correcto (2008/2025) según fecha N-400; **modo estudio** (tarjetas) y **modo práctica** (quiz con progreso); bilingüe.
- **P-Vacunas (I-693):** Checklist CDC/USCIS vigente.
- **P-RealID:** requisitos federales (`enforcedSince 2025-05-07`) + por estado: **¿da licencia a indocumentados?** (CA AB60, NY Green Light… sí; TX/FL/AZ/GA/NC no). Filtro por estado.
- **P-DMV:** enlaces a manuales PDF EN/ES + homepage por estado (12 estados).

### 5.7 Herramientas — Mis cálculos (nuevas, lógica local)
- **P-ITIN:** ingresa ITIN (máscara `9XX-XX-####`) + último año de uso → estado (active/expiring/expired/unknown) + explicación de la regla de 3 años. *Nota:* "el cálculo es local; no enviamos tu ITIN a terceros."
- **P-SelectiveService:** preguntas (año nacimiento, sexo, estatus, presencia, registro) → resultado (debe registrarse / necesita Status Information Letter / exento). No pide SSN.
- **P-I94:** **Uploader** de PDF del I-94 → extrae historial (Gemini Vision); aclara "leemos el documento que tú subes; no consultamos a CBP directamente". Borrado según política.

### 5.8 Herramientas — Apoyo
- **P-Apoyo (Legal Aid):** directorio por estado de organizaciones **gratuitas/pro bono**; disclaimer "DIY Legal no las representa ni garantiza". (No es "buscar abogado".)

### 5.9 IA y Más
- **P-IA:** chat con disclaimer visible; rechaza consejo legal específico y redirige a abogado/Legal Aid (doc 07 §6). Pro: contexto sobre datos del usuario.
- **P-Documentos:** lista de documentos cifrados (subidos + mociones/recibos AAF); subir/escanear/export.
- **P-Plan (Billing):** Free vs Pro ($17/mes); CTA Stripe; lo bloqueado muestra PaywallSheet.

---

## 6. Patrón de consulta automática (reemplaza el token manual)

**Antes (MiTrámite/STITCH):** el usuario abría DevTools y copiaba un `Captcha-Token`. **Eliminado.**

**Ahora — P-Progreso (automática):**
- Tras enviar el formulario (EOIR/NVC), se muestra una pantalla/overlay con **texto progresivo** y animación spring:
  1. "Conectando con el sistema oficial…"
  2. "Verificando tu caso…"
  3. "Casi listo, ordenando la información…"
- **Nunca** menciona captcha/bot/proxy. No hay input de token. 
- Como EOIR/NVC son **asíncronos** (doc 07 §5), si tarda: opción **"Te avisamos cuando esté listo"** (notificación) sin bloquear la app (modo diferido).
- Errores traducidos (doc 07 §2): `CaseNotFound` → "No encontramos tu caso, revisa tu número/país"; `CaptchaInvalid`/`RateLimited` → "El sistema oficial está ocupado, reintenta en un momento" + reintento/diferido. El detalle técnico **no** se muestra.
- Progreso en tiempo real vía Supabase Realtime sobre el `jobId`.

---

## 7. Avisos y disclaimers (copy base)

- **UPL (persistente):** "DIY Legal te da información y herramientas oficiales. No es un bufete ni brinda asesoría legal."
- **Tarifas (G-1055):** "Estos son los montos oficiales. **Confirma el monto exacto**; si pagas de menos, USCIS puede rechazar tu trámite y no devolver el dinero."
- **Processing times:** "Datos oficiales con leve retraso (actualización diaria)."
- **AAF moción:** "Documento de apoyo en **borrador**. Revísalo con un abogado antes de presentarlo."
- **Estadísticas del juez:** "Contexto informativo. No predice el resultado de tu caso."
- **I-94:** "Leemos el documento que tú subes; no es una consulta directa al gobierno."

---

## 8. Prompts de diseño (Stitch) — corrección

Los prompts heredados de `STITCH_UI_PROMPT_MITRAMITE.md` se mantienen para look & feel (tokens, glassmorphism, spring), pero se **corrigen**:
- Eliminar cualquier pantalla/ós paso de **copiar token de captcha / abrir DevTools** → reemplazar por **P-Progreso automática** (§6).
- Eliminar pantallas de **Mi familia**, **Buscar abogado**, y **Reportes del país** (esta última, off por defecto).
- Añadir prompts para las **pantallas nuevas** (§5.3.1–5.8): AAF, USCIS, NVC, Processing Times, Fee Schedule, Visa Bulletin, Regulaciones, Court Intelligence, Juez, Civics, Vacunas, REAL ID, DMV, ITIN, Selective Service, I-94, Legal Aid.
- Todos los prompts deben incluir el **DisclaimerBar** y, donde aplique, el **DataNoticeBanner**.

---

**Doc 05 · Diseño UI y Design System** · v3.0 · Mayo 2026. Relacionados: 01 (catálogo), 02 (RFs), 04 (voz/branding), 07 (estados/errores), 09 (por qué la consulta es automática), 13 (AAF). Mantener bajo `/docs/`.
