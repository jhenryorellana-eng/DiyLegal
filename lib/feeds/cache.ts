import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Cache JSON simple en `/data` (git-ignored, doc 06 §4) para feeds dinámicos.
 * Lo escribe el cron de cada fuente; el endpoint lo usa como FALLBACK cuando la
 * fuente oficial está caída/cambiada (convenciones §"Datos dinámicos").
 */

const DATA_DIR = join(process.cwd(), "data");

export interface CacheEnvelope<T> {
  /** ISO-8601 UTC del momento en que se guardó. */
  fetchedAt: string;
  data: T;
}

/** Nombres de cache permitidos (constantes internas; nunca input de usuario). */
function cacheFile(name: string): string {
  return join(DATA_DIR, `${name}.json`);
}

export async function saveCache<T>(name: string, data: T): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const envelope: CacheEnvelope<T> = { fetchedAt: new Date().toISOString(), data };
  await writeFile(cacheFile(name), JSON.stringify(envelope), "utf8");
}

export async function loadCache<T>(name: string): Promise<CacheEnvelope<T> | null> {
  try {
    const raw = await readFile(cacheFile(name), "utf8");
    return JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    // No existe o es ilegible: se interpreta como "sin cache" (manejado por el caller).
    return null;
  }
}
