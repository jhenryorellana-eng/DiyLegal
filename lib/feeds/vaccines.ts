import { z } from "zod";
import { GEMINI_FLASH, geminiJson } from "@/lib/gemini/client";

/**
 * Vacunas requeridas para el examen médico de inmigración I-693 (doc 09 §10).
 * Datos en vivo vía Gemini grounded (búsqueda web) — no hardcodeados ni inventados.
 * Bilingüe ES/EN. Patrón cache-first (Gemini cuesta; refresca el cron).
 */

const VaccineSchema = z.object({
  nameEn: z.string().min(1),
  nameEs: z.string().min(1),
});

export const VaccinesSchema = z.object({
  vaccines: z.array(VaccineSchema).min(1),
  covidRequired: z.boolean(),
  source: z.string().min(1),
  asOf: z.string().min(1),
});

export type VaccinesData = z.infer<typeof VaccinesSchema>;

export const VACCINES_CACHE = "vaccines-cache";

const PROMPT = [
  "Lista las vacunas actualmente requeridas para el examen médico de inmigración de EE. UU.",
  "(Formulario I-693), según la guía vigente de CDC/USCIS.",
  "Devuelve SOLO un objeto JSON con esta forma exacta:",
  '{"vaccines":[{"nameEn":"","nameEs":""}],"covidRequired":false,"source":"URL oficial","asOf":"YYYY-MM"}',
  "Incluye solo vacunas oficialmente requeridas. No inventes; usa información oficial reciente.",
].join(" ");

/** Obtiene la lista vigente vía Gemini grounded. Lanza si Gemini falla o no valida. */
export async function fetchVaccines(): Promise<VaccinesData> {
  return geminiJson(PROMPT, VaccinesSchema, {
    grounded: true,
    temperature: 0.1,
    model: GEMINI_FLASH,
  });
}
