import { describe, expect, it } from "vitest";
import { type AafCalculateInput, calculateAAF } from "@/lib/aaf/calculator";
import { type RegulatorySnapshot, SEED_REGULATORY } from "@/lib/aaf/regulatory";

const PAUSED_B: RegulatorySnapshot = {
  ...SEED_REGULATORY,
  pauses: [
    {
      id: "asap-v-uscis",
      label: "ASAP v. USCIS",
      affectsBranches: ["B"],
      reason: "Court order pausing collection",
      since: "2025-01-01",
      until: null,
    },
  ],
};

function calc(input: Partial<AafCalculateInput>) {
  return calculateAAF({
    filingDate: "2025-03-10",
    venue: "USCIS_affirmative",
    snapshot: SEED_REGULATORY,
    ...input,
  });
}

describe("calculateAAF — monto y rama (doc 13 §2.3/2.4)", () => {
  it("monto en centavos del snapshot + display USD", () => {
    const r = calc({ asOf: "2025-06-01" });
    expect(r.amountCents).toBe(10_200);
    expect(r.amountUsd).toBe("102.00");
    expect(r.legalCitations).toContain("8 U.S.C. § 1808");
  });
  it("fiscalYear sigue el FY federal del asOf", () => {
    expect(calc({ asOf: "2025-10-01" }).fiscalYear).toBe(2026);
    expect(calc({ asOf: "2025-09-30" }).fiscalYear).toBe(2025);
  });
  it("rama D para OBBBA, C para defensivo", () => {
    expect(calc({ filingDate: "2025-07-04", asOf: "2025-08-01" }).branch).toBe("D");
    expect(calc({ venue: "EOIR_defensive", asOf: "2025-08-01" }).branch).toBe("C");
  });
});

describe("calculateAAF — estados post-FY2025 (aniversario de presentación)", () => {
  // filing 2025-03-10 → primer vencimiento 2026-03-10.
  it("not_due lejos del aniversario", () => {
    const r = calc({ asOf: "2025-06-01" });
    expect(r.aafStatus).toBe("not_due");
    expect(r.nextDueDate).toBe("2026-03-10");
    expect(r.daysUntilDue).toBeGreaterThan(30);
  });
  it("due_soon dentro de los 30 días", () => {
    const r = calc({ asOf: "2026-02-20" });
    expect(r.aafStatus).toBe("due_soon");
    expect(r.daysUntilDue).toBe(18);
  });
  it("due_now el mismo día del vencimiento", () => {
    const r = calc({ asOf: "2026-03-10" });
    expect(r.aafStatus).toBe("due_now");
    expect(r.daysUntilDue).toBe(0);
  });
  it("overdue tras el aniversario sin pago", () => {
    const r = calc({ asOf: "2026-04-01" });
    expect(r.aafStatus).toBe("overdue");
    expect(r.nextDueDate).toBe("2026-03-10");
    expect(r.daysUntilDue).toBeLessThan(0);
    expect(r.caveats.es.some((c) => c.includes("vencido"))).toBe(true);
  });
  it("paid_current cuando el pago cubre el período vigente", () => {
    const r = calc({ asOf: "2026-04-01", lastPaidDate: "2026-03-15" });
    expect(r.aafStatus).toBe("paid_current");
    expect(r.nextDueDate).toBe("2027-03-10");
  });
});

describe("calculateAAF — legacy (rama B, vence 30-sep)", () => {
  it("not_due antes del 30-sep-2025", () => {
    const r = calc({ filingDate: "2020-01-01", asOf: "2025-06-01" });
    expect(r.branch).toBe("B");
    expect(r.nextDueDate).toBe("2025-09-30");
    expect(r.aafStatus).toBe("not_due");
  });
  it("overdue tras el 30-sep sin pago", () => {
    const r = calc({ filingDate: "2020-01-01", asOf: "2025-10-15" });
    expect(r.aafStatus).toBe("overdue");
    expect(r.nextDueDate).toBe("2025-09-30");
  });
  it("paid_current desplaza al 30-sep del año siguiente", () => {
    const r = calc({ filingDate: "2020-01-01", asOf: "2025-10-15", lastPaidDate: "2025-10-01" });
    expect(r.aafStatus).toBe("paid_current");
    expect(r.nextDueDate).toBe("2026-09-30");
  });
});

describe("calculateAAF — casos especiales", () => {
  it("case_closed cuando el caso está cerrado", () => {
    const r = calc({ caseStatus: "closed", asOf: "2026-04-01" });
    expect(r.aafStatus).toBe("case_closed");
    expect(r.nextDueDate).toBeNull();
    expect(r.daysUntilDue).toBeNull();
  });
  it("pausa regulatoria activa → not_due con pausa y caveat", () => {
    const r = calc({ filingDate: "2020-01-01", asOf: "2025-10-15", snapshot: PAUSED_B });
    expect(r.aafStatus).toBe("not_due");
    expect(r.pause?.id).toBe("asap-v-uscis");
    expect(r.nextDueDate).toBeNull();
    expect(r.caveats.en.some((c) => c.includes("court order"))).toBe(true);
  });
  it("la pausa de rama B no afecta a la rama A", () => {
    const r = calc({ asOf: "2026-04-01", snapshot: PAUSED_B });
    expect(r.pause).toBeNull();
    expect(r.aafStatus).toBe("overdue");
  });
  it("caveat de estimación cuando la confianza no es alta", () => {
    const r = calc({ asOf: "2025-06-01", filingDateConfidence: "medium" });
    expect(r.filingDateConfidence).toBe("medium");
    expect(r.caveats.es.some((c) => c.includes("estimación"))).toBe(true);
  });
  it("siempre incluye el caveat núcleo de no-asesoría", () => {
    expect(calc({ asOf: "2025-06-01" }).caveats.es[0]).toContain("no asesoría");
  });
});
