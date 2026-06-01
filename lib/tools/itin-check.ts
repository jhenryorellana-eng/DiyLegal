/**
 * Detector de expiración de ITIN (doc 09 §11, doc 02 §RF-ITIN).
 *
 * Regla IRS: un ITIN no usado en una declaración federal durante 3 años
 * consecutivos expira el 31 de diciembre del 3.er año. Todo el cálculo es
 * LOCAL: el ITIN nunca se envía a terceros ni se loguea en claro (solo
 * enmascarado) — es PII sensible (doc 10, RNF-OPS-09).
 *
 * SUPUESTOS declarados (el doc NO los fija; no se alucinan):
 *  - EXPIRING_WINDOW_MONTHS = 3: ventana de aviso previa al vencimiento.
 *  - Nombres de los campos de salida (status/maskedItin/expiresOn).
 *  - Fechas calculadas en UTC (regla de sistema: fechas en UTC).
 */

/** Formato oficial del ITIN: 9 seguido de 8 dígitos (doc 09 §11). */
export const ITIN_RE = /^9\d{8}$/;

/** Años consecutivos sin uso tras los que el ITIN expira (regla IRS). */
const ITIN_DORMANCY_YEARS = 3;

/** SUPUESTO (no fijado por el doc): meses de aviso antes del vencimiento. */
const EXPIRING_WINDOW_MONTHS = 3;

export type ItinStatus = "active" | "expiring" | "expired" | "unknown";

export interface ItinCheckResult {
  status: ItinStatus;
  /** ITIN enmascarado: muestra solo el 9 inicial y los últimos 4 dígitos. */
  maskedItin: string;
  /** Fecha de vencimiento (YYYY-MM-DD, UTC) o null si no se conoce el último uso. */
  expiresOn: string | null;
}

/**
 * Enmascara el ITIN como `9XX-XX-####` (solo el 9 inicial y los últimos 4).
 * NUNCA expone los dígitos centrales. Asume un ITIN ya validado en el borde.
 */
export function maskItin(itin: string): string {
  return `9XX-XX-${itin.slice(-4)}`;
}

/**
 * Evalúa el estado del ITIN según la regla de 3 años.
 * `now` se inyecta para tests deterministas (por defecto, ahora en UTC).
 */
export function evaluateItin(
  input: { itin: string; lastUsedYear?: number },
  now: Date = new Date(),
): ItinCheckResult {
  const maskedItin = maskItin(input.itin);

  if (input.lastUsedYear === undefined) {
    return { status: "unknown", maskedItin, expiresOn: null };
  }

  const expiryYear = input.lastUsedYear + ITIN_DORMANCY_YEARS;
  // Vence al final del 31-dic del año de expiración (UTC).
  const expiry = new Date(Date.UTC(expiryYear, 11, 31, 23, 59, 59, 999));
  // Ventana de aviso: primeros días de los últimos EXPIRING_WINDOW_MONTHS meses.
  const warningStart = new Date(Date.UTC(expiryYear, 12 - EXPIRING_WINDOW_MONTHS, 1));
  const expiresOn = expiry.toISOString().slice(0, 10);

  let status: ItinStatus;
  if (now.getTime() > expiry.getTime()) {
    status = "expired";
  } else if (now.getTime() >= warningStart.getTime()) {
    status = "expiring";
  } else {
    status = "active";
  }

  return { status, maskedItin, expiresOn };
}
