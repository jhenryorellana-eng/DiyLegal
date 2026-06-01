# DIY Legal — Lessons Learned

> Tras cualquier corrección del usuario o error descubierto, registrar aquí: Error / Root cause / Rule.

## 2026-05-30: Arranque del proyecto
**Contexto:** proyecto greenfield, solo existen los 13 PRDs en `/docs`. Construcción incremental "1 por 1" (slice vertical por fase).
**Regla:** releer el PRD del slice ANTES de implementarlo; no alucinar rutas/decisiones; verificar (tsc + build + tests) antes de decir "hecho". Mantener `tasks/todo.md` y `tasks/conventions.md` como contexto vivo.

## 2026-05-31: ESLint flat config en Next 16
**Error:** `eslint.config.mjs` con `FlatCompat` extendiendo `next/core-web-vitals` + `next/typescript` rompía con ESLint 9.39 (`TypeError: Converting circular structure to JSON` en el config-validator de `@eslint/eslintrc`).
**Root cause:** `eslint-config-next` 16 ya exporta un **flat config array nativo** (`Linter.Config[]`, default + `./core-web-vitals` + `./typescript`). Usar `FlatCompat` sobre él duplica/rompe la validación.
**Regla:** en Next 15.3+/16, importar el config nativo y hacer spread: `import next from "eslint-config-next"; export default [{ignores:[...]}, ...next];`. No usar `FlatCompat` ni `@eslint/eslintrc`.

## 2026-05-31: Contrato API agnóstico del framework
**Contexto:** `lib/http/response.ts` usa `Response.json()` web-estándar (no `NextResponse`).
**Por qué:** los route handlers de Next pueden devolver `Response`; esto hace la infra trivialmente testeable en Vitest (entorno `node`) sin importar `next/server`.
**Regla:** mantener la infra transversal agnóstica del framework siempre que se pueda.

## 2026-05-31: Datos dinámicos, no estáticos hardcodeados
**Corrección del usuario:** ante la duda de cómo poblar los "estáticos" (vacunas/DMV/REAL-ID/civics), pidió: "usa la guía del documento pero usa la api o el scraping para que obtenga datos actualizados (no sea estático siempre)".
**Root cause:** el doc 09 §10 diseñó esas fuentes como JSON commiteado; eso envejece y obliga a hardcodear (riesgo de alucinar).
**Regla:** toda fuente obtiene datos de la fuente oficial (API/scraping) + cache + cron + fallback al último cache. Inspeccionar la respuesta/HTML real ANTES de fijar schema/selectores. Ver convenciones §"Datos: dinámicos desde la fuente oficial".

## 2026-06-01: El doc es guía, la fuente real manda (Processing Times)
**Contexto:** el doc 09 §7 especificaba el output del endpoint con un `unit` único por fila. Al inspeccionar el SQLite REAL del mirror jzebedee/uscis (descargado + leído con node:sqlite antes de escribir nada), las columnas `range_lower_unit`/`range_upper_unit` **difieren** en ~14 filas reales (Days/Months, Weeks/Months) y a veces no son numéricas ("See notes"/"learn more." con `range_lower`/`range_upper` = `null`).
**Root cause:** el doc asumió una simplificación que la fuente real no respeta; colapsar a un `unit` único habría **alterado/perdido datos sensibles** (RNF-OPS-04, exactitud no negociable).
**Regla:** cuando el PRD da un contrato de salida, validarlo contra los datos reales ANTES de implementar. Si la realidad lo contradice, gana la fuente (exponer `lowerUnit`+`upperUnit` separados, preservar `null`), y se documenta la desviación en el código + blueprint. Inspeccionar la DB/respuesta real (no solo el HTML) es parte del anti-alucinación.

## 2026-06-01: Aislar módulos nativos (node:sqlite) del path de lectura
**Contexto:** Processing Times usa `node:sqlite` (experimental, Node≥22.5) para leer el mirror. El endpoint de lectura corre en cada request (potencialmente edge/portable).
**Regla:** el módulo nativo se importa SOLO en el módulo de sync (`sync.ts`) y vía **dynamic import** (`await import("node:sqlite")`), nunca en el path de lectura. El endpoint importa solo la superficie pura (`index.ts`: schemas + lookup) y sirve el JSON cacheado (cache-only). Así el runtime de lectura no arrastra el binario y queda portable. Test: mockear el módulo sync para el cron; probar la transformación pura con fixtures reales.

## 2026-06-01: Los caches en `/data` NO persisten en Vercel (deuda transversal)
**Contexto:** `lib/feeds/cache.ts` (`saveCache`) escribe en `join(process.cwd(),"data")`. El blueprint asumió "cache JSON en /data que persiste cada cron" — válido en un servidor long-running, NO en Vercel: su filesystem es de SOLO LECTURA salvo `/tmp` (y `/tmp` no persiste entre invocaciones serverless). Detectado por review adversarial del slice 10, pero **aplica a los 10 feeds** (federal-register, travel-advisories, vaccines, dmv, real-id, civics, fee-schedule, processing-times…), no solo a Processing Times.
**Root cause:** mismatch entre el modelo de despliegue (Vercel serverless) y el patrón de persistencia (FS local). Mitigado parcialmente porque los feeds "live-first" (Federal Register, Travel Advisories) sirven en vivo y el cache es solo fallback; pero los "cache-first" (Gemini, Processing Times) dependen de que el cron pueble el cache → en Vercel el `saveCache` lanza EROFS y el cache nunca se llena.
**Regla:** antes de habilitar feeds en producción (no en false), decidir el storage real de caches a nivel plataforma: (a) correr el sync en el **worker dedicado** (Fase 5) que sí tiene FS persistente, o (b) mover los caches a **storage persistente** (Supabase tabla/Storage o Vercel Blob). Pendiente — no resolver slice por slice. Marcado en el header de `app/api/cron/processing-times-sync/route.ts` y a resolver en Fase 5/11.
