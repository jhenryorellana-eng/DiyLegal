import {
  type AafBranch,
  type AafVenue,
  determineBranch,
  getFiscalYear,
  isLegacyFiling,
} from "@/lib/aaf/branches";
import { AAF_LEGAL_CITATIONS, DUE_SOON_DAYS, FY2025_END } from "@/lib/aaf/constants";
import { addUtcYears, daysBetweenUtc, parseUtcDate, toIsoDate, todayUtc } from "@/lib/aaf/dates";
import type { FilingDateConfidence } from "@/lib/aaf/estimate-filing-date";
import { formatUsd, getActiveAmountCents, getActivePause } from "@/lib/aaf/fee-amount";
import type { Pause, RegulatorySnapshot } from "@/lib/aaf/regulatory";

/**
 * Motor de cálculo del AAF (doc 13 §2.3). 100% determinista: mismas entradas →
 * mismo resultado, sin IA. Toda la aritmética de fechas es UTC.
 *
 * Reglas de vencimiento (verificadas contra Federal Register / 8 U.S.C. §1808):
 *  - Legacy (presentada < FY2025): vence el 30-sep de cada año pendiente.
 *  - Post-FY2025 (A/D): vence en el aniversario de la presentación (primer
 *    vencimiento a los 365 días). Rama C sigue la misma regla temporal.
 */

export type AafStatus =
  | "not_due"
  | "due_soon"
  | "due_now"
  | "overdue"
  | "paid_current"
  | "case_closed";

export interface AafCalculateInput {
  /** Fecha de presentación del I-589 (ISO `YYYY-MM-DD`). */
  filingDate: string;
  venue: AafVenue;
  /** Confianza si la `filingDate` fue estimada (doc 13 §2.5). */
  filingDateConfidence?: FilingDateConfidence;
  /** Fecha del último pago AAF registrado por el usuario (ISO). */
  lastPaidDate?: string;
  caseStatus?: "pending" | "closed";
  /** Fecha de referencia (ISO); por defecto hoy (UTC). */
  asOf?: string;
  /** Snapshot regulatorio cargado por el caller (monto/pausas vigentes). */
  snapshot: RegulatorySnapshot;
}

export interface AafResult {
  branch: AafBranch;
  fiscalYear: number;
  amountCents: number;
  amountUsd: string;
  aafStatus: AafStatus;
  nextDueDate: string | null;
  daysUntilDue: number | null;
  legalCitations: string[];
  pause: Pause | null;
  filingDateConfidence: FilingDateConfidence | null;
  caveats: { es: string[]; en: string[] };
}

/** Primer vencimiento anual del caso (legacy → 30-sep-2025; post → +1 año). */
function firstDueDate(filing: Date): Date {
  return isLegacyFiling(filing) ? parseUtcDate(FY2025_END) : addUtcYears(filing, 1);
}

/** Vencimiento anterior (≤ asOf) y siguiente (> asOf) en la serie anual. */
function dueSchedule(firstDue: Date, asOf: Date): { prevDue: Date | null; nextDue: Date } {
  let prevDue: Date | null = null;
  let due = firstDue;
  for (let guard = 0; due.getTime() <= asOf.getTime() && guard < 200; guard++) {
    prevDue = due;
    due = addUtcYears(due, 1);
  }
  return { prevDue, nextDue: due };
}

/** Vencimiento relevante para el usuario y si el período vigente está pagado. */
function resolveDue(
  filing: Date,
  asOf: Date,
  lastPaidDate: string | undefined,
): { relevantDue: Date; paid: boolean } {
  const firstDue = firstDueDate(filing);
  const { prevDue, nextDue } = dueSchedule(firstDue, asOf);
  const paidThrough = lastPaidDate ? parseUtcDate(lastPaidDate) : null;
  const periodDue = prevDue ?? firstDue;
  const paid = paidThrough !== null && paidThrough.getTime() >= periodDue.getTime();
  if (prevDue === null) return { relevantDue: paid ? nextDue : firstDue, paid };
  return { relevantDue: paid ? nextDue : prevDue, paid };
}

function classifyStatus(daysUntilDue: number, paid: boolean): AafStatus {
  if (paid) return "paid_current";
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue === 0) return "due_now";
  if (daysUntilDue <= DUE_SOON_DAYS) return "due_soon";
  return "not_due";
}

/** Avisos bilingües (UPL doc 10 §2): informa, nunca asesora; remite a la fuente. */
function buildCaveats(
  status: AafStatus,
  pause: Pause | null,
  confidence: FilingDateConfidence | null,
): { es: string[]; en: string[] } {
  const es = [CAVEAT_CORE.es];
  const en = [CAVEAT_CORE.en];
  const add = (pair: { es: string; en: string }) => {
    es.push(pair.es);
    en.push(pair.en);
  };
  if (status === "overdue") add(CAVEAT_OVERDUE);
  if (status === "case_closed") add(CAVEAT_CLOSED);
  if (pause) {
    es.push(`Cobro suspendido por orden judicial: ${pause.label}.`);
    en.push(`Collection paused by court order: ${pause.label}.`);
  }
  if (confidence && confidence !== "high") add(CAVEAT_ESTIMATED);
  return { es, en };
}

const CAVEAT_CORE = {
  es: "Cálculo informativo, no asesoría legal. USCIS envía un aviso personal con el monto y la fecha exactos; confirma con la fuente oficial antes de pagar.",
  en: "Informational estimate, not legal advice. USCIS issues a personal notice with the exact amount and due date; confirm with the official source before paying.",
};
const CAVEAT_OVERDUE = {
  es: "El pago figura como vencido; el impago puede afectar tu caso de asilo.",
  en: "The payment appears overdue; non-payment may affect your asylum case.",
};
const CAVEAT_CLOSED = {
  es: "El caso figura como cerrado; la cuota anual deja de acumularse.",
  en: "The case appears closed; the annual fee no longer accrues.",
};
const CAVEAT_ESTIMATED = {
  es: "La fecha de presentación es una estimación; verifica tu fecha real.",
  en: "The filing date is an estimate; verify your actual date.",
};

/** Calcula rama, monto, vencimiento, estado y avisos del AAF (determinista). */
export function calculateAAF(input: AafCalculateInput): AafResult {
  const filing = parseUtcDate(input.filingDate);
  const asOf = input.asOf ? parseUtcDate(input.asOf) : todayUtc();
  const branch = determineBranch(filing, input.venue);
  const amountCents = getActiveAmountCents(input.snapshot);
  const confidence = input.filingDateConfidence ?? null;
  const base = {
    branch,
    fiscalYear: getFiscalYear(asOf),
    amountCents,
    amountUsd: formatUsd(amountCents),
    legalCitations: [...AAF_LEGAL_CITATIONS],
    filingDateConfidence: confidence,
  };

  if (input.caseStatus === "closed") {
    return {
      ...base,
      aafStatus: "case_closed",
      nextDueDate: null,
      daysUntilDue: null,
      pause: null,
      caveats: buildCaveats("case_closed", null, confidence),
    };
  }

  const pause = getActivePause(branch, input.snapshot, asOf);
  if (pause) {
    return {
      ...base,
      aafStatus: "not_due",
      nextDueDate: null,
      daysUntilDue: null,
      pause,
      caveats: buildCaveats("not_due", pause, confidence),
    };
  }

  const { relevantDue, paid } = resolveDue(filing, asOf, input.lastPaidDate);
  const daysUntilDue = daysBetweenUtc(asOf, relevantDue);
  const aafStatus = classifyStatus(daysUntilDue, paid);
  return {
    ...base,
    aafStatus,
    nextDueDate: toIsoDate(relevantDue),
    daysUntilDue,
    pause: null,
    caveats: buildCaveats(aafStatus, null, confidence),
  };
}
