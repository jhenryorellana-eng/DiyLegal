# 11 · Estrategia móvil con Capacitor — DIY Legal

> Cómo el codebase web (Next.js 16.2.6) se empaqueta como app nativa iOS/Android con **Capacitor**, manteniendo una sola base de código y una capa de abstracción de plataforma. Implementa el `packages/platform` definido en el doc 06.
> Versión 3.0 · Mayo 2026 (actualizado con el demo real REPLICATION-GUIDE.md)

---

## 1. Por qué Capacitor

- **Un solo codebase** (Next.js + Tailwind + shadcn/ui) → web/PWA + iOS + Android.
- Acceso a **APIs nativas** (cámara, push, biometría, secure storage) vía plugins.
- El equipo es web-first; Capacitor evita mantener dos apps nativas separadas.
- Salida también como **PWA** instalable (mismo bundle).

Trade-off aceptado: la UI es WebView, no nativa pura. Se mitiga con micro-interacciones cuidadas (Framer Motion, doc 05), transiciones y respeto de safe-areas para que se sienta nativa.

---

## 2. Modelo de empaquetado

```
Next.js 16.2.6 (App Router)
   │  build estático exportable de la UI cliente (SSG/CSR)
   ▼
Capacitor (capacitor.config.ts)
   ├── ios/      (proyecto Xcode)
   └── android/  (proyecto Gradle)
```

Decisiones clave:
- La app móvil consume el **backend (Supabase + Edge Functions)** vía HTTPS REST (doc 07). El shell **no** hace SSR; la UI cliente se sirve como assets dentro del bundle nativo (o vía servidor de Next para la web/PWA).
- Esto encaja con el patrón del doc 07: el cliente observa jobs de scraping vía **Realtime** o polling de `GET /v1/scrape-jobs/:jobId` — funciona igual en WebView que en web.
- `‹CONFIRMAR›` Estrategia de assets: build de UI cliente embebido (recomendado para arranque offline) vs `server.url` apuntando a la web desplegada (más simple, requiere red). Recomendado: **assets embebidos** + datos por API.

`capacitor.config.ts` (esqueleto):
```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'legal.diy.app',            // ‹CONFIRMAR› bundle id definitivo
  appName: 'DIY Legal',
  webDir: 'out',                     // export de la UI cliente
  ios:     { contentInset: 'always' },
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: '#1C1917' },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
  server: { androidScheme: 'https' }, // esquema seguro
};
export default config;
```

---

## 3. Capa de abstracción de plataforma (`packages/platform`)

El doc 06 define `packages/platform` para que el **dominio y la UI no sepan** si corren en web o nativo. Cada capability expone una interfaz; hay implementación **web** y **native**.

```
packages/platform/
├── storage/        # KV simple
│   ├── index.ts          (interfaz Storage)
│   ├── storage.web.ts     → localStorage / IndexedDB
│   └── storage.native.ts  → @capacitor/preferences
├── secure/         # secretos (clave de cifrado de documentos)
│   ├── secure.web.ts      → WebCrypto + IndexedDB (best-effort)
│   └── secure.native.ts   → Keychain (iOS) / Keystore (Android)
├── push/
│   ├── push.web.ts        → Web Push / no-op
│   └── push.native.ts     → @capacitor/push-notifications
├── camera/
│   ├── camera.web.ts      → <input type=file capture>
│   └── camera.native.ts   → @capacitor/camera
├── biometrics/
│   ├── biometrics.web.ts  → no-op / WebAuthn opcional
│   └── biometrics.native.ts → plugin biométrico (Face ID / huella)
├── filesystem/     → @capacitor/filesystem | File System Access API
├── share/          → @capacitor/share | Web Share API
└── app-info/       → versión, plataforma, deep links
```

Selección de implementación por `Capacitor.isNativePlatform()` (o build-time). La UI importa siempre `@diy/platform`, nunca un plugin directamente.

---

## 4. Plugins nativos y su uso

| Plugin | Uso en DIY Legal | Notas |
|---|---|---|
| `@capacitor/camera` | Escanear/fotografiar documentos del caso | Combinar con cifrado client-side (doc 10) antes de subir |
| `@capacitor/push-notifications` | Avisos de audiencias, cambios de estado, fin de scraping en modo diferido (doc 02, 07) | Requiere APNs (iOS) y FCM (Android) |
| `@capacitor/preferences` | KV no sensible (flags UI, último filtro) | No para secretos |
| **Secure storage / Keychain-Keystore** | Guardar la **clave de cifrado de documentos** (doc 10 §4.3) | iOS Keychain / Android Keystore; plugin community o nativo |
| Biometría (Face ID / huella) | Desbloqueo de la app y de documentos sensibles | Mejora la postura de seguridad (doc 10) |
| `@capacitor/filesystem` | Guardar export de datos (doc 10 §6.1) | Derecho de portabilidad |
| `@capacitor/share` | Compartir/exportar PDF de formularios | |
| `@capacitor/app` + `@capacitor/browser` | Deep links, abrir Stripe Checkout / enlaces externos | Checkout fuera del WebView (ver §6) |
| `@capacitor/network` | Detectar offline → modo degradado (doc 03) | |
| `@capacitor/splash-screen` + assets | Branding de arranque (doc 04) | |

---

## 5. Notificaciones push (extremo a extremo)

1. App registra el device token (APNs/FCM) → se guarda asociado al usuario (tabla `notifications`/devices, doc 08).
2. El backend (Edge Function / worker) dispara push en eventos:
   - cambio de estado del caso tras un scrape,
   - audiencia próxima (job pg_cron, doc 07/08),
   - **fin de scraping en modo diferido** (doc 02 RF-CASE-01 AC7 / doc 09),
   - deadlines de documentos.
3. Tap en la notificación → **deep link** a la pantalla relevante (caso, documento).

Requisitos de cuenta de desarrollador: APNs key (Apple) y proyecto FCM (Google). Privacidad: el contenido de la push **no** incluye PII sensible (doc 10 §5) — texto genérico + deep link.

---

## 6. Pagos en móvil (Stripe) — nota importante de tiendas

- **Stripe** gestiona la suscripción Pro ($17) (doc 07).
- **Política de las tiendas:** Apple/Google requieren su propio IAP para **bienes/servicios digitales** consumidos en la app, con su comisión. Pagar suscripción de software vía Stripe dentro de la app puede violar las reglas de App Store/Play.
- `‹REVISAR_CON_ABOGADO›`/decisión de negocio. Opciones:
  1. **In-App Purchase nativo** (StoreKit / Google Play Billing) en móvil, Stripe en web. (Cumple, pero comisión ~15–30% y doble integración.)
  2. Suscripción gestionada **en la web** (fuera de la app), la app solo refleja el estado. (Modelo "reader"; revisar elegibilidad.)
- El backend ya hace **feature gating por plan** (doc 07/08), así que la fuente de pago es intercambiable sin tocar el dominio.

---

## 7. Consideraciones de UX móvil

- **Safe areas / notch:** usar `env(safe-area-inset-*)`; el bottom nav de 4 tabs (Inicio/Documentos/IA/Más, doc 05) respeta el home indicator.
- **Teclado:** ajustar scroll en formularios y en el input del A-Number (doc 05 P09 previo).
- **Gestos:** swipe back en iOS, back button de Android (manejar con el router; `@capacitor/app` `backButton`).
- **Estados offline:** banner + acciones deshabilitadas que requieren red (scraping, IA); lectura de datos cacheados permitida (doc 03 degradación).
- **Performance de arranque:** splash corto + assets embebidos; objetivo de TTI alineado con doc 03.
- **Dark mode:** tokens ya soportan neutrales cálidos `#FAFAF9`→`#1C1917` (doc 05).

---

## 8. Builds y firma

**Android**
- Build con Gradle; `versionCode`/`versionName` sincronizados con la versión del paquete.
- **AAB** (Android App Bundle) firmado para Play; keystore en secreto de CI (doc 12), nunca en el repo.
- Permisos mínimos en `AndroidManifest` (cámara, internet, notificaciones); justificar cada uno.

**iOS**
- Proyecto Xcode; firma con Apple Developer Program.
- Capabilities: Push Notifications, Keychain Sharing (si aplica), App Groups si se comparte storage.
- `Info.plist`: descripciones de uso (`NSCameraUsageDescription`, Face ID `NSFaceIDUsageDescription`).

Automatización (doc 12): Fastlane o EAS-like para builds reproducibles; CI genera artefactos firmados.

---

## 9. Publicación en tiendas

| Ítem | App Store (Apple) | Play Store (Google) |
|---|---|---|
| Cuenta | Apple Developer ($99/año) | Play Console ($25 único) |
| Privacidad | **Privacy Nutrition Labels** + URL de política | **Data Safety form** + URL de política |
| Revisión sensible | Inmigración/legal puede recibir escrutinio extra | Categoría y declaración de funciones |
| UPL/Disclaimers | Disclaimer visible (doc 10) evita rechazo por "asesoría legal" | Ídem |
| Pagos | Ver §6 (IAP vs reader) | Ver §6 |
| Assets | Icono, screenshots, descripción, soporte/URL | Ídem |

`‹REVISAR_CON_ABOGADO›` Las apps de inmigración y "legal" suelen requerir claridad sobre que **no** prestan servicios legales; alinear ficha de tienda con el disclaimer del doc 10/04.

---

## 10. Assets de marca (doc 04)

- **Icono** adaptable (Android adaptive icon + iOS) en la paleta de marca; generar todos los tamaños.
- **Splash** con fondo `#1C1917` y logotipo; transición a la app.
- Screenshots por dispositivo siguiendo el design system (doc 05).
- Herramienta: `@capacitor/assets` para generar iconos/splash desde un master.

---

## 11. Checklist móvil

- [ ] `capacitor.config.ts` con appId/appName definitivos.
- [ ] `packages/platform` con impl web + native para storage, secure, push, camera, biometrics, filesystem, share, network.
- [ ] Secure storage (Keychain/Keystore) probado para la clave de cifrado de documentos (doc 10).
- [ ] Push end-to-end (APNs + FCM) con deep links, sin PII en el payload.
- [ ] Decisión de pagos (IAP vs reader) tomada y `‹REVISAR_CON_ABOGADO›`.
- [ ] Safe areas, back button, teclado, offline verificados.
- [ ] Builds firmados (AAB + iOS) desde CI; secrets fuera del repo.
- [ ] Privacy labels / Data Safety completados y consistentes con doc 10.
- [ ] Iconos/splash/screenshots generados desde master de marca (doc 04).
- [ ] Permisos mínimos justificados en manifests/Info.plist.

---

**Doc 11 · Capacitor móvil** · v2.0 · Mayo 2026. Relacionados: 03 (performance/offline), 04 (marca/assets), 05 (UI/nav 4 tabs), 06 (`packages/platform`), 07 (API/Realtime/pagos/push), 08 (devices/notifications), 10 (secure storage/cifrado/privacidad), 12 (CI/builds). Mantener bajo `/docs/`.

---

## (v3.0) Worker dedicado y la app móvil

Aclaración clave para móvil (doc 06 §6, doc 09 §14):

- Los flujos con **navegador + captcha** (EOIR, NVC) y el `questionnaire-scraper` **no corren en el shell móvil** (Capacitor) **ni en funciones Vercel**: corren en un **worker dedicado** (contenedor long-running) que la app invoca por API.
- La app móvil solo **encola** la consulta (`POST /api/user/cases` → **202 {jobId}**) y observa el progreso por **Supabase Realtime** (o polling a `/api/jobs/:jobId`). La pantalla **P-Progreso** (doc 05 §6) muestra texto progresivo, **sin** captcha ni token.
- Lo liviano y público (feeds, estáticos, tools, processing-times read, USCIS Torch, AAF cálculo/PDF) sí se sirve desde Vercel y se consume normal desde la app.
- **Stack:** el codebase es **Next.js 16.2.6** envuelto por Capacitor; mantener `serverExternalPackages` y Node ≥ 22.5 del lado servidor (no afecta al bundle móvil).
- **Notificaciones** del worker (caso listo, AAF por vencer): push sin PII sensible en el payload (doc 10).
