import { z } from "zod";

/**
 * Schema del cuerpo de petición compartido por los endpoints AAF que parten de un
 * caso (`calculate`, `generate-motion`, `generate-receipt`). El `snapshot`
 * regulatorio NUNCA viene del cliente: lo carga el servidor (`loadRegulatory`).
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const AafCalculateBodySchema = z.object({
  filingDate: z.string().regex(ISO_DATE, "Formato esperado YYYY-MM-DD"),
  venue: z.enum(["USCIS_affirmative", "EOIR_defensive"]),
  filingDateConfidence: z.enum(["high", "medium", "low"]).optional(),
  lastPaidDate: z.string().regex(ISO_DATE, "Formato esperado YYYY-MM-DD").optional(),
  caseStatus: z.enum(["pending", "closed"]).optional(),
  asOf: z.string().regex(ISO_DATE, "Formato esperado YYYY-MM-DD").optional(),
});

export type AafCalculateBody = z.infer<typeof AafCalculateBodySchema>;
