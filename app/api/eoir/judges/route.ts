import { z } from "zod";
import { aafEnabled } from "@/lib/aaf/config";
import { EoirCaptchaDetectedError } from "@/lib/eoir/court-intelligence/scrapers/http-client";
import {
  getJudgeStats,
  TRAC_JUDGE_REPORTS_URL,
} from "@/lib/eoir/court-intelligence/scrapers/trac-judge-stats";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";
import { parseWith, searchParamsToObject } from "@/lib/validation/zod-helpers";

/**
 * GET /api/eoir/judges?court=&judge=&baseCityCode= (doc 09 §8).
 * Estadísticas de asilo por juez (TRAC). Cache-first con scrape en frío.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

const QuerySchema = z.object({
  court: z.string().min(1).max(80).optional(),
  judge: z.string().min(1).max(80).optional(),
  baseCityCode: z
    .string()
    .regex(/^[A-Za-z]{2,5}$/, "Código de ciudad inválido")
    .optional(),
});

export async function GET(request: Request): Promise<Response> {
  if (!aafEnabled("judgeStats")) {
    return jsonErr("ConfigMissing", "Las estadísticas de jueces no están habilitadas");
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseWith(QuerySchema, searchParamsToObject(searchParams));
  if (!parsed.success) return jsonFrom(parsed.error);
  const { court, judge, baseCityCode } = parsed.data;

  let judges;
  try {
    judges = await getJudgeStats();
  } catch (error) {
    if (error instanceof EoirCaptchaDetectedError) {
      return jsonErr("BackendUnavailable", "La fuente está protegida por un desafío anti-bot");
    }
    return jsonErr("BackendUnavailable", "No se pudieron obtener las estadísticas de jueces");
  }

  if (court) judges = judges.filter((j) => j.court.toLowerCase().includes(court.toLowerCase()));
  if (judge) judges = judges.filter((j) => j.judge.toLowerCase().includes(judge.toLowerCase()));
  if (baseCityCode) {
    const code = baseCityCode.toUpperCase();
    judges = judges.filter((j) => j.baseCityCode === code);
  }

  return jsonOk({ count: judges.length, source: TRAC_JUDGE_REPORTS_URL, judges });
}
