import { authorizedCron } from "@/lib/cron/authorized-cron";
import { feedEnabled } from "@/lib/feeds/config";
import { syncProcessingTimes } from "@/lib/feeds/processing-times/sync";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";

/**
 * Cron processing-times-sync (diario 14:00 UTC, vercel.json). Descarga el mirror
 * SQLite de `jzebedee/uscis` y refresca el cache JSON (doc 09 §7).
 *
 * Usa `node:sqlite` (Node ≥ 22.5). Si el runtime no lo soporta, el sync falla con
 * 502 y debe correrse desde el worker / `scripts/sync-processing-times.ts`.
 *
 * ⚠️ DEPLOY (deuda transversal, doc 09 §14): `saveCache` escribe en
 * `cwd/data/*.json`, pero el filesystem de Vercel es de SOLO LECTURA salvo /tmp
 * (que no persiste entre invocaciones). Por tanto este cron (y los demás feeds
 * que cachean en `/data`) NO puede persistir en Vercel tal cual: requiere correr
 * en el worker dedicado (Fase 5) o mover el cache a storage persistente
 * (Supabase/Blob). Pendiente a nivel plataforma; ver tasks/lessons.md.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = authorizedCron(request);
  if (auth) return jsonFrom(auth);

  if (!feedEnabled("processingTimes")) {
    return jsonErr("ConfigMissing", "Los plazos de procesamiento no están habilitados");
  }

  try {
    const data = await syncProcessingTimes();
    return jsonOk({
      synced: true,
      release: data.release,
      forms: data.forms.length,
      offices: data.offices.length,
      times: data.times.length,
    });
  } catch (error) {
    return jsonErr("BackendUnavailable", error instanceof Error ? error.message : "sync falló");
  }
}
