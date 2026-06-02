import { computeAaf } from "@/lib/aaf/compute";
import { toIsoDate, todayUtc } from "@/lib/aaf/dates";
import { AafReceiptBodySchema } from "@/lib/aaf/request-schema";
import { generateReceiptPdf } from "@/lib/pdf/receipt";
import { pdfResponse } from "@/lib/pdf/response";
import { jsonErr, jsonFrom } from "@/lib/http/response";
import { parseBody } from "@/lib/validation/zod-helpers";

/**
 * POST /api/aaf/generate-receipt (doc 13 §3.2, §5). PDF "AAF Status Report".
 * CORE (sin flag); el PDF lleva el disclaimer UPL embebido.
 */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const parsed = await parseBody(AafReceiptBodySchema, request);
  if (!parsed.success) return jsonFrom(parsed.error);

  try {
    const { result } = await computeAaf(parsed.data);
    const generatedAt = toIsoDate(todayUtc());
    const pdf = await generateReceiptPdf(result, {
      applicantName: parsed.data.applicantName,
      generatedAt,
    });
    return pdfResponse(pdf, "aaf-status-report.pdf", {
      "x-aaf-status": result.aafStatus,
      "x-aaf-branch": result.branch,
    });
  } catch (error) {
    return jsonErr("Unknown", error instanceof Error ? error.message : "Recibo AAF falló");
  }
}
