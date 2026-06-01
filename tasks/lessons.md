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
