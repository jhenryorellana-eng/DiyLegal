import { z } from "zod";
import { loadCache, saveCache } from "@/lib/feeds/cache";
import { feedEnabled } from "@/lib/feeds/config";
import { REAL_ID_CACHE, type RealIdData, fetchRealId, findState } from "@/lib/feeds/real-id";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";
import { parseWith, searchParamsToObject } from "@/lib/validation/zod-helpers";

/**
 * GET /api/static/real-id?state= (doc 07 §4.5, doc 09 §10).
 * Cache-first (Gemini cuesta). Con `state` devuelve federal + ese estado.
 */
export const runtime = "nodejs";

const QuerySchema = z.object({
  state: z
    .string()
    .regex(/^[A-Za-z]{2}$/, "El estado debe ser un código de 2 letras (ej. CA)")
    .optional(),
});

function shape(data: RealIdData, state?: string) {
  if (!state) return data;
  return { federal: data.federal, state: findState(data, state), asOf: data.asOf };
}

export async function GET(request: Request): Promise<Response> {
  if (!feedEnabled("realId")) {
    return jsonErr("ConfigMissing", "La información de REAL ID no está habilitada");
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseWith(QuerySchema, searchParamsToObject(searchParams));
  if (!parsed.success) return jsonFrom(parsed.error);
  const { state } = parsed.data;

  const cached = await loadCache<RealIdData>(REAL_ID_CACHE);
  if (cached) {
    return jsonOk({ ...shape(cached.data, state), cachedAt: cached.fetchedAt });
  }

  try {
    const data = await fetchRealId();
    await saveCache(REAL_ID_CACHE, data);
    return jsonOk(shape(data, state));
  } catch {
    return jsonErr("BackendUnavailable", "No se pudo obtener la información de REAL ID");
  }
}
