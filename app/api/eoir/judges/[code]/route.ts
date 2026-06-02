import { aafEnabled } from "@/lib/aaf/config";
import { EoirCaptchaDetectedError } from "@/lib/eoir/court-intelligence/scrapers/http-client";
import { getJudgeStats } from "@/lib/eoir/court-intelligence/scrapers/trac-judge-stats";
import { jsonErr, jsonOk } from "@/lib/http/response";

/**
 * GET /api/eoir/judges/[code] (doc 09 §8). Un juez por su código TRAC
 * (p. ej. `00347ADL`, tomado del enlace real del reporte).
 */
export const runtime = "nodejs";
export const maxDuration = 300;

const CODE_RE = /^[A-Za-z0-9]{3,16}$/;

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<Response> {
  if (!aafEnabled("judgeStats")) {
    return jsonErr("ConfigMissing", "Las estadísticas de jueces no están habilitadas");
  }

  const { code } = await ctx.params;
  if (!CODE_RE.test(code)) {
    return jsonErr("ValidationError", "Código de juez inválido");
  }

  let judges;
  try {
    judges = await getJudgeStats();
  } catch (error) {
    if (error instanceof EoirCaptchaDetectedError) {
      return jsonErr("BackendUnavailable", "La fuente está protegida por un desafío anti-bot");
    }
    return jsonErr("BackendUnavailable", "No se pudieron obtener las estadísticas de jueces");
  }

  const judge = judges.find((j) => j.code.toLowerCase() === code.toLowerCase());
  if (!judge) return jsonErr("CaseNotFound", "No existe un juez con ese código");
  return jsonOk(judge);
}
