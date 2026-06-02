import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gemini/client", () => ({ geminiJson: vi.fn(), GEMINI_PRO: "gemini-2.5-pro" }));

import { geminiJson } from "@/lib/gemini/client";
import { clearResponseCache } from "@/lib/gemini/response-cache";
import { validateCalculation } from "@/lib/aaf/validate-calculation";
import { SAMPLE_RESULT } from "@/lib/aaf/__fixtures__/result";

afterEach(() => {
  clearResponseCache();
  vi.mocked(geminiJson).mockReset();
});

describe("validateCalculation", () => {
  it("devuelve el veredicto de Gemini cuando responde", async () => {
    vi.mocked(geminiJson).mockResolvedValue({
      valid: false,
      flags: ["REFERRED"],
      notes: "Case referred to EOIR.",
    });
    const v = await validateCalculation(SAMPLE_RESULT, { caseSummary: "referred" });
    expect(v.fromFallback).toBe(false);
    expect(v.flags).toContain("REFERRED");
    expect(v.valid).toBe(false);
  });

  it("fallback valid=true cuando Gemini falla (cálculo determinista manda)", async () => {
    vi.mocked(geminiJson).mockRejectedValue(new Error("no billing"));
    const v = await validateCalculation(SAMPLE_RESULT);
    expect(v).toEqual({ valid: true, flags: [], fromFallback: true });
  });
});
