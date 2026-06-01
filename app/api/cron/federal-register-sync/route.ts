import { saveCache } from "@/lib/feeds/cache";
import { feedEnabled } from "@/lib/feeds/config";
import { FEDERAL_REGISTER_CACHE, fetchFederalRegister } from "@/lib/feeds/federal-register";
import { authorizedCron } from "@/lib/cron/authorized-cron";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";

/**
 * Cron federal-register-sync (diario 05:00 UTC, vercel.json) — doc 07 §4.6, doc 12.
 * Refresca el cache base que el endpoint usa como fallback.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = authorizedCron(request);
  if (auth) return jsonFrom(auth);

  if (!feedEnabled("federalRegister")) {
    return jsonErr("ConfigMissing", "Las regulaciones (Federal Register) no están habilitadas");
  }

  try {
    const data = await fetchFederalRegister({ perPage: 50 });
    await saveCache(FEDERAL_REGISTER_CACHE, data);
    return jsonOk({ synced: true, count: data.count, cached: data.results.length });
  } catch (error) {
    return jsonErr("BackendUnavailable", error instanceof Error ? error.message : "sync falló");
  }
}
