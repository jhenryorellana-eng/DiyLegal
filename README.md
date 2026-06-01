# DIY Legal

App móvil de **auto-servicio** para trámites migratorios en EE.UU. (asilo/EOIR, USCIS, consular/NVC y herramientas de apoyo). Información oficial, organizada y bilingüe.

> **DIY Legal no es un bufete ni brinda asesoría legal.** Informa y organiza; no aconseja (límite UPL — doc 10).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 · Zod v4 · Supabase + Stripe (Capa A) · Capacitor · HyperBrowser + 2Captcha (worker) · Gemini 2.5 Pro · USCIS Torch API.

Arquitectura de **dos capas**: **A) Producto** (Supabase: cuentas, casos privados, billing) ↔ **B) Integración de datos** (Next API + caches + 12 crons + worker dedicado para navegador/captcha). Ver `docs/06_ARQUITECTURA.md`.

## Requisitos

- Node **>= 22.5** (usa `node:sqlite`). Desarrollado con Node 24/25.

## Empezar

```bash
npm install
cp .env.local.example .env.local   # completar claves (server-side); rotar las del demo
npm run dev                         # http://localhost:3000
```

## Scripts

| Script                            | Qué hace               |
| --------------------------------- | ---------------------- |
| `npm run dev`                     | Servidor de desarrollo |
| `npm run build`                   | Build de producción    |
| `npm run typecheck`               | `tsc --noEmit`         |
| `npm run test`                    | Tests (Vitest)         |
| `npm run lint`                    | ESLint                 |
| `npm run format` / `format:check` | Prettier               |

## Estructura

```
app/        Next.js App Router (UI + app/api/**)
lib/        Lógica por slice + infra transversal (http, feeds, aaf, cron, validation)
types/      Tipos compartidos (node:sqlite)
data/       Caches JSON generados (git-ignored)
docs/       Los 13 PRDs (00–13) — fuente de verdad
tasks/      Plan maestro (todo.md), convenciones, lessons
worker/     Worker dedicado navegador/captcha (Fase 5+)
supabase/   Migraciones + RLS (Fase 3+)
```

## Convenciones

Respuesta API uniforme `{ ok, data } | { ok, error:{ kind } }`. Toda fuente nace tras un feature flag en `false`. Patrón transversal: `flag → obtención → cache → endpoint → cron`. Detalle en `tasks/conventions.md`.

## Estado

Construcción incremental por fases (slices verticales). Plan y progreso en `tasks/todo.md`. **Fase 0 (fundación) en curso.**
