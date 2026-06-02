import { createHash } from "node:crypto";
import { z } from "zod";
import { fetchPdfText } from "@/lib/feeds/pdf";

/**
 * Vigilancia del Immigration Court Practice Manual (doc 13 §3.4, cron semanal).
 * Descarga el ICPM y guarda su texto + hash en `icpm-cache.json`, con **dedup por
 * SHA-256** (si el contenido no cambió, no se re-procesa). Da contexto de formato
 * a la moción (uso futuro; en Fase 2 sólo se puebla el cache).
 *
 * Desviación documentada (la fuente real manda): el doc cita "cap. 2 y cap. 4",
 * pero el ICPM vigente es un recurso protegido (justice.gov, WAF) sin URLs por
 * capítulo estables. Se usa el PDF del manual verificado; las fuentes son
 * configurables en `ICPM_SOURCES` para ajustarlas si EOIR publica por capítulo.
 */

export interface IcpmSource {
  chapter: string;
  url: string;
}

/** Fuentes del ICPM (verificadas en justice.gov; ajustables sin tocar lógica). */
export const ICPM_SOURCES: IcpmSource[] = [
  {
    chapter: "full-manual",
    url: "https://www.justice.gov/eoir/media/1052736/dl?inline=",
  },
];

export const IcpmEntrySchema = z.object({
  chapter: z.string(),
  url: z.string().url(),
  sha256: z.string(),
  chars: z.number().int().nonnegative(),
  fetchedAt: z.string(),
});
export type IcpmEntry = z.infer<typeof IcpmEntrySchema>;

export const IcpmCacheSchema = z.object({ entries: z.array(IcpmEntrySchema) });
export type IcpmCache = z.infer<typeof IcpmCacheSchema>;

export const ICPM_CACHE_NAME = "icpm-cache";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Descarga las fuentes del ICPM y construye el cache, contando cuántas cambiaron
 * respecto al cache previo (dedup por SHA-256). Lanza si una descarga falla
 * (el cron lo traduce a 502).
 */
export async function refreshIcpm(
  now: string,
  previous: IcpmCache | null,
  sources: IcpmSource[] = ICPM_SOURCES,
): Promise<{ cache: IcpmCache; changed: number }> {
  const prevByChapter = new Map(previous?.entries.map((e) => [e.chapter, e.sha256]) ?? []);
  let changed = 0;
  const entries: IcpmEntry[] = [];
  for (const source of sources) {
    const text = await fetchPdfText(source.url);
    const hash = sha256(text);
    if (prevByChapter.get(source.chapter) !== hash) changed++;
    entries.push({
      chapter: source.chapter,
      url: source.url,
      sha256: hash,
      chars: text.length,
      fetchedAt: now,
    });
  }
  return { cache: { entries }, changed };
}
