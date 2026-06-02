import { FY2025_START, OBBBA_START } from "@/lib/aaf/constants";
import { parseUtcDate } from "@/lib/aaf/dates";

/**
 * Determinación de rama y año fiscal del AAF (doc 13 §2.2).
 * Determinístico: misma entrada → misma salida, sin IA.
 */

export type AafBranch = "A" | "B" | "C" | "D";

/** Foro del caso: asilo afirmativo (USCIS) o defensivo (corte EOIR). */
export type AafVenue = "USCIS_affirmative" | "EOIR_defensive";

/**
 * Selecciona la rama según fecha de presentación y foro (doc 13 §2.2).
 * Orden de prioridad fijado por el doc: C (defensivo) → D (OBBBA) → A (FY2025) → B.
 */
export function determineBranch(filingDate: Date, venue: AafVenue): AafBranch {
  if (venue === "EOIR_defensive") return "C";
  if (filingDate.getTime() >= parseUtcDate(OBBBA_START).getTime()) return "D";
  if (filingDate.getTime() >= parseUtcDate(FY2025_START).getTime()) return "A";
  return "B";
}

/**
 * Año fiscal federal de una fecha (doc 13 §2.2): octubre–diciembre cuentan para
 * el año siguiente (FY empieza el 1 de octubre). Ej.: 2025-10-01 → FY2026.
 */
export function getFiscalYear(date: Date): number {
  const month = date.getUTCMonth(); // 0-based; oct=9, nov=10, dic=11
  const year = date.getUTCFullYear();
  return month >= 9 ? year + 1 : year;
}

/** ¿La presentación cae en la cohorte legacy (antes del FY2025)? Vence el 30-sep. */
export function isLegacyFiling(filingDate: Date): boolean {
  return filingDate.getTime() < parseUtcDate(FY2025_START).getTime();
}
