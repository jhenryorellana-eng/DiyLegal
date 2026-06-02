import { z } from "zod";
import { EoirCaptchaDetectedError } from "@/lib/eoir/court-intelligence/scrapers/http-client";
import { feedEnabled } from "@/lib/feeds/config";
import { getLegalAid } from "@/lib/legal/legal-aid";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";
import { parseWith, searchParamsToObject } from "@/lib/validation/zod-helpers";

/**
 * GET /api/legal/legal-aid?state=CA (doc 07 §4, doc 09 §12).
 * Directorio de ayuda legal gratuita/pro bono (immigrationlawhelp.org). Cache en
 * memoria 1h; ante fallo de la fuente sirve el último cache (stale) o 502.
 */
export const runtime = "nodejs";

const QuerySchema = z.object({
  state: z.string().regex(/^[A-Za-z]{2}$/, "Estado inválido (código de 2 letras, ej. CA)"),
});

export async function GET(request: Request): Promise<Response> {
  if (!feedEnabled("legalAid")) {
    return jsonErr("ConfigMissing", "El directorio de ayuda legal no está habilitado");
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseWith(QuerySchema, searchParamsToObject(searchParams));
  if (!parsed.success) return jsonFrom(parsed.error);

  try {
    const { result, stale } = await getLegalAid(parsed.data.state);
    return jsonOk(stale ? { ...result, stale: true } : result);
  } catch (error) {
    if (error instanceof EoirCaptchaDetectedError) {
      return jsonErr("BackendUnavailable", "La fuente está protegida por un desafío anti-bot");
    }
    return jsonErr("BackendUnavailable", "No se pudo obtener el directorio de ayuda legal");
  }
}
