import { z } from "zod";
import { feedEnabled } from "@/lib/feeds/config";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";
import { evaluateSelectiveService, SS_STATUSES } from "@/lib/tools/selective-service";
import { parseWith, searchParamsToObject } from "@/lib/validation/zod-helpers";

/**
 * GET /api/tools/selective-service?birthYear=&status=&male=&registered=&presentUS=
 * (doc 07 §4.5, doc 09 §11). Lógica pura; NO se pide ni acepta SSN (doc 10).
 */
export const runtime = "nodejs";

/** Booleano de query: "true"/"1" → true; "false"/"0" → false (evita el coerce.boolean engañoso). */
const QueryBool = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");

const QuerySchema = z.object({
  birthYear: z.coerce.number().int().min(1900).max(2100),
  status: z.enum(SS_STATUSES),
  male: QueryBool,
  registered: QueryBool,
  presentUS: QueryBool,
});

export async function GET(request: Request): Promise<Response> {
  if (!feedEnabled("selectiveService")) {
    return jsonErr("ConfigMissing", "La herramienta del Servicio Selectivo no está habilitada");
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseWith(QuerySchema, searchParamsToObject(searchParams));
  if (!parsed.success) {
    return jsonFrom(parsed.error);
  }

  return jsonOk(evaluateSelectiveService(parsed.data));
}
