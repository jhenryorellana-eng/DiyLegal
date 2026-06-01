import { z } from "zod";
import { loadCache } from "@/lib/feeds/cache";
import { feedEnabled } from "@/lib/feeds/config";
import {
  PROCESSING_TIMES_CACHE,
  ProcessingTimesDataSchema,
  lookupProcessingTime,
} from "@/lib/feeds/processing-times";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";
import { parseWith, searchParamsToObject } from "@/lib/validation/zod-helpers";

/**
 * GET /api/feeds/processing-times?form=I-130&office=NBC (doc 07 §4, doc 09 §7).
 *
 * Cache-ONLY: el endpoint NO descarga ni lee el SQLite (eso lo hace el cron en
 * `sync.ts`). Sirve el JSON volcado; si aún no se sincronizó → 502. Así el path
 * de lectura es portable (no arrastra `node:sqlite`).
 */
export const runtime = "nodejs";

// El sufijo cubre los `form_name` REALES del mirror (verificados contra la
// fuente): I-130, N-400, I-821D, pero también I-129CW, I-600A3, I-526(L). Un
// regex más estricto rechazaba con 400 formularios legítimos que sí tienen plazos.
const QuerySchema = z.object({
  form: z
    .string()
    .regex(/^[A-Za-z]-?\d{1,4}[A-Za-z0-9()]{0,6}$/, "Formulario inválido (ej. I-130, N-400)"),
  office: z
    .string()
    .regex(/^[A-Za-z]{2,5}$/, "Código de oficina inválido (ej. NBC)")
    .optional(),
});

export async function GET(request: Request): Promise<Response> {
  if (!feedEnabled("processingTimes")) {
    return jsonErr("ConfigMissing", "Los plazos de procesamiento no están habilitados");
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseWith(QuerySchema, searchParamsToObject(searchParams));
  if (!parsed.success) return jsonFrom(parsed.error);

  const cached = await loadCache<unknown>(PROCESSING_TIMES_CACHE);
  if (!cached) {
    return jsonErr("BackendUnavailable", "Los plazos de procesamiento aún no se han sincronizado");
  }

  const data = ProcessingTimesDataSchema.safeParse(cached.data);
  if (!data.success) {
    return jsonErr("BackendUnavailable", "El cache de plazos de procesamiento es inválido");
  }

  return jsonOk(lookupProcessingTime(data.data, parsed.data.form, parsed.data.office));
}
