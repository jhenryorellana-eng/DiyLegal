import { FEEDS_CONFIG } from "@/lib/feeds/config";

/**
 * Cliente HTTP compartido para scraping (doc 09 §3.4, blueprint infra #4).
 * Reutilizado por Legal Aid, Visa Bulletin y Court Intelligence — NO duplicar.
 *
 * Aporta: (1) rate-limit POR HOST (cortesía con la fuente), (2) reintentos con
 * backoff exponencial + jitter en 5xx/429, (3) detección defensiva de
 * Cloudflare/captcha → `EoirCaptchaDetectedError` (no reintenta: es kill switch).
 */

/** Host bloqueado por un desafío anti-bot (Cloudflare). No es transitorio. */
export class EoirCaptchaDetectedError extends Error {
  constructor(public readonly url: string) {
    super(`Desafío anti-bot detectado en ${url}`);
    this.name = "EoirCaptchaDetectedError";
  }
}

// Rate-limit por defecto para hosts NO declarados en FEEDS_CONFIG (blueprint
// regla 8: no inventar cifras por host; usar un default conservador documentado).
const DEFAULT_RATE_LIMIT_MS = 1500;
const DEFAULT_MAX_RETRIES = 4;
const BACKOFF_BASE_MS = 1000; // 1s, 2s, 4s, 8s…
const BACKOFF_JITTER_MS = 250;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0 Safari/537.36";

/** Última marca de tiempo de request por host (espaciado de cortesía). */
const lastRequestByHost = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** ms de cortesía para el host: exacto, subdominio, o default conservador. */
function rateLimitMsForHost(host: string): number {
  for (const [declared, ms] of Object.entries(FEEDS_CONFIG.rateLimitMsByHost)) {
    if (host === declared || host.endsWith(`.${declared}`)) return ms;
  }
  return DEFAULT_RATE_LIMIT_MS;
}

async function throttle(host: string, overrideMs?: number): Promise<void> {
  const interval = overrideMs ?? rateLimitMsForHost(host);
  const wait = (lastRequestByHost.get(host) ?? 0) + interval - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestByHost.set(host, Date.now());
}

/** Marcadores de la página intersticial de Cloudflare (evita falsos positivos). */
function isChallenge(res: Response, body: string | null): boolean {
  if (res.headers.get("cf-mitigated") === "challenge") return true;
  if (body === null) return false;
  const lower = body.toLowerCase();
  return (
    (lower.includes("just a moment") && lower.includes("cloudflare")) ||
    lower.includes("cf-browser-verification") ||
    lower.includes("challenge-platform")
  );
}

export interface EoirFetchOptions {
  /** Reintentos en 5xx/429 (default 4). */
  retries?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Override del espaciado por host (ms). Útil en tests. */
  minIntervalMs?: number;
  /** Override de la base del backoff (ms). Útil en tests. */
  backoffBaseMs?: number;
  /** Charset del body. `latin1` para fuentes ISO-8859-1 (p. ej. TRAC). Default utf-8. */
  decodeAs?: "utf-8" | "latin1";
}

/**
 * GET con rate-limit, reintentos y detección de Cloudflare. Devuelve el body
 * (texto). Lanza `EoirCaptchaDetectedError` ante un desafío, o `Error` si se
 * agotan los reintentos / la respuesta no es OK.
 */
export async function eoirFetch(url: string, opts: EoirFetchOptions = {}): Promise<string> {
  const host = new URL(url).host;
  const maxRetries = opts.retries ?? DEFAULT_MAX_RETRIES;
  const backoffBase = opts.backoffBaseMs ?? BACKOFF_BASE_MS;
  const headers = { "User-Agent": BROWSER_UA, ...opts.headers };

  for (let attempt = 0; ; attempt++) {
    await throttle(host, opts.minIntervalMs);

    let res: Response;
    try {
      res = await fetch(url, { headers, signal: opts.signal });
    } catch (error) {
      if (attempt >= maxRetries) throw error;
      await sleep(backoffBase * 2 ** attempt + Math.random() * BACKOFF_JITTER_MS);
      continue;
    }

    if (isChallenge(res, null)) throw new EoirCaptchaDetectedError(url);

    if ((res.status >= 500 || res.status === 429) && attempt < maxRetries) {
      await sleep(backoffBase * 2 ** attempt + Math.random() * BACKOFF_JITTER_MS);
      continue;
    }
    if (!res.ok) throw new Error(`${url} respondió HTTP ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const body = buffer.toString(opts.decodeAs === "latin1" ? "latin1" : "utf8");
    if (isChallenge(res, body)) throw new EoirCaptchaDetectedError(url);
    return body;
  }
}
