import { z } from "zod";
import { aafEnabled } from "@/lib/aaf/config";
import { EoirCaptchaDetectedError } from "@/lib/eoir/court-intelligence/scrapers/http-client";
import { getJudgeStats } from "@/lib/eoir/court-intelligence/scrapers/trac-judge-stats";
import { loadCourtStatuses } from "@/lib/eoir/court-intelligence/persistence/store";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";
import { parseWith, searchParamsToObject } from "@/lib/validation/zod-helpers";

/**
 * GET /api/eoir/intelligence/case?baseCityCode=&judgeCode=&judgeName=&court=
 * (doc 09 §8). Payload AGREGADO para enriquecer un caso: estado de la corte
 * (operational-status) + estadísticas del/los juez(ces) (TRAC). Identificadores
 * reales derivados de las fuentes (no códigos inventados).
 */
export const runtime = "nodejs";
export const maxDuration = 300;

const QuerySchema = z
  .object({
    baseCityCode: z
      .string()
      .regex(/^[A-Za-z]{2,5}$/, "Código de ciudad inválido")
      .optional(),
    judgeCode: z
      .string()
      .regex(/^[A-Za-z0-9]{3,16}$/, "Código de juez inválido")
      .optional(),
    judgeName: z.string().min(1).max(80).optional(),
    court: z.string().min(1).max(80).optional(),
  })
  .refine((q) => q.baseCityCode || q.judgeCode || q.judgeName || q.court, {
    message: "Indica al menos un filtro (baseCityCode, judgeCode, judgeName o court)",
  });

export async function GET(request: Request): Promise<Response> {
  if (!aafEnabled("courtIntelligence")) {
    return jsonErr("ConfigMissing", "Court Intelligence no está habilitado");
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseWith(QuerySchema, searchParamsToObject(searchParams));
  if (!parsed.success) return jsonFrom(parsed.error);
  const { baseCityCode, judgeCode, judgeName, court } = parsed.data;

  let judges;
  try {
    judges = await getJudgeStats();
  } catch (error) {
    if (error instanceof EoirCaptchaDetectedError) {
      return jsonErr("BackendUnavailable", "La fuente está protegida por un desafío anti-bot");
    }
    return jsonErr("BackendUnavailable", "No se pudieron obtener las estadísticas de jueces");
  }

  if (judgeCode) {
    judges = judges.filter((j) => j.code.toLowerCase() === judgeCode.toLowerCase());
  } else {
    if (baseCityCode) {
      const code = baseCityCode.toUpperCase();
      judges = judges.filter((j) => j.baseCityCode === code);
    }
    if (judgeName) {
      judges = judges.filter((j) => j.judge.toLowerCase().includes(judgeName.toLowerCase()));
    }
  }

  const courtName = court ?? judges[0]?.court ?? null;
  let courtStatus = null;
  if (courtName) {
    const statuses = (await loadCourtStatuses()) ?? [];
    const needle = courtName.toLowerCase();
    courtStatus =
      statuses.find((c) => c.name.toLowerCase() === needle) ??
      statuses.find((c) => c.name.toLowerCase().includes(needle)) ??
      null;
  }

  return jsonOk({ query: parsed.data, court: courtStatus, judges });
}
