import { type AafResult, calculateAAF } from "@/lib/aaf/calculator";
import { loadRegulatory } from "@/lib/aaf/regulatory";
import type { AafCalculateBody } from "@/lib/aaf/request-schema";

/**
 * Carga el snapshot regulatorio vigente y calcula el AAF. Punto único usado por
 * los endpoints `calculate`, `generate-receipt`, `generate-motion` y `validate`
 * (DRY: el snapshot SIEMPRE se carga server-side, nunca llega del cliente).
 */
export async function computeAaf(input: AafCalculateBody): Promise<{
  result: AafResult;
  fromCache: boolean;
  fetchedAt: string | null;
}> {
  const { snapshot, fromCache, fetchedAt } = await loadRegulatory();
  return { result: calculateAAF({ ...input, snapshot }), fromCache, fetchedAt };
}
