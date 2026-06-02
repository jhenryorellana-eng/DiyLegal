import { describe, expect, it } from "vitest";
import { daysSinceFiling, estimateFilingDate } from "@/lib/aaf/estimate-filing-date";

describe("estimateFilingDate (doc 13 §2.5)", () => {
  it("asylum clock + elapsedDays → confianza alta (asOf - días)", () => {
    const r = estimateFilingDate({ clockStatus: "R", elapsedDays: 100 }, "2025-06-01");
    expect(r).toEqual({ filingDate: "2025-02-21", confidence: "high", basis: "asylum_clock" });
  });
  it("clock parado también cuenta como alta (doc fija ClockStatus+ElapsedDays)", () => {
    const r = estimateFilingDate({ clockStatus: "S", elapsedDays: 0 }, "2025-06-01");
    expect(r?.confidence).toBe("high");
    expect(r?.filingDate).toBe("2025-06-01");
  });
  it("docketDate → confianza media", () => {
    const r = estimateFilingDate({ docketDate: "2024-01-15" }, "2025-06-01");
    expect(r).toEqual({ filingDate: "2024-01-15", confidence: "medium", basis: "docket_date" });
  });
  it("oscDate → confianza baja", () => {
    const r = estimateFilingDate({ oscDate: "2023-08-09" }, "2025-06-01");
    expect(r).toEqual({ filingDate: "2023-08-09", confidence: "low", basis: "osc_date" });
  });
  it("prioridad: clock gana a docket y osc", () => {
    const r = estimateFilingDate(
      { clockStatus: "R", elapsedDays: 10, docketDate: "2024-01-15", oscDate: "2023-08-09" },
      "2025-06-01",
    );
    expect(r?.basis).toBe("asylum_clock");
  });
  it("sin señales → null", () => {
    expect(estimateFilingDate({}, "2025-06-01")).toBeNull();
  });
});

describe("daysSinceFiling", () => {
  it("cuenta días no negativos", () => {
    expect(daysSinceFiling("2025-01-01", "2025-01-31")).toBe(30);
  });
  it("nunca negativo si asOf < filing", () => {
    expect(daysSinceFiling("2025-06-01", "2025-01-01")).toBe(0);
  });
});
