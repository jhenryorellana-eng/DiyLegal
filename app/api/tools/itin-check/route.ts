import { z } from "zod";
import { feedEnabled } from "@/lib/feeds/config";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";
import { evaluateItin, ITIN_RE } from "@/lib/tools/itin-check";
import { parseWith, searchParamsToObject } from "@/lib/validation/zod-helpers";

/**
 * GET /api/tools/itin-check?itin=&lastUsedYear= (doc 07 §4.5, doc 09 §11).
 * Lógica pura local; el ITIN (PII) no sale del servidor ni se loguea en claro.
 */
export const runtime = "nodejs";

const QuerySchema = z.object({
  itin: z
    .string()
    .regex(ITIN_RE, "El ITIN debe tener el formato 9XXXXXXXX (9 seguido de 8 dígitos)"),
  // SUPUESTO de rango (no fijado por el doc): el ITIN existe desde 1996.
  lastUsedYear: z.coerce.number().int().min(1996).max(2100).optional(),
});

export async function GET(request: Request): Promise<Response> {
  if (!feedEnabled("itin")) {
    return jsonErr("ConfigMissing", "La herramienta ITIN no está habilitada");
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseWith(QuerySchema, searchParamsToObject(searchParams));
  if (!parsed.success) {
    return jsonFrom(parsed.error);
  }

  // Lógica pura: no lanza y no hay backend externo → sin rama 502 aquí.
  return jsonOk(evaluateItin(parsed.data));
}
