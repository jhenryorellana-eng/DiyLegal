import { z } from "zod";
import { loadCache } from "@/lib/feeds/cache";
import { feedEnabled } from "@/lib/feeds/config";
import {
  FEDERAL_REGISTER_CACHE,
  fetchFederalRegister,
  type FederalRegisterResult,
} from "@/lib/feeds/federal-register";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";
import { parseWith, searchParamsToObject } from "@/lib/validation/zod-helpers";

/**
 * GET /api/feeds/regulations?term=&agency=&perPage= (doc 07 §4.5, doc 09 §9).
 * Consulta el Federal Register EN VIVO; si la fuente falla, sirve el último
 * cache del cron (fallback) o 502 si no hay cache.
 */
export const runtime = "nodejs";

const QuerySchema = z.object({
  term: z.string().min(1).max(200).optional(),
  agency: z.string().min(1).max(120).optional(),
  perPage: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(request: Request): Promise<Response> {
  if (!feedEnabled("federalRegister")) {
    return jsonErr("ConfigMissing", "Las regulaciones (Federal Register) no están habilitadas");
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseWith(QuerySchema, searchParamsToObject(searchParams));
  if (!parsed.success) return jsonFrom(parsed.error);

  try {
    return jsonOk(await fetchFederalRegister(parsed.data));
  } catch {
    const cached = await loadCache<FederalRegisterResult>(FEDERAL_REGISTER_CACHE);
    if (cached) {
      return jsonOk({ ...cached.data, stale: true, cachedAt: cached.fetchedAt });
    }
    return jsonErr("BackendUnavailable", "No se pudo consultar el Federal Register");
  }
}
