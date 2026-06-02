import { z } from "zod";
import { daysBetweenUtc, parseUtcDate, toIsoDate, todayUtc, utcDate } from "@/lib/aaf/dates";

/**
 * Estima la fecha de presentación del I-589 a partir de señales del caso EOIR
 * (doc 13 §2.5). Permite calcular el AAF aunque el usuario no recuerde su filing
 * date exacta, exponiendo el **nivel de confianza** (UPL: nunca afirmar certeza).
 *
 * Tipo de entrada autónomo: la Fase 6 (EOIR `CaseInfoResponse`) lo poblará; aquí
 * NO se acopla a un schema que aún no existe (doc 09 §4 lo define después).
 */

export type FilingDateConfidence = "high" | "medium" | "low";

/** Subconjunto de señales del caso EOIR relevantes para la estimación. */
export const EoirCaseSignalsSchema = z.object({
  /** Estado del asylum clock: "R" (running) o "S" (stopped). */
  clockStatus: z.enum(["R", "S"]).optional(),
  /** Días acumulados del asylum clock. */
  elapsedDays: z.number().int().nonnegative().optional(),
  /** Fecha de registro en el docket (ISO date). */
  docketDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Fecha del Notice to Appear / OSC (ISO date). */
  oscDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export type EoirCaseSignals = z.infer<typeof EoirCaseSignalsSchema>;

export interface FilingDateEstimate {
  filingDate: string;
  confidence: FilingDateConfidence;
  /** Señal usada (trazabilidad para la UI). */
  basis: "asylum_clock" | "docket_date" | "osc_date";
}

/**
 * Estima la filing date desde las señales (prioridad doc 13 §2.5):
 *   clock + elapsedDays → alta · docketDate → media · oscDate → baja.
 * Devuelve `null` si no hay ninguna señal utilizable.
 *
 * El asylum clock aproxima la presentación restando los días transcurridos a la
 * fecha de referencia; es una ESTIMACIÓN (de ahí la confianza, nunca exacta).
 */
export function estimateFilingDate(
  signals: EoirCaseSignals,
  asOf: string = toIsoDate(todayUtc()),
): FilingDateEstimate | null {
  const reference = parseUtcDate(asOf);

  if (signals.clockStatus && signals.elapsedDays !== undefined) {
    const filing = utcDate(
      reference.getUTCFullYear(),
      reference.getUTCMonth(),
      reference.getUTCDate() - signals.elapsedDays,
    );
    return { filingDate: toIsoDate(filing), confidence: "high", basis: "asylum_clock" };
  }
  if (signals.docketDate) {
    return { filingDate: signals.docketDate, confidence: "medium", basis: "docket_date" };
  }
  if (signals.oscDate) {
    return { filingDate: signals.oscDate, confidence: "low", basis: "osc_date" };
  }
  return null;
}

/** Días transcurridos desde una filing date estimada (no negativo). */
export function daysSinceFiling(filingDate: string, asOf: string = toIsoDate(todayUtc())): number {
  return Math.max(0, daysBetweenUtc(parseUtcDate(filingDate), parseUtcDate(asOf)));
}
