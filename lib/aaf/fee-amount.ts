import type { AafBranch } from "@/lib/aaf/branches";
import { parseUtcDate } from "@/lib/aaf/dates";
import type { Pause, RegulatorySnapshot } from "@/lib/aaf/regulatory";

/**
 * Monto vigente y pausas activas del AAF (doc 13 §2.4). Lee del snapshot
 * regulatorio (no obtiene datos por sí mismo → puro/determinista).
 * El dinero SIEMPRE en centavos (doc 10/convenciones).
 */

/** Monto vigente en centavos. */
export function getActiveAmountCents(snapshot: RegulatorySnapshot): number {
  return snapshot.amountCents;
}

/** Convierte centavos a string USD para display (la UI/PDF lo usa; no es autoritativo). */
export function formatUsd(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

/**
 * Primera pausa regulatoria activa para la rama en la fecha `asOf` (o `null`).
 * Una pausa aplica si afecta la rama y `asOf` cae en [since, until] (extremos
 * `null` = abiertos). Ej.: court order *ASAP v. USCIS* pausa la rama B.
 */
export function getActivePause(
  branch: AafBranch,
  snapshot: RegulatorySnapshot,
  asOf: Date,
): Pause | null {
  for (const pause of snapshot.pauses) {
    if (!pause.affectsBranches.includes(branch)) continue;
    if (pause.since !== null && asOf.getTime() < parseUtcDate(pause.since).getTime()) continue;
    if (pause.until !== null && asOf.getTime() > parseUtcDate(pause.until).getTime()) continue;
    return pause;
  }
  return null;
}
