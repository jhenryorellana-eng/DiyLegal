import { z } from "zod";
import { GEMINI_FLASH, geminiJson } from "@/lib/gemini/client";

/**
 * Examen de civismo (civics) para la naturalización N-400 (doc 09 §10, doc 02).
 * Dos pools oficiales: 2008 (100 preguntas) y 2025 (128). Datos en vivo vía
 * Gemini grounded; bilingüe ES/EN. Cache-first por pool (Gemini cuesta).
 */

/** Frontera de selección de pool (doc 09 §10): < cutoff → 2008; ≥ → 2025. */
export const CIVICS_CUTOFF = "2025-10-20";

export type CivicsVersion = "2008" | "2025";

/** Cantidad oficial esperada por pool (doc 09 §10). */
export const CIVICS_EXPECTED_COUNT: Record<CivicsVersion, number> = { "2008": 100, "2025": 128 };

const CivicsQuestionSchema = z.object({
  number: z.number().int(),
  questionEn: z.string().min(1),
  questionEs: z.string().min(1),
  answers: z.array(z.string().min(1)).min(1),
});

export const CivicsSchema = z.object({
  version: z.enum(["2008", "2025"]),
  questions: z.array(CivicsQuestionSchema).min(1),
});

export type CivicsData = z.infer<typeof CivicsSchema>;

/**
 * Selecciona el pool. `version` explícito gana; si no, por `filingDate`
 * (fecha de presentación del N-400). Sin datos → 2025 vigente (SUPUESTO: el doc
 * no fija el default).
 */
export function selectVersion(input: {
  version?: CivicsVersion;
  filingDate?: string;
}): CivicsVersion {
  if (input.version) return input.version;
  if (input.filingDate) return input.filingDate < CIVICS_CUTOFF ? "2008" : "2025";
  return "2025";
}

export function civicsCacheName(version: CivicsVersion): string {
  return `civics-cache-${version}`;
}

export async function fetchCivics(version: CivicsVersion): Promise<CivicsData> {
  const count = CIVICS_EXPECTED_COUNT[version];
  const prompt = [
    `Devuelve las ${count} preguntas oficiales del examen de civismo (civics) para la`,
    `naturalización de EE. UU., versión ${version} de USCIS. SOLO JSON:`,
    `{"version":"${version}","questions":[{"number":1,"questionEn":"","questionEs":"","answers":[""]}]}`,
    `Incluye las ${count} preguntas completas, con sus respuestas oficiales.`,
    "No inventes; usa el contenido oficial de USCIS.",
  ].join(" ");
  return geminiJson(prompt, CivicsSchema, {
    grounded: true,
    temperature: 0,
    model: GEMINI_FLASH,
    maxOutputTokens: 60000,
  });
}
