import { aafEnabled } from "@/lib/aaf/config";
import { computeAaf } from "@/lib/aaf/compute";
import { draftMotion } from "@/lib/aaf/draft-motion";
import { AafMotionBodySchema } from "@/lib/aaf/request-schema";
import { generateMotionPdf } from "@/lib/pdf/motion";
import { pdfResponse } from "@/lib/pdf/response";
import { jsonErr, jsonFrom } from "@/lib/http/response";
import { parseBody } from "@/lib/validation/zod-helpers";

/**
 * POST /api/aaf/generate-motion (doc 13 §3.1, §5). Pipeline: cálculo → draft
 * (Gemini Pro + fallback template) → PDF. Flag `AAF_ENABLE_MOTION`. Metadata en
 * headers (`x-aaf-from-fallback` indica si Gemini no estuvo disponible).
 */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!aafEnabled("motion")) {
    return jsonErr("ConfigMissing", "La generación de mociones AAF no está habilitada");
  }

  const parsed = await parseBody(AafMotionBodySchema, request);
  if (!parsed.success) return jsonFrom(parsed.error);

  try {
    const { result } = await computeAaf(parsed.data);
    const draft = await draftMotion({
      applicantName: parsed.data.applicantName,
      aNumber: parsed.data.aNumber,
      courtName: parsed.data.courtName,
      judgeName: parsed.data.judgeName,
      filingDate: parsed.data.filingDate,
      proSe: parsed.data.proSe,
      result,
    });
    const pdf = await generateMotionPdf(draft, { proSe: parsed.data.proSe });
    return pdfResponse(pdf, "aaf-notice-of-compliance-DRAFT.pdf", {
      "x-aaf-from-fallback": String(draft.fromFallback),
      "x-aaf-pro-se": String(parsed.data.proSe),
    });
  } catch (error) {
    return jsonErr("Unknown", error instanceof Error ? error.message : "Moción AAF falló");
  }
}
