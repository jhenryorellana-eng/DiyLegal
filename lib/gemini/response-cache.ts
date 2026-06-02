/**
 * Cache en memoria (por instancia) de respuestas Gemini con TTL (doc 13 §3.5).
 * Cada llamada a Gemini cuesta dinero (doc 07 §"costo"): cacheamos resultados
 * idénticos durante 1h. En serverless el cache es efímero por instancia; es un
 * mejor-esfuerzo, no una garantía (la persistencia dura vive en Fase 5/11).
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hora
const store = new Map<string, Entry<unknown>>();

/** Devuelve el valor cacheado si sigue vigente; si expiró, lo descarta. */
export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Memoiza `fn` bajo `key` durante `ttlMs` (cache-aside). */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = getCached<T>(key);
  if (hit !== null) return hit;
  const value = await fn();
  setCached(key, value, ttlMs);
  return value;
}

/** Vacía el cache (uso en tests). */
export function clearResponseCache(): void {
  store.clear();
}
