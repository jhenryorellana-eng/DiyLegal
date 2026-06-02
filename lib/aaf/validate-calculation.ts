import { z } from "zod";
import type { AafResult } from "@/lib/aaf/calculator";
import { GEMINI_PRO, geminiJson } from "@/lib/gemini/client";
import { withCache } from "@/lib/gemini/response-cache";

/**
 * Validación OPCIONAL del cálculo con Gemini (doc 13 §3.5): detecta casos
 * especiales (REFERRED / CONSOLIDATED / Ms. L.) que el motor determinista no
 * modela. Si Gemini no está disponible/falla → fallback `valid:true` (el cálculo
 * determinista sigue siendo la fuente de verdad; la IA sólo alerta).
 */

export interface ValidationResult {
  valid: boolean;
  /** Etiquetas de casos especiales detectados (vacío si ninguno). */
  flags: string[];
  notes?: string;
  /** `true` cuando se usó el fallback (Gemini no corrió). */
  fromFallback: boolean;
}

const ValidationSchema = z.object({
  valid: z.boolean(),
  flags: z.array(z.string()),
  notes: z.string().optional(),
});

export interface ValidationContext {
  /** Texto libre del estado del caso (p. ej. del portal EOIR) si está disponible. */
  caseSummary?: string;
}

function buildPrompt(result: AafResult, context: ValidationContext): string {
  return [
    "You validate an Annual Asylum Fee (AAF) calculation for edge cases.",
    `Branch: ${result.branch}. Status: ${result.aafStatus}. FY: ${result.fiscalYear}.`,
    `Amount cents: ${result.amountCents}. Next due: ${result.nextDueDate ?? "n/a"}.`,
    context.caseSummary ? `Case summary: ${context.caseSummary}.` : "",
    "Flag REFERRED, CONSOLIDATED, or Ms. L. class-member situations that could change AAF obligations.",
    'Return ONLY JSON: {"valid":true,"flags":[],"notes":""}',
  ]
    .filter(Boolean)
    .join(" ");
}

export async function validateCalculation(
  result: AafResult,
  context: ValidationContext = {},
): Promise<ValidationResult> {
  const cacheKey = `validate:${result.branch}:${result.aafStatus}:${result.fiscalYear}:${context.caseSummary ?? ""}`;
  try {
    return await withCache(cacheKey, async () => {
      const parsed = await geminiJson(buildPrompt(result, context), ValidationSchema, {
        model: GEMINI_PRO,
        temperature: 0.1,
      });
      return { ...parsed, fromFallback: false };
    });
  } catch {
    return { valid: true, flags: [], fromFallback: true };
  }
}
