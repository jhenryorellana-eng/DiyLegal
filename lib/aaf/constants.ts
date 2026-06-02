/**
 * Constantes del motor AAF (doc 13 §2.3, verificadas contra Federal Register /
 * 8 U.S.C. § 1808). Fechas como ISO `YYYY-MM-DD` interpretadas en **UTC**.
 *
 * El motor es 100% determinista: estas constantes son la única "configuración"
 * de fechas/citas. El monto vigente NO se hardcodea aquí salvo como semilla
 * (ver `lib/aaf/regulatory.ts`); el cron regulatorio lo mantiene al día.
 */

/** Inicio del FY2025 federal (1 oct 2024). Frontera rama B (legacy) ↔ A. */
export const FY2025_START = "2024-10-01";
/** Inicio del FY2026 federal (1 oct 2025). */
export const FY2026_START = "2025-10-01";
/** Fin del FY2025 (30 sep 2025): primer vencimiento anual de la cohorte legacy. */
export const FY2025_END = "2025-09-30";
/** One Big Beautiful Bill Act / HR-1 (4 jul 2025). Frontera rama D. */
export const OBBBA_START = "2025-07-04";
/** Interim Final Rule efectiva (29 may 2026) — referencia regulatoria. */
export const IFR_EFFECTIVE = "2026-05-29";

/** Día del mes/mes (0-based) del cierre del FY federal: 30 de septiembre. */
export const FY_END_MONTH = 8; // septiembre (0-based)
export const FY_END_DAY = 30;

/** Días pendiente antes del primer vencimiento de la cohorte post-FY2025. */
export const AAF_FIRST_PERIOD_DAYS = 365;

/** Umbral (días) para clasificar un vencimiento como `due_soon` (recordatorio). */
export const DUE_SOON_DAYS = 30;

/** Citas legales de referencia (NO asesoría; doc 13 §8.5). */
export const AAF_LEGAL_CITATIONS = [
  "8 U.S.C. § 1808",
  "Pub. L. 119-21 (One Big Beautiful Bill Act)",
] as const;
