# 04 · Branding — DIY Legal

> Identidad de marca, voz y tono, naming y aplicación. Reemplaza el branding de "MiTrámite".
> Versión 3.0 · Mayo 2026 (actualizado con el demo real REPLICATION-GUIDE.md)

---

## 1. Nombre y esencia

**Nombre del producto:** **DIY Legal**

**Lectura:** "Di-Y Legal" / "Do It Yourself Legal" — *hazlo tú mismo, legalmente.*

**Esencia (una frase):**
> DIY Legal pone tu trámite migratorio en tus manos: información oficial, organizada y en tu idioma, para que avances tú mismo, con claridad y sin pagar de más.

**Tagline corto:** **"Tu trámite, en tus manos."**

**Tagline largo (landing):**
> "Información oficial de tu caso de inmigración, organizada y en tu idioma. Sin abogados que cobran $300 la hora para decirte lo que ya es público. DIY Legal no reemplaza a un abogado — te da el control."

---

## 2. Posicionamiento

| Eje | DIY Legal es… | DIY Legal NO es… |
|---|---|---|
| Categoría | Herramienta de auto-servicio + organización + información | Un bufete / un abogado / asesoría legal |
| Tono | Moderno, claro, empoderador, cálido | Gris, burocrático, intimidante, "de gobierno" |
| Precio | Accesible ($17/mes Pro) | Caro / por hora |
| Confianza | Datos oficiales, cifrado, transparencia | Promesas mágicas de resultados |

**Frase de control legal (siempre cerca de la marca):** *"DIY Legal no es un bufete ni brinda asesoría legal."*

---

## 3. Personalidad de marca

- **Empoderadora** — "tú puedes hacer esto". El usuario es el protagonista, no el sistema.
- **Disruptiva pero confiable** — se ve como una fintech moderna, no como un portal estatal.
- **Humana y cálida** — habla como una persona que te quiere ayudar, no como un PDF legal.
- **Profesional sin ser intimidante** — tu mamá debe poder usarla.
- **Premium accesible** — justifica el precio sin sentirse elitista.

### Arquetipo
Mezcla de **El Héroe** (tú, el usuario, tomas el control) + **El Sabio/Guía** (DIY Legal te da el conocimiento). La marca es el mentor; el héroe es el usuario.

---

## 4. Voz y tono

### Principios de copy
1. **Español primero, claro y directo.** Frases cortas. Cero jerga legal innecesaria.
2. **Tú, no usted** (cercano), salvo donde el contexto regional lo requiera — configurable por i18n.
3. **Explica, no asusta.** Los disclaimers son honestos pero no paralizantes.
4. **Errores humanos.** "No pudimos conectar con EOIR. Probá de nuevo en 1 minuto." (no "Error 500").
5. **Nunca expone la mecánica interna.** El usuario no lee "captcha", "scraping" ni "2Captcha"; lee "verificando seguridad", "conectando con EOIR".

### Tabla de tono por contexto

| Contexto | Tono | Ejemplo |
|---|---|---|
| Bienvenida / onboarding | Cálido, alentador | "Bienvenido. Vamos a organizar tu caso, paso a paso." |
| Carga de datos | Tranquilizador, transparente | "Conectando con EOIR… esto puede tardar unos segundos." |
| Buenas noticias | Celebratorio, mesurado | "Tu caso está al día. Tu próxima audiencia es el 6 de abril." |
| Alertas / vencimientos | Claro, urgente sin pánico | "Tu AAF vence en 12 días. Acá te explicamos qué hacer." |
| Errores | Empático, accionable | "Algo falló de nuestro lado. Ya lo estamos viendo. Probá de nuevo en un momento." |
| Disclaimers legales | Honesto, breve, no intimidante | "Esto es información, no asesoría legal. Para tu situación específica, consultá con un abogado." |

### Palabras a evitar
- ❌ "captcha", "token", "scraper", "bot", "DevTools" (jerga técnica de cara al usuario)
- ❌ "garantizado", "asegurado", "te aprobarán" (promesas de resultado)
- ❌ "deberías presentar/hacer X" en el chat IA (asesoría → UPL)

---

## 5. Identidad visual (cabecera — detalle en doc 05)

DIY Legal hereda y depura el sistema visual de MiTrámite, con un **giro hacia lo empoderador y tech-premium**.

### Logo
- **Wordmark:** "DIY Legal" en la tipografía display (Cabinet Grotesk / Plus Jakarta Sans Bold), letter-spacing -0.02em.
- **Tratamiento de "DIY":** puede destacarse en color primario (Indigo) y "Legal" en neutral oscuro, o un lockup donde "DIY" va en un contenedor pill. (Generar variaciones en doc 05 / Figma.)
- **Símbolo / app icon:** una marca geométrica simple y memorable — sugerencia: un **check dentro de un contenedor redondeado** (sentido: "hecho por ti, correcto") o las iniciales **"DiY"** estilizadas. Debe leerse a 1024px y a 48px.
- **Reglas:** área de protección = altura de la "D"; nunca deformar; versiones mono (blanco/negro) para fondos complejos.

> ⚠️ **Evitar** (igual que en v1): feel de gobierno, banderas USA en el branding, look de banco tradicional, estética de NGO amateur.

### Color (resumen — paleta completa en doc 05)
- **Primario:** Indigo Soft `#5B4FE9` (confianza moderna, tech).
- **Acento:** Coral Warm `#FF6B6B` (calidez, humanidad).
- **Semánticos:** success `#10B981`, warning `#F59E0B`, error `#F43F5E`.
- **Neutrales:** warm grays (`#FAFAF9` base → `#1C1917` headings).

### Tipografía
- **Display/Headings:** Cabinet Grotesk (fallback Plus Jakarta Sans), Bold.
- **Body:** Inter.
- **Datos/números:** JetBrains Mono (tabular nums).

### Estilo gráfico
- Glassmorphism sutil, bordes redondeados 16–24px, micro-interacciones spring, gradientes muy sutiles. Premium, limpio, mobile-first.

---

## 6. Aplicación de marca

| Superficie | Aplicación |
|---|---|
| App icon (iOS/Android) | Símbolo sobre fondo gradiente primario; maskable variant |
| Splash screen (Capacitor) | Logo centrado sobre `#FAFAF9` o gradiente hero, animación de entrada sutil |
| Store listing | Screenshots con el design system, tagline "Tu trámite, en tus manos." |
| Notificaciones push | Tono cálido, accionable; ícono de marca |
| Emails (Resend) | Header con wordmark, footer con disclaimer legal |
| Landing/marketing | Hero empoderador + prueba social + claridad de precio + disclaimer |

---

## 7. Naming — decisión

Tras evaluar alternativas (MiTrámite, MigraSafe, PasoLegal, etc.), **DIY Legal** se elige por:
- ✅ Comunica de inmediato la propuesta: *hazlo tú mismo*.
- ✅ "Legal" da seriedad; "DIY" da empoderamiento y modernidad.
- ✅ Funciona bilingüe (ES/EN) — el target es hispano en EE.UU.
- ✅ Brandable y corto.

**Riesgo a gestionar:** "Legal" puede sonar a asesoría. Se mitiga con el **disclaimer omnipresente** ("no es un bufete / no es asesoría legal") y con copy que enfatiza *información + organización*, no consejo. (Ver doc 10 — UPL.)

> **Verificación pendiente (no técnica):** disponibilidad de marca/dominio y revisión de que el nombre no induzca a creer que se ofrece servicio legal — confirmar con el abogado antes del lanzamiento.

---

## 8. Do / Don't de marca

**Do**
- Hablar en español claro y cálido.
- Poner al usuario como protagonista ("tú puedes").
- Ser transparente sobre límites ("esto es info, no asesoría").
- Mantener consistencia visual con los tokens.

**Don't**
- Prometer resultados migratorios.
- Usar jerga técnica de cara al usuario.
- Imitar estética gubernamental o bancaria.
- Saturar de disclaimers al punto de asustar.

---

## (v3.0) Voz para el catálogo ampliado

Con el alcance ampliado (15 funcionalidades: AAF, USCIS, NVC, processing times, cortes/jueces, civics, etc.), la voz se mantiene **empoderadora y clara**, con dos anclas nuevas:

- **"Datos oficiales, no asesoría."** DIY Legal trae lo que dice el gobierno (USCIS, EOIR, Depto. de Estado, IRS, CDC) y lo hace entendible; no opina ni aconseja. El disclaimer UPL es parte del tono, no una nota al pie.
- **"Tú puedes, te damos la herramienta."** Cada utilidad (calcular el AAF, ver tu audiencia, saber cuánto tarda tu formulario) refuerza autonomía con seguridad.

Microcopy sensible (tarifas, mociones AAF, estadísticas de juez, I-94) sigue las fórmulas del doc 05 §7. Nunca se usa jerga técnica (captcha/scraping/bot) en ninguna superficie de marca.
