import { z } from "zod";
import { loadCache, saveCache } from "@/lib/feeds/cache";
import { feedEnabled } from "@/lib/feeds/config";
import { FEE_SCHEDULE_CACHE, buildFeeResult, fetchFeeScheduleText } from "@/lib/feeds/fee-schedule";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";
import { parseWith, searchParamsToObject } from "@/lib/validation/zod-helpers";

/**
 * GET /api/feeds/fees?form= (doc 07 §4.5, doc 09 §9).
 * Cache-first del texto del G-1055; devuelve las feeLines literales del formulario.
 */
export const runtime = "nodejs";

const QuerySchema = z.object({
  form: z.string().regex(/^[A-Za-z]-?\d{1,4}[A-Za-z]?$/, "Formulario inválido (ej. N-400, I-130)"),
});

export async function GET(request: Request): Promise<Response> {
  if (!feedEnabled("feeSchedule")) {
    return jsonErr("ConfigMissing", "El tarifario (G-1055) no está habilitado");
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseWith(QuerySchema, searchParamsToObject(searchParams));
  if (!parsed.success) return jsonFrom(parsed.error);
  const { form } = parsed.data;

  const cached = await loadCache<string>(FEE_SCHEDULE_CACHE);
  let pdfText: string;
  if (cached) {
    pdfText = cached.data;
  } else {
    try {
      pdfText = await fetchFeeScheduleText();
      await saveCache(FEE_SCHEDULE_CACHE, pdfText);
    } catch {
      return jsonErr("BackendUnavailable", "No se pudo obtener el tarifario oficial");
    }
  }

  return jsonOk(buildFeeResult(pdfText, form));
}
