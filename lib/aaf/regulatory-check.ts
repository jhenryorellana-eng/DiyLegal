import { z } from "zod";
import {
  PauseSchema,
  type RegulatorySnapshot,
  RegulatorySnapshotSchema,
  SourceRefSchema,
} from "@/lib/aaf/regulatory";
import { GEMINI_FLASH, geminiJson } from "@/lib/gemini/client";

/**
 * Vigilancia regulatoria del AAF (doc 13 §3.3, cron diario 06:00 UTC). Usa Gemini
 * **grounded** (búsqueda web) para refrescar monto vigente y pausas desde fuentes
 * oficiales (Federal Register, USCIS newsroom, EOIR PM, court orders, ajuste CPI-U).
 *
 * Desviación documentada del doc 07 §6 ("singleton Pro"): para *grounding* de
 * novedades usamos **Flash** (gratis, ya probado en civics/vaccines/dmv); no
 * incurre en billing y basta para extracción factual. El cálculo del motor sigue
 * siendo determinista; esto sólo alimenta el `regulatory-cache`.
 */

const RegulatoryExtractionSchema = z.object({
  amountCents: z.number().int().positive(),
  fiscalYear: z.number().int(),
  effectiveDate: z.string(),
  pauses: z.array(PauseSchema),
  sources: z.array(SourceRefSchema).min(1),
});

/** Quita fuentes con URL repetida (dedup por URL, doc 13 §3.3). */
function dedupByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.url) ? false : (seen.add(item.url), true)));
}

const PROMPT = [
  "You are a regulatory monitor for the U.S. Annual Asylum Fee (AAF) under 8 U.S.C. § 1808",
  "(One Big Beautiful Bill Act / HR-1). Using current official sources (Federal Register,",
  "USCIS newsroom, EOIR Policy Manual, federal court orders such as ASAP v. USCIS or Ms. L.,",
  "and any CPI-U adjustment), report the CURRENTLY EFFECTIVE annual fee and any active pauses.",
  'Return ONLY JSON: {"amountCents":10200,"fiscalYear":2026,"effectiveDate":"YYYY-MM-DD",',
  '"pauses":[{"id":"","label":"","affectsBranches":["B"],"reason":"","since":null,"until":null,"sourceUrl":""}],',
  '"sources":[{"title":"","url":"","publishedAt":"YYYY-MM-DD"}]}',
  "amountCents is the fee in integer cents (e.g. $102.00 = 10200). Do not invent values;",
  "cite official URLs. If no pauses are active, return an empty pauses array.",
].join(" ");

/**
 * Consulta Gemini grounded y construye el snapshot regulatorio vigente.
 * Lanza si Gemini falla o la respuesta no valida (el cron lo traduce a 502).
 */
export async function refreshRegulatory(now: string): Promise<RegulatorySnapshot> {
  const extracted = await geminiJson(PROMPT, RegulatoryExtractionSchema, {
    grounded: true,
    temperature: 0,
    model: GEMINI_FLASH,
  });
  return RegulatorySnapshotSchema.parse({
    amountCents: extracted.amountCents,
    fiscalYear: extracted.fiscalYear,
    effectiveDate: extracted.effectiveDate,
    pauses: extracted.pauses,
    lastCheckedAt: now,
    sources: dedupByUrl(extracted.sources),
  });
}
