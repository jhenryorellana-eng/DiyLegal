import { loadCache, saveCache } from "@/lib/feeds/cache";
import type { CourtDetails, CourtStatus, JudgeStats } from "@/lib/eoir/court-intelligence/types";

/**
 * Persistencia de Court Intelligence (doc 09 §8). Reutiliza `lib/feeds/cache.ts`
 * (JSON en `/data`, git-ignored) en vez de duplicar I/O. Hereda el caveat de
 * plataforma del slice 10 (FS de Vercel es read-only salvo /tmp → resolver con
 * worker/storage en Fase 5; ver tasks/lessons.md).
 *
 * Mantiene: (1) el último snapshot de estados de cortes, (2) un change-log
 * acotado que detecta transiciones; severidad ALTA al pasar a CLOSED.
 */

const COURT_STATUS_CACHE = "eoir-court-status";
const COURT_DETAILS_CACHE = "eoir-court-cache";
const CHANGE_LOG_CACHE = "eoir-change-log";
const CHANGE_LOG_MAX = 500;
const LRU_MAX = 500;

export interface ChangeLogEntry {
  at: string;
  slug: string;
  name: string;
  from: string;
  to: string;
  severity: "high" | "normal";
}

export async function loadCourtStatuses(): Promise<CourtStatus[] | null> {
  return (await loadCache<CourtStatus[]>(COURT_STATUS_CACHE))?.data ?? null;
}

export async function saveCourtStatuses(courts: CourtStatus[]): Promise<void> {
  await saveCache(COURT_STATUS_CACHE, courts);
}

/**
 * Detecta cambios de estado por slug (puro; `at` se inyecta para testear).
 * Severidad ALTA cuando una corte pasa a CLOSED (open → closed).
 */
export function detectChanges(
  prev: CourtStatus[],
  next: CourtStatus[],
  at: string,
): ChangeLogEntry[] {
  const prevBySlug = new Map(prev.map((c) => [c.slug, c]));
  const changes: ChangeLogEntry[] = [];
  for (const court of next) {
    const before = prevBySlug.get(court.slug);
    if (!before || before.status === court.status) continue;
    changes.push({
      at,
      slug: court.slug,
      name: court.name,
      from: before.status,
      to: court.status,
      severity: court.closed && !before.closed ? "high" : "normal",
    });
  }
  return changes;
}

export async function loadChangeLog(): Promise<ChangeLogEntry[]> {
  return (await loadCache<ChangeLogEntry[]>(CHANGE_LOG_CACHE))?.data ?? [];
}

/** Prepende cambios al log (más recientes primero) y lo acota a CHANGE_LOG_MAX. */
export async function appendChangeLog(entries: ChangeLogEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const existing = await loadChangeLog();
  await saveCache(CHANGE_LOG_CACHE, [...entries, ...existing].slice(0, CHANGE_LOG_MAX));
}

// --- Cache LRU genérica (court/judge, máx 500; doc 09 §8) --------------------

interface LruRecord<T> {
  value: T;
  touchedAt: string;
}
type LruMap<T> = Record<string, LruRecord<T>>;

async function lruGet<T>(cacheName: string, key: string): Promise<T | null> {
  const map = (await loadCache<LruMap<T>>(cacheName))?.data ?? {};
  return map[key]?.value ?? null;
}

async function lruSet<T>(
  cacheName: string,
  key: string,
  value: T,
  at: string,
  max: number,
): Promise<void> {
  const map = (await loadCache<LruMap<T>>(cacheName))?.data ?? {};
  map[key] = { value, touchedAt: at };
  const keys = Object.keys(map);
  if (keys.length > max) {
    const oldestFirst = keys.sort((a, b) => (map[a]!.touchedAt < map[b]!.touchedAt ? -1 : 1));
    for (const stale of oldestFirst.slice(0, keys.length - max)) delete map[stale];
  }
  await saveCache(cacheName, map);
}

export async function loadCourtDetails(slug: string): Promise<CourtDetails | null> {
  return lruGet<CourtDetails>(COURT_DETAILS_CACHE, slug);
}

export async function saveCourtDetails(
  slug: string,
  details: CourtDetails,
  at: string,
): Promise<void> {
  await lruSet<CourtDetails>(COURT_DETAILS_CACHE, slug, details, at, LRU_MAX);
}

// --- Judge stats: snapshot completo (TRAC entrega toda la tabla de una vez, no
//     por juez → se cachea el blob entero en lugar de una LRU per-código). -----

const JUDGE_STATS_CACHE = "eoir-judge-cache";

export async function loadJudgeStats(): Promise<JudgeStats[] | null> {
  return (await loadCache<JudgeStats[]>(JUDGE_STATS_CACHE))?.data ?? null;
}

export async function saveJudgeStats(judges: JudgeStats[]): Promise<void> {
  await saveCache(JUDGE_STATS_CACHE, judges);
}
