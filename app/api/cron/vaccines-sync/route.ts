import { saveCache } from "@/lib/feeds/cache";
import { feedEnabled } from "@/lib/feeds/config";
import { VACCINES_CACHE, fetchVaccines } from "@/lib/feeds/vaccines";
import { authorizedCron } from "@/lib/cron/authorized-cron";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";

/**
 * Cron vaccines-sync (mensual, día 1 06:00 UTC, vercel.json).
 * Refresca el cache de vacunas con Gemini grounded.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = authorizedCron(request);
  if (auth) return jsonFrom(auth);

  if (!feedEnabled("vaccines")) {
    return jsonErr("ConfigMissing", "La lista de vacunas no está habilitada");
  }

  try {
    const data = await fetchVaccines();
    await saveCache(VACCINES_CACHE, data);
    return jsonOk({ synced: true, count: data.vaccines.length, asOf: data.asOf });
  } catch (error) {
    return jsonErr("BackendUnavailable", error instanceof Error ? error.message : "sync falló");
  }
}
