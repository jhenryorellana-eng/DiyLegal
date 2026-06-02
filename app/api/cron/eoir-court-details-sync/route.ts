import { aafEnabled } from "@/lib/aaf/config";
import { authorizedCron } from "@/lib/cron/authorized-cron";
import { fetchCourtDetails } from "@/lib/eoir/court-intelligence/scrapers/court-details";
import { fetchOperationalStatus } from "@/lib/eoir/court-intelligence/scrapers/operational-status";
import {
  loadCourtStatuses,
  saveCourtDetails,
} from "@/lib/eoir/court-intelligence/persistence/store";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";

/**
 * Cron eoir-court-details-sync (diario, vercel.json). Refresca el detalle de las
 * cortes priorizando el inicio de la tabla, con tope de CAP scrapes por corrida
 * (doc 09 §8). Un fallo individual no aborta la corrida (se registra y continúa).
 */
export const runtime = "nodejs";
export const maxDuration = 300;

const CAP = 25;

export async function GET(request: Request): Promise<Response> {
  const auth = authorizedCron(request);
  if (auth) return jsonFrom(auth);

  if (!aafEnabled("courtIntelligenceCron")) {
    return jsonErr("ConfigMissing", "El cron de Court Intelligence no está habilitado");
  }

  try {
    const statuses = (await loadCourtStatuses()) ?? (await fetchOperationalStatus());
    const slugs = statuses.slice(0, CAP).map((c) => c.slug);
    const now = new Date().toISOString();
    const failed: string[] = [];
    let synced = 0;
    for (const slug of slugs) {
      try {
        await saveCourtDetails(slug, await fetchCourtDetails(slug), now);
        synced += 1;
      } catch {
        failed.push(slug);
      }
    }
    return jsonOk({ synced, failed: failed.length, cap: CAP });
  } catch (error) {
    return jsonErr("BackendUnavailable", error instanceof Error ? error.message : "sync falló");
  }
}
