import { describe, expect, it } from "vitest";
import { determineBranch, getFiscalYear, isLegacyFiling } from "@/lib/aaf/branches";
import { parseUtcDate } from "@/lib/aaf/dates";

const d = parseUtcDate;

describe("determineBranch (doc 13 §2.2)", () => {
  it("C cuando el foro es defensivo (corte EOIR), sin importar la fecha", () => {
    expect(determineBranch(d("2020-01-01"), "EOIR_defensive")).toBe("C");
    expect(determineBranch(d("2025-08-01"), "EOIR_defensive")).toBe("C");
  });
  it("D si presentada en/después del OBBBA (2025-07-04)", () => {
    expect(determineBranch(d("2025-07-04"), "USCIS_affirmative")).toBe("D");
    expect(determineBranch(d("2026-01-01"), "USCIS_affirmative")).toBe("D");
  });
  it("A si presentada en/después del FY2025 (2024-10-01) y antes del OBBBA", () => {
    expect(determineBranch(d("2024-10-01"), "USCIS_affirmative")).toBe("A");
    expect(determineBranch(d("2025-07-03"), "USCIS_affirmative")).toBe("A");
  });
  it("B (legacy) si presentada antes del FY2025", () => {
    expect(determineBranch(d("2024-09-30"), "USCIS_affirmative")).toBe("B");
    expect(determineBranch(d("2019-05-01"), "USCIS_affirmative")).toBe("B");
  });
});

describe("getFiscalYear — Oct-Dic cuentan para el año siguiente", () => {
  it("octubre→FY+1", () => expect(getFiscalYear(d("2025-10-01"))).toBe(2026));
  it("diciembre→FY+1", () => expect(getFiscalYear(d("2025-12-31"))).toBe(2026));
  it("septiembre→mismo FY", () => expect(getFiscalYear(d("2025-09-30"))).toBe(2025));
  it("enero→mismo FY", () => expect(getFiscalYear(d("2026-01-01"))).toBe(2026));
});

describe("isLegacyFiling", () => {
  it("true antes del FY2025", () => expect(isLegacyFiling(d("2024-09-30"))).toBe(true));
  it("false en/después del FY2025", () => expect(isLegacyFiling(d("2024-10-01"))).toBe(false));
});
