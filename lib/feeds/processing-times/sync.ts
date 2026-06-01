import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveCache } from "@/lib/feeds/cache";
import {
  PROCESSING_TIMES_CACHE,
  type ProcessingTimesData,
  type RawProcessingRows,
  buildProcessingTimesData,
} from "@/lib/feeds/processing-times";

/**
 * Sync del mirror USCIS Processing Times (doc 09 §7). ÚNICO lugar que toca
 * `node:sqlite` (dynamic import → no carga en el runtime de lectura) y la red.
 *
 * Flujo: release latest de `jzebedee/uscis` → descarga el `.db` a un temp del SO
 * → lee `forms`/`offices`/`processing_time` → vuelca a `data/<cache>.json`.
 *
 * Requiere Node ≥ 22.5 (node:sqlite). Si el runtime no lo soporta, migrar a
 * `sql.js` (WASM) o correr este sync en el worker y publicar el JSON (doc 09 §14).
 */

const RELEASES_API = "https://api.github.com/repos/jzebedee/uscis/releases/latest";

const SELECT_FORMS = "SELECT name, description_en, description_es FROM forms";
const SELECT_OFFICES = "SELECT code, description FROM offices";
const SELECT_TIMES =
  "SELECT form_name, office_code, form_subtype, publication_date, range_lower, range_upper, " +
  "range_lower_unit, range_upper_unit, service_request_date, subtype_info_en, subtype_info_es " +
  "FROM processing_time";

interface GithubRelease {
  tag_name?: string;
  assets?: { name: string; browser_download_url: string }[];
}

export interface LatestRelease {
  tag: string;
  dbUrl: string;
}

/** Resuelve el release más reciente y la URL de su asset `.db`. */
export async function fetchLatestRelease(): Promise<LatestRelease> {
  // `GITHUB_TOKEN` es OPCIONAL: sin él, la API no autenticada limita a 60 req/h
  // por IP (compartida en serverless); con él sube a 5000/h. Server-side only.
  const headers: Record<string, string> = {
    "User-Agent": "diy-legal",
    Accept: "application/vnd.github+json",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(RELEASES_API, { headers });
  if (!res.ok) {
    throw new Error(`GitHub Releases API respondió HTTP ${res.status}`);
  }
  const json = (await res.json()) as GithubRelease;
  const asset = json.assets?.find((a) => a.name.endsWith(".db"));
  if (!json.tag_name || !asset) {
    throw new Error("El release del mirror no expone un asset .db");
  }
  return { tag: json.tag_name, dbUrl: asset.browser_download_url };
}

/** Lee las tres tablas del SQLite descargado. Aísla el módulo nativo. */
async function readDatabaseRows(dbPath: string): Promise<RawProcessingRows> {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return {
      forms: db.prepare(SELECT_FORMS).all() as RawProcessingRows["forms"],
      offices: db.prepare(SELECT_OFFICES).all() as RawProcessingRows["offices"],
      times: db.prepare(SELECT_TIMES).all() as RawProcessingRows["times"],
    };
  } finally {
    db.close();
  }
}

/** Descarga el mirror, lo lee y persiste el cache JSON. Devuelve el cache. */
export async function syncProcessingTimes(): Promise<ProcessingTimesData> {
  const { tag, dbUrl } = await fetchLatestRelease();

  const res = await fetch(dbUrl);
  if (!res.ok) {
    throw new Error(`Descarga del mirror SQLite respondió HTTP ${res.status}`);
  }

  // Directorio temporal único por ejecución (concurrency-safe: evita que dos
  // syncs del mismo release colisionen en el mismo path en /tmp).
  const dir = await mkdtemp(join(tmpdir(), "diy-pt-"));
  const dbPath = join(dir, `${tag}.db`);
  await writeFile(dbPath, Buffer.from(await res.arrayBuffer()));

  try {
    const raw = await readDatabaseRows(dbPath);
    const data = buildProcessingTimesData(tag, dbUrl, raw);
    await saveCache(PROCESSING_TIMES_CACHE, data);
    return data;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
