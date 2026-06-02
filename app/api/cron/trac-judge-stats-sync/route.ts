import { aafEnabled } from "@/lib/aaf/config";
import { authorizedCron } from "@/lib/cron/authorized-cron";
import { fetchTracJudgeStats } from "@/lib/eoir/court-intelligence/scrapers/trac-judge-stats";
import { saveJudgeStats } from "@/lib/eoir/court-intelligence/persistence/store";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";

/**
 * Cron trac-judge-stats-sync (semanal, vercel.json). Refresca el snapshot de
 * estadísticas de jueces de TRAC (doc 09 §8). Gate por `judgeStats`.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  const auth = authorizedCron(request);
  if (auth) return jsonFrom(auth);

  if (!aafEnabled("judgeStats")) {
    return jsonErr("ConfigMissing", "Las estadísticas de jueces no están habilitadas");
  }

  try {
    const judges = await fetchTracJudgeStats();
    await saveJudgeStats(judges);
    return jsonOk({ synced: true, judges: judges.length });
  } catch (error) {
    return jsonErr("BackendUnavailable", error instanceof Error ? error.message : "sync falló");
  }
}
