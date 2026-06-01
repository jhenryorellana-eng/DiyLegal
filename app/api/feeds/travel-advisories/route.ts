import { z } from "zod";
import { loadCache } from "@/lib/feeds/cache";
import { feedEnabled } from "@/lib/feeds/config";
import {
  TRAVEL_ADVISORIES_CACHE,
  type TravelAdvisory,
  fetchTravelAdvisories,
  filterByCountry,
} from "@/lib/feeds/travel-advisories";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";
import { parseWith, searchParamsToObject } from "@/lib/validation/zod-helpers";

/**
 * GET /api/feeds/travel-advisories?country= (doc 07 §4.5, doc 09 §9).
 * Off por defecto (flag travelAdvisories): devuelve 503 hasta activarlo.
 * En vivo → fallback al cache → 502.
 */
export const runtime = "nodejs";

const QuerySchema = z.object({ country: z.string().min(1).max(80).optional() });

export async function GET(request: Request): Promise<Response> {
  if (!feedEnabled("travelAdvisories")) {
    return jsonErr("ConfigMissing", "Los avisos de viaje no están habilitados");
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseWith(QuerySchema, searchParamsToObject(searchParams));
  if (!parsed.success) return jsonFrom(parsed.error);

  const { country } = parsed.data;
  try {
    const all = await fetchTravelAdvisories();
    const results = country ? filterByCountry(all, country) : all;
    return jsonOk({ count: results.length, results });
  } catch {
    const cached = await loadCache<TravelAdvisory[]>(TRAVEL_ADVISORIES_CACHE);
    if (cached) {
      const results = country ? filterByCountry(cached.data, country) : cached.data;
      return jsonOk({ count: results.length, results, stale: true, cachedAt: cached.fetchedAt });
    }
    return jsonErr("BackendUnavailable", "No se pudo consultar los avisos de viaje");
  }
}
