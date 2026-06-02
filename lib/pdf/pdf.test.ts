import { describe, expect, it } from "vitest";
import { buildTemplateMotion } from "@/lib/aaf/draft-motion";
import { generateMotionPdf } from "@/lib/pdf/motion";
import { generateReceiptPdf } from "@/lib/pdf/receipt";
import { SAMPLE_RESULT } from "@/lib/aaf/__fixtures__/result";

function isPdf(bytes: Uint8Array): boolean {
  return new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
}

describe("generateReceiptPdf", () => {
  it("produce un PDF válido con el resultado", async () => {
    const pdf = await generateReceiptPdf(SAMPLE_RESULT, {
      applicantName: "Jane Doe",
      generatedAt: "2026-06-02",
    });
    expect(isPdf(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(500);
  });
});

describe("generateMotionPdf", () => {
  const draft = buildTemplateMotion({
    applicantName: "Jane Doe",
    filingDate: "2025-03-10",
    proSe: true,
    result: SAMPLE_RESULT,
  });

  it("produce un PDF válido (pro se → con marca de agua)", async () => {
    const pdf = await generateMotionPdf(draft, { proSe: true });
    expect(isPdf(pdf)).toBe(true);
  });

  it("produce un PDF válido sin marca de agua si hay abogado", async () => {
    const pdf = await generateMotionPdf(draft, { proSe: false });
    expect(isPdf(pdf)).toBe(true);
  });
});
