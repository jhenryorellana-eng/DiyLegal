import { z } from "zod";
import { loadCache, saveCache } from "@/lib/feeds/cache";
import { DMV_CACHE, type DmvData, fetchDmv, findDmvState } from "@/lib/feeds/dmv";
import { feedEnabled } from "@/lib/feeds/config";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";
import { parseWith, searchParamsToObject } from "@/lib/validation/zod-helpers";

/**
 * GET /api/static/dmv-manual?state= (doc 07 §4.5, doc 09 §10). Cache-first.
 * Con `state` devuelve ese estado; sin él, los 12.
 */
export const runtime = "nodejs";

const QuerySchema = z.object({
  state: z
    .string()
    .regex(/^[A-Za-z]{2}$/, "El estado debe ser un código de 2 letras (ej. CA)")
    .optional(),
});

function shape(data: DmvData, state?: string) {
  if (!state) return data;
  return { state: findDmvState(data, state), asOf: data.asOf };
}

export async function GET(request: Request): Promise<Response> {
  if (!feedEnabled("dmv")) {
    return jsonErr("ConfigMissing", "Los manuales DMV no están habilitados");
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseWith(QuerySchema, searchParamsToObject(searchParams));
  if (!parsed.success) return jsonFrom(parsed.error);
  const { state } = parsed.data;

  const cached = await loadCache<DmvData>(DMV_CACHE);
  if (cached) {
    return jsonOk({ ...shape(cached.data, state), cachedAt: cached.fetchedAt });
  }

  try {
    const data = await fetchDmv();
    await saveCache(DMV_CACHE, data);
    return jsonOk(shape(data, state));
  } catch {
    return jsonErr("BackendUnavailable", "No se pudieron obtener los manuales DMV");
  }
}
