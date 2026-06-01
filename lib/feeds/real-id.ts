import { z } from "zod";
import { GEMINI_FLASH, geminiJson } from "@/lib/gemini/client";

/**
 * REAL ID: requisitos federales + por estado quién otorga licencia de conducir
 * a personas indocumentadas (doc 09 §10, doc 05 §5.6). Datos en vivo vía Gemini
 * grounded (tema sensible: estatus migratorio → exactitud verificada por fuente).
 */

const StateRealIdSchema = z.object({
  code: z.string().length(2),
  name: z.string().min(1),
  /** ¿El estado emite licencia de conducir estándar a personas indocumentadas? */
  offersLicenseToUndocumented: z.boolean(),
});

export const RealIdSchema = z.object({
  federal: z.object({
    enforcedSince: z.string().min(1),
    requiredDocuments: z.array(z.string()).min(1),
    source: z.string().min(1),
  }),
  states: z.array(StateRealIdSchema).min(1),
  asOf: z.string().min(1),
});

export type RealIdData = z.infer<typeof RealIdSchema>;
export type StateRealId = z.infer<typeof StateRealIdSchema>;

export const REAL_ID_CACHE = "real-id-cache";

const PROMPT = [
  "Sobre REAL ID en EE. UU., devuelve SOLO un objeto JSON con esta forma exacta:",
  '{"federal":{"enforcedSince":"YYYY-MM-DD","requiredDocuments":["..."],"source":"URL oficial DHS"},',
  '"states":[{"code":"CA","name":"California","offersLicenseToUndocumented":true}],"asOf":"YYYY-MM"}',
  "En federal incluye la fecha de aplicación obligatoria y los documentos aceptados.",
  "En states incluye los 50 estados + DC, indicando si cada uno emite licencia de conducir",
  "estándar a personas indocumentadas (sin estatus legal). No inventes; usa fuentes oficiales recientes.",
].join(" ");

/** Filtra la data por código de estado (2 letras), o null si no existe. */
export function findState(data: RealIdData, code: string): StateRealId | null {
  const upper = code.toUpperCase();
  return data.states.find((s) => s.code.toUpperCase() === upper) ?? null;
}

export async function fetchRealId(): Promise<RealIdData> {
  return geminiJson(PROMPT, RealIdSchema, {
    grounded: true,
    temperature: 0.1,
    model: GEMINI_FLASH,
  });
}
