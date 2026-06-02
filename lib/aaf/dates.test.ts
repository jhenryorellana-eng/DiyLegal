import { describe, expect, it } from "vitest";
import { addUtcYears, daysBetweenUtc, parseUtcDate, toIsoDate, utcDate } from "@/lib/aaf/dates";

describe("parseUtcDate", () => {
  it("parsea a medianoche UTC", () => {
    expect(parseUtcDate("2025-03-10").toISOString()).toBe("2025-03-10T00:00:00.000Z");
  });
  it("rechaza formato inválido", () => {
    expect(() => parseUtcDate("2025/03/10")).toThrow();
    expect(() => parseUtcDate("2025-3-10")).toThrow();
  });
  it("rechaza fecha inexistente", () => {
    expect(() => parseUtcDate("2025-02-30")).toThrow();
    expect(() => parseUtcDate("2025-13-01")).toThrow();
  });
});

describe("addUtcYears", () => {
  it("conserva mes/día", () => {
    expect(toIsoDate(addUtcYears(parseUtcDate("2025-03-10"), 1))).toBe("2026-03-10");
  });
  it("29-feb en año no bisiesto se normaliza a 1-mar (determinista)", () => {
    expect(toIsoDate(addUtcYears(parseUtcDate("2024-02-29"), 1))).toBe("2025-03-01");
  });
});

describe("daysBetweenUtc", () => {
  it("cuenta días enteros y signo", () => {
    expect(daysBetweenUtc(parseUtcDate("2025-01-01"), parseUtcDate("2025-01-31"))).toBe(30);
    expect(daysBetweenUtc(parseUtcDate("2025-02-01"), parseUtcDate("2025-01-01"))).toBe(-31);
  });
  it("año aniversario = 365 días (no bisiesto)", () => {
    expect(daysBetweenUtc(parseUtcDate("2025-03-10"), parseUtcDate("2026-03-10"))).toBe(365);
  });
});

describe("utcDate", () => {
  it("acepta día desbordado y normaliza", () => {
    expect(toIsoDate(utcDate(2025, 2, 0))).toBe("2025-02-28");
  });
});
