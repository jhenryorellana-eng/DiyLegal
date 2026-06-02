import { z } from "zod";
import { AAF_AMOUNT_CENTS_FY2026 } from "@/lib/aaf/config";
import { FY2026_START } from "@/lib/aaf/constants";
import { loadCache } from "@/lib/feeds/cache";

/**
 * Estado regulatorio vigente del AAF (doc 13 §2.4, §3.3).
 * Lo mantiene al día el cron `regulatory-check` (Gemini grounded) en
 * `regulatory-cache.json`. El motor lo consume como dato (no lo obtiene él mismo)
 * para seguir siendo puro/determinista.
 */

export const AAF_BRANCHES = ["A", "B", "C", "D"] as const;

/** Pausa regulatoria (court order) que suspende el cobro a ciertas ramas. */
export const PauseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Ramas afectadas; p. ej. ASAP v. USCIS pausa la rama B (doc 13 §2.4). */
  affectsBranches: z.array(z.enum(AAF_BRANCHES)).min(1),
  reason: z.string().min(1),
  /** Vigencia (ISO date). `null` = abierto por ese extremo. */
  since: z.string().nullable(),
  until: z.string().nullable(),
  sourceUrl: z.string().url().optional(),
});
export type Pause = z.infer<typeof PauseSchema>;

export const SourceRefSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  publishedAt: z.string().optional(),
});

export const RegulatorySnapshotSchema = z.object({
  /** Monto vigente en CENTAVOS (doc: dinero siempre entero). */
  amountCents: z.number().int().positive(),
  fiscalYear: z.number().int(),
  /** Fecha de entrada en vigor del monto/regla (ISO date). */
  effectiveDate: z.string(),
  pauses: z.array(PauseSchema),
  /** ISO datetime de la última verificación del cron; `null` si sólo semilla. */
  lastCheckedAt: z.string().nullable(),
  sources: z.array(SourceRefSchema),
});
export type RegulatorySnapshot = z.infer<typeof RegulatorySnapshotSchema>;

export const REGULATORY_CACHE_NAME = "regulatory-cache";

/**
 * Semilla de arranque en frío (doc 13: FY2026 = $102.00 = 10200¢). NO es verdad
 * permanente: el cron la sobrescribe con el valor oficial del Federal Register.
 */
export const SEED_REGULATORY: RegulatorySnapshot = {
  amountCents: AAF_AMOUNT_CENTS_FY2026,
  fiscalYear: 2026,
  effectiveDate: FY2026_START,
  pauses: [],
  lastCheckedAt: null,
  sources: [
    {
      title: "USCIS Immigration Fees and Related Procedures Required by H.R.1",
      url: "https://www.federalregister.gov/documents/2026/04/29/2026-08333/uscis-immigration-fees-and-related-procedures-required-by-hr1-reconciliation-bill",
    },
  ],
};

export interface RegulatoryLoad {
  snapshot: RegulatorySnapshot;
  fromCache: boolean;
  fetchedAt: string | null;
}

/**
 * Carga el snapshot regulatorio vigente: cache-first, con fallback a la semilla.
 * Si el cache existe pero es inválido (schema), también cae a la semilla
 * (no rompe el cálculo; el monto se degrada al último conocido del doc).
 */
export async function loadRegulatory(): Promise<RegulatoryLoad> {
  const cached = await loadCache<RegulatorySnapshot>(REGULATORY_CACHE_NAME);
  if (cached) {
    const parsed = RegulatorySnapshotSchema.safeParse(cached.data);
    if (parsed.success) {
      return { snapshot: parsed.data, fromCache: true, fetchedAt: cached.fetchedAt };
    }
  }
  return { snapshot: SEED_REGULATORY, fromCache: false, fetchedAt: null };
}
