import { z } from "zod";
import { GEMINI_FLASH, geminiJson } from "@/lib/gemini/client";

/**
 * Manuales del conductor (DMV) por estado (doc 09 §10, doc 05 §5.6).
 * 12 estados; homepage oficial del DMV + enlaces al manual EN/ES.
 * Datos en vivo vía Gemini grounded; cache-first.
 */

export const DMV_STATES = [
  "CA",
  "TX",
  "NY",
  "FL",
  "IL",
  "NJ",
  "AZ",
  "GA",
  "NC",
  "WA",
  "NV",
  "VA",
] as const;

const DmvStateSchema = z.object({
  code: z.string().length(2),
  name: z.string().min(1),
  dmvHomepage: z.string().min(1),
  manualEnUrl: z.string().nullable(),
  manualEsUrl: z.string().nullable(),
});

export const DmvSchema = z.object({
  states: z.array(DmvStateSchema).min(1),
  asOf: z.string().min(1),
});

export type DmvData = z.infer<typeof DmvSchema>;
export type DmvState = z.infer<typeof DmvStateSchema>;

export const DMV_CACHE = "dmv-cache";

export function findDmvState(data: DmvData, code: string): DmvState | null {
  const upper = code.toUpperCase();
  return data.states.find((s) => s.code.toUpperCase() === upper) ?? null;
}

export async function fetchDmv(): Promise<DmvData> {
  const prompt = [
    `Para estos estados de EE. UU. (${DMV_STATES.join(", ")}), devuelve SOLO un objeto JSON:`,
    '{"states":[{"code":"CA","name":"California","dmvHomepage":"URL","manualEnUrl":"URL o null","manualEsUrl":"URL o null"}],"asOf":"YYYY-MM"}',
    "dmvHomepage es la página oficial del DMV del estado; manualEnUrl/manualEsUrl son los enlaces",
    "al manual oficial del conductor en inglés y español (null si no existe en ese idioma).",
    "No inventes; usa URLs oficiales reales y vigentes.",
  ].join(" ");
  return geminiJson(prompt, DmvSchema, {
    grounded: true,
    temperature: 0.1,
    model: GEMINI_FLASH,
    maxOutputTokens: 8000,
  });
}
