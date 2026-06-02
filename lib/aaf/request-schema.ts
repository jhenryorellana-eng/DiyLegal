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

/** `generate-receipt`: cálculo + nombre opcional del solicitante para el PDF. */
export const AafReceiptBodySchema = AafCalculateBodySchema.extend({
  applicantName: z.string().min(1).optional(),
});
export type AafReceiptBody = z.infer<typeof AafReceiptBodySchema>;

/** `generate-motion`: cálculo + datos del caso para redactar la moción. */
export const AafMotionBodySchema = AafCalculateBodySchema.extend({
  applicantName: z.string().min(1),
  aNumber: z.string().min(1).optional(),
  courtName: z.string().min(1).optional(),
  judgeName: z.string().min(1).optional(),
  /** Sin abogado → marca de agua DRAFT (doc 13 §3.1). Por defecto pro se. */
  proSe: z.boolean().default(true),
});
export type AafMotionBody = z.infer<typeof AafMotionBodySchema>;

/** `validate`: cálculo + resumen libre del caso para detectar casos especiales. */
export const AafValidateBodySchema = AafCalculateBodySchema.extend({
  caseSummary: z.string().min(1).optional(),
});
export type AafValidateBody = z.infer<typeof AafValidateBodySchema>;
