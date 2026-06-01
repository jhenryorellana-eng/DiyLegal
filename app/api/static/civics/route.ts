import { z } from "zod";
import { loadCache, saveCache } from "@/lib/feeds/cache";
import { type CivicsData, civicsCacheName, fetchCivics, selectVersion } from "@/lib/feeds/civics";
import { feedEnabled } from "@/lib/feeds/config";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";
import { parseWith, searchParamsToObject } from "@/lib/validation/zod-helpers";

/**
 * GET /api/static/civics?version=|filingDate= (doc 07 §4.5, doc 09 §10).
 * Selecciona el pool (2008/2025) y lo sirve cache-first (Gemini cuesta).
 */
export const runtime = "nodejs";

const QuerySchema = z.object({
  version: z.enum(["2008", "2025"]).optional(),
  filingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado YYYY-MM-DD")
    .optional(),
});

export async function GET(request: Request): Promise<Response> {
  if (!feedEnabled("civics")) {
    return jsonErr("ConfigMissing", "El examen de civismo no está habilitado");
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseWith(QuerySchema, searchParamsToObject(searchParams));
  if (!parsed.success) return jsonFrom(parsed.error);

  const version = selectVersion(parsed.data);
  const cacheName = civicsCacheName(version);

  const cached = await loadCache<CivicsData>(cacheName);
  if (cached) {
    return jsonOk({
      ...cached.data,
      count: cached.data.questions.length,
      cachedAt: cached.fetchedAt,
    });
  }

  try {
    const data = await fetchCivics(version);
    await saveCache(cacheName, data);
    return jsonOk({ ...data, count: data.questions.length });
  } catch {
    return jsonErr("BackendUnavailable", "No se pudo obtener el examen de civismo");
  }
}
