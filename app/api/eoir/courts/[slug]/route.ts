import { aafEnabled } from "@/lib/aaf/config";
import { EoirCaptchaDetectedError } from "@/lib/eoir/court-intelligence/scrapers/http-client";
import { fetchCourtDetails } from "@/lib/eoir/court-intelligence/scrapers/court-details";
import {
  loadCourtDetails,
  saveCourtDetails,
} from "@/lib/eoir/court-intelligence/persistence/store";
import { jsonErr, jsonOk } from "@/lib/http/response";

/**
 * GET /api/eoir/courts/[slug] (doc 09 §8). Detalle de una corte.
 * Cache LRU-first; en arranque en frío hace scrape en vivo y lo persiste.
 */
export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9-]{3,80}$/i;

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  if (!aafEnabled("courtIntelligence")) {
    return jsonErr("ConfigMissing", "Court Intelligence no está habilitado");
  }

  const { slug } = await ctx.params;
  if (!SLUG_RE.test(slug)) {
    return jsonErr("ValidationError", "Slug de corte inválido");
  }

  const cached = await loadCourtDetails(slug);
  if (cached) return jsonOk(cached);

  try {
    const details = await fetchCourtDetails(slug);
    await saveCourtDetails(slug, details, new Date().toISOString());
    return jsonOk(details);
  } catch (error) {
    if (error instanceof EoirCaptchaDetectedError) {
      return jsonErr("BackendUnavailable", "La fuente está protegida por un desafío anti-bot");
    }
    if (error instanceof Error && /HTTP 404/.test(error.message)) {
      return jsonErr("CaseNotFound", "No existe una corte con ese identificador");
    }
    return jsonErr("BackendUnavailable", "No se pudo obtener el detalle de la corte");
  }
}
