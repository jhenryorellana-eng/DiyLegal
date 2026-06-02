import { aafEnabled } from "@/lib/aaf/config";
import { REGULATORY_CACHE_NAME } from "@/lib/aaf/regulatory";
import { refreshRegulatory } from "@/lib/aaf/regulatory-check";
import { authorizedCron } from "@/lib/cron/authorized-cron";
import { saveCache } from "@/lib/feeds/cache";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";

/**
 * Cron regulatory-check (diario 06:00 UTC, vercel.json). Refresca el monto/pausas
 * vigentes del AAF con Gemini grounded (doc 13 §3.3).
 *
 * NOTA (deuda transversal, lessons 2026-06-01): `saveCache` escribe en /data, que
 * NO persiste en Vercel serverless. Resolver el storage real en Fase 5/11
 * (worker con FS persistente o Supabase/Blob). El endpoint cae a la semilla mientras tanto.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = authorizedCron(request);
  if (auth) return jsonFrom(auth);

  if (!aafEnabled("regulatoryCheck")) {
    return jsonErr("ConfigMissing", "La vigilancia regulatoria del AAF no está habilitada");
  }

  try {
    const snapshot = await refreshRegulatory(new Date().toISOString());
    await saveCache(REGULATORY_CACHE_NAME, snapshot);
    return jsonOk({
      synced: true,
      amountCents: snapshot.amountCents,
      fiscalYear: snapshot.fiscalYear,
      pauses: snapshot.pauses.length,
      sources: snapshot.sources.length,
    });
  } catch (error) {
    return jsonErr("BackendUnavailable", error instanceof Error ? error.message : "sync falló");
  }
}
