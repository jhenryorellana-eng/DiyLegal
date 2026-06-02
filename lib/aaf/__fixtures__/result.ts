import type { AafResult } from "@/lib/aaf/calculator";

/** Resultado AAF de ejemplo para tests de documentos/validación. */
export const SAMPLE_RESULT: AafResult = {
  branch: "A",
  fiscalYear: 2026,
  amountCents: 10_200,
  amountUsd: "102.00",
  aafStatus: "overdue",
  nextDueDate: "2026-03-10",
  daysUntilDue: -22,
  legalCitations: ["8 U.S.C. § 1808", "Pub. L. 119-21 (One Big Beautiful Bill Act)"],
  pause: null,
  filingDateConfidence: null,
  caveats: { es: ["Cálculo informativo, no asesoría legal."], en: ["Informational estimate."] },
};
