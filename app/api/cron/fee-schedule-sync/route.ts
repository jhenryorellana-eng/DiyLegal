import { saveCache } from "@/lib/feeds/cache";
import { feedEnabled } from "@/lib/feeds/config";
import { FEE_SCHEDULE_CACHE, fetchFeeScheduleText } from "@/lib/feeds/fee-schedule";
import { authorizedCron } from "@/lib/cron/authorized-cron";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";

/**
 * Cron fee-schedule-sync (día 1 de cada mes 12:00 UTC, vercel.json).
 * Refresca el texto cacheado del G-1055.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = authorizedCron(request);
  if (auth) return jsonFrom(auth);

  if (!feedEnabled("feeSchedule")) {
    return jsonErr("ConfigMissing", "El tarifario (G-1055) no está habilitado");
  }

  try {
    const text = await fetchFeeScheduleText();
    await saveCache(FEE_SCHEDULE_CACHE, text);
    return jsonOk({ synced: true, chars: text.length });
  } catch (error) {
    return jsonErr("BackendUnavailable", error instanceof Error ? error.message : "sync falló");
  }
}
