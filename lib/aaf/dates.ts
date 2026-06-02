/**
 * Utilidades de fecha **puras y en UTC** para el motor AAF determinista.
 * Toda fecha del dominio es medianoche UTC, así la aritmética de días es exacta
 * (sin DST ni zona horaria local). Convención: ISO `YYYY-MM-DD`.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Parsea `YYYY-MM-DD` a medianoche UTC. Lanza si el formato/fecha es inválido. */
export function parseUtcDate(iso: string): Date {
  if (!ISO_DATE_RE.test(iso)) {
    throw new Error(`Fecha inválida (se espera YYYY-MM-DD): ${iso}`);
  }
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  // Date.UTC normaliza desbordes (p. ej. mes 13); detectamos fechas imposibles.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new Error(`Fecha inexistente: ${iso}`);
  }
  return date;
}

/** Construye una fecha UTC a partir de año, mes (0-based) y día. */
export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Serializa una fecha a ISO `YYYY-MM-DD` (parte de fecha en UTC). */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Suma `n` años conservando mes/día en UTC. Si el día no existe en el año
 * destino (29-feb → año no bisiesto), JS lo normaliza a 1-mar (determinista).
 */
export function addUtcYears(date: Date, n: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + n, date.getUTCMonth(), date.getUTCDate()));
}

/** Días enteros desde `from` hasta `to` (negativo si `to` es anterior). */
export function daysBetweenUtc(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** Fecha de "hoy" truncada a medianoche UTC (única lectura de reloj del motor). */
export function todayUtc(): Date {
  const now = new Date();
  return utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}
