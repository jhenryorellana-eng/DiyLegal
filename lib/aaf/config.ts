import { flag } from "@/lib/feeds/config";

/**
 * Feature flags y constantes del AAF Tracker (doc 13, doc 07 §4.4).
 * La funcionalidad estrella (cálculo + mociones) se construye en la Fase 2.
 */

export const AAF_FLAGS = {
  uscis: "AAF_ENABLE_USCIS",
  courtIntelligence: "AAF_ENABLE_COURT_INTELLIGENCE",
  gemini: "AAF_ENABLE_GEMINI",
  motion: "AAF_ENABLE_MOTION",
} as const;

export type AafFlagKey = keyof typeof AAF_FLAGS;

export function aafEnabled(key: AafFlagKey): boolean {
  return flag(AAF_FLAGS[key]);
}

/**
 * `AAF_BYPASS_VALIDATORS` salta los validadores Gemini del cálculo (doc 13).
 * NUNCA debe estar activo en producción: aquí se fuerza a `false` si NODE_ENV=production.
 */
export function aafBypassValidators(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return flag("AAF_BYPASS_VALIDATORS");
}

/**
 * Monto vigente de la Annual Asylum Fee en CENTAVOS (doc 13; FY2026 = $102.00).
 * Es el valor por defecto/fallback; el monto autoritativo lo provee el
 * `regulatory-cache.json` que mantiene el cron regulatorio (Fase 2).
 */
export const AAF_AMOUNT_CENTS_FY2026 = 10_200;
