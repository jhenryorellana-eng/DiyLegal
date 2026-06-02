import { computeAaf } from "@/lib/aaf/compute";
import { AafCalculateBodySchema } from "@/lib/aaf/request-schema";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";
import { parseBody } from "@/lib/validation/zod-helpers";

/**
 * POST /api/aaf/calculate (doc 13 §5, doc 07 §4.4).
 * Cálculo determinista del AAF (rama, monto, vencimiento, estado). Funcionalidad
 * CORE: sin flag (siempre disponible). El snapshot regulatorio se carga server-side.
 */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const parsed = await parseBody(AafCalculateBodySchema, request);
  if (!parsed.success) return jsonFrom(parsed.error);

  try {
    const { result, fromCache, fetchedAt } = await computeAaf(parsed.data);
    return jsonOk({ ...result, regulatory: { fromCache, fetchedAt } });
  } catch (error) {
    return jsonErr("Unknown", error instanceof Error ? error.message : "Cálculo AAF falló");
  }
}
