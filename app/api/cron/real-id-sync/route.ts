import { saveCache } from "@/lib/feeds/cache";
import { feedEnabled } from "@/lib/feeds/config";
import { REAL_ID_CACHE, fetchRealId } from "@/lib/feeds/real-id";
import { authorizedCron } from "@/lib/cron/authorized-cron";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";

/**
 * Cron real-id-sync (mensual, día 1 06:30 UTC, vercel.json).
 * Refresca el cache de REAL ID con Gemini grounded.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = authorizedCron(request);
  if (auth) return jsonFrom(auth);

  if (!feedEnabled("realId")) {
    return jsonErr("ConfigMissing", "La información de REAL ID no está habilitada");
  }

  try {
    const data = await fetchRealId();
    await saveCache(REAL_ID_CACHE, data);
    return jsonOk({ synced: true, states: data.states.length, asOf: data.asOf });
  } catch (error) {
    return jsonErr("BackendUnavailable", error instanceof Error ? error.message : "sync falló");
  }
}
