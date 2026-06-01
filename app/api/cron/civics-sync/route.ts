import { saveCache } from "@/lib/feeds/cache";
import { civicsCacheName, fetchCivics } from "@/lib/feeds/civics";
import { feedEnabled } from "@/lib/feeds/config";
import { authorizedCron } from "@/lib/cron/authorized-cron";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";

/**
 * Cron civics-sync (mensual, día 1 07:00 UTC, vercel.json).
 * Refresca ambos pools (2008 y 2025) con Gemini grounded.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = authorizedCron(request);
  if (auth) return jsonFrom(auth);

  if (!feedEnabled("civics")) {
    return jsonErr("ConfigMissing", "El examen de civismo no está habilitado");
  }

  try {
    const counts: Record<string, number> = {};
    for (const version of ["2008", "2025"] as const) {
      const data = await fetchCivics(version);
      await saveCache(civicsCacheName(version), data);
      counts[version] = data.questions.length;
    }
    return jsonOk({ synced: true, counts });
  } catch (error) {
    return jsonErr("BackendUnavailable", error instanceof Error ? error.message : "sync falló");
  }
}
