import { aafEnabled } from "@/lib/aaf/config";
import { authorizedCron } from "@/lib/cron/authorized-cron";
import { fetchOperationalStatus } from "@/lib/eoir/court-intelligence/scrapers/operational-status";
import {
  appendChangeLog,
  detectChanges,
  loadCourtStatuses,
  saveCourtStatuses,
} from "@/lib/eoir/court-intelligence/persistence/store";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";

/**
 * Cron eoir-status-sync (cada 6h, vercel.json). Refresca el estado operativo de
 * las cortes, detecta cambios y los registra (severidad alta al pasar a CLOSED).
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = authorizedCron(request);
  if (auth) return jsonFrom(auth);

  if (!aafEnabled("courtIntelligenceCron")) {
    return jsonErr("ConfigMissing", "El cron de Court Intelligence no está habilitado");
  }

  try {
    const next = await fetchOperationalStatus();
    const prev = (await loadCourtStatuses()) ?? [];
    const changes = detectChanges(prev, next, new Date().toISOString());
    await appendChangeLog(changes);
    await saveCourtStatuses(next);
    return jsonOk({ synced: true, courts: next.length, changes: changes.length });
  } catch (error) {
    return jsonErr("BackendUnavailable", error instanceof Error ? error.message : "sync falló");
  }
}
