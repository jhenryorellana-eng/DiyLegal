import { z } from "zod";
import { aafEnabled } from "@/lib/aaf/config";
import { EoirCaptchaDetectedError } from "@/lib/eoir/court-intelligence/scrapers/http-client";
import {
  fetchOperationalStatus,
  OPERATIONAL_STATUS_URL,
} from "@/lib/eoir/court-intelligence/scrapers/operational-status";
import {
  loadCourtStatuses,
  saveCourtStatuses,
} from "@/lib/eoir/court-intelligence/persistence/store";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";
import { parseWith, searchParamsToObject } from "@/lib/validation/zod-helpers";

/**
 * GET /api/eoir/courts?status=open|closed&q= (doc 09 §8).
 * Lista de cortes con su estado operativo. Cache-first: sirve el snapshot del
 * cron; en arranque en frío hace un scrape en vivo y lo persiste.
 */
export const runtime = "nodejs";

const QuerySchema = z.object({
  status: z.enum(["open", "closed"]).optional(),
  q: z.string().min(1).max(80).optional(),
});

export async function GET(request: Request): Promise<Response> {
  if (!aafEnabled("courtIntelligence")) {
    return jsonErr("ConfigMissing", "Court Intelligence no está habilitado");
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseWith(QuerySchema, searchParamsToObject(searchParams));
  if (!parsed.success) return jsonFrom(parsed.error);

  let courts = await loadCourtStatuses();
  if (!courts) {
    try {
      courts = await fetchOperationalStatus();
      await saveCourtStatuses(courts);
    } catch (error) {
      if (error instanceof EoirCaptchaDetectedError) {
        return jsonErr("BackendUnavailable", "La fuente está protegida por un desafío anti-bot");
      }
      return jsonErr("BackendUnavailable", "No se pudo obtener el estado de las cortes");
    }
  }

  const { status, q } = parsed.data;
  let result = courts;
  if (status) result = result.filter((c) => (status === "closed" ? c.closed : !c.closed));
  if (q) {
    const needle = q.toLowerCase();
    result = result.filter((c) => c.name.toLowerCase().includes(needle));
  }

  return jsonOk({ count: result.length, source: OPERATIONAL_STATUS_URL, courts: result });
}
