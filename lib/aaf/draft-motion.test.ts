import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gemini/client", () => ({ geminiJson: vi.fn(), GEMINI_PRO: "gemini-2.5-pro" }));

import { buildTemplateMotion, draftMotion, type MotionInput } from "@/lib/aaf/draft-motion";
import { geminiJson } from "@/lib/gemini/client";
import { clearResponseCache } from "@/lib/gemini/response-cache";
import { SAMPLE_RESULT } from "@/lib/aaf/__fixtures__/result";

function input(over: Partial<MotionInput> = {}): MotionInput {
  return {
    applicantName: "Jane Doe",
    filingDate: "2025-03-10",
    proSe: true,
    result: SAMPLE_RESULT,
    ...over,
  };
}

afterEach(() => {
  clearResponseCache();
  vi.mocked(geminiJson).mockReset();
});

describe("buildTemplateMotion (fallback determinista)", () => {
  it("arma todas las secciones y cita 8 U.S.C. § 1808", () => {
    const m = buildTemplateMotion(input({ aNumber: "A123456789" }));
    expect(m.fromFallback).toBe(true);
    expect(m.caption).toContain("NOTICE OF COMPLIANCE");
    expect(m.caption).toContain("A123456789");
    expect(m.bodyParagraphs.join(" ")).toContain("8 U.S.C. § 1808");
    expect(m.certificateOfService).toContain("CERTIFICATE OF SERVICE");
    expect(m.fullText).toContain("Jane Doe");
  });
  it("marca Pro Se en la firma", () => {
    expect(buildTemplateMotion(input({ proSe: true })).signatureBlock).toContain("(Pro Se)");
  });
});

describe("draftMotion", () => {
  it("usa Gemini cuando responde (fromFallback=false)", async () => {
    vi.mocked(geminiJson).mockResolvedValue({
      caption: "CAPTION",
      bodyParagraphs: ["Body."],
      prayer: "WHEREFORE.",
      signatureBlock: "Signed.",
      certificateOfService: "Served.",
    });
    const m = await draftMotion(input());
    expect(m.fromFallback).toBe(false);
    expect(m.fullText).toContain("CAPTION");
  });

  it("cae al template si Gemini falla (resiliencia / sin billing Pro)", async () => {
    vi.mocked(geminiJson).mockRejectedValue(new Error("Gemini HTTP 429"));
    const m = await draftMotion(input({ applicantName: "Sin Gemini" }));
    expect(m.fromFallback).toBe(true);
    expect(m.fullText).toContain("Sin Gemini");
  });
});
