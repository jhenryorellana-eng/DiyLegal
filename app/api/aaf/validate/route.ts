import { aafEnabled } from "@/lib/aaf/config";
import { computeAaf } from "@/lib/aaf/compute";
import { AafValidateBodySchema } from "@/lib/aaf/request-schema";
import { validateCalculation } from "@/lib/aaf/validate-calculation";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";
import { parseBody } from "@/lib/validation/zod-helpers";

/**
 * POST /api/aaf/validate (doc 13 §3.5, §5). Validación OPCIONAL del cálculo con
 * Gemini (detecta REFERRED/CONSOLIDATED/Ms. L.). Flag `AAF_ENABLE_GEMINI`. El
 * cálculo determinista es la fuente de verdad; la IA sólo alerta (fallback valid).
 */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!aafEnabled("gemini")) {
    return jsonErr("ConfigMissing", "La validación con IA del AAF no está habilitada");
  }

  const parsed = await parseBody(AafValidateBodySchema, request);
  if (!parsed.success) return jsonFrom(parsed.error);

  try {
    const { result } = await computeAaf(parsed.data);
    const validation = await validateCalculation(result, { caseSummary: parsed.data.caseSummary });
    return jsonOk({ result, validation });
  } catch (error) {
    return jsonErr("Unknown", error instanceof Error ? error.message : "Validación AAF falló");
  }
}
