import * as cheerio from "cheerio";
import { z } from "zod";
import { eoirFetch } from "@/lib/eoir/court-intelligence/scrapers/http-client";

/**
 * Ayuda legal gratuita / pro bono (doc 09 §12, doc 01 §4).
 * Fuente: `immigrationlawhelp.org/search?state=XX` (HTML, sin API) → cheerio.
 * Selectores VERIFICADOS contra el HTML real: `.directory-organization-summary`
 * con `h4 a` (nombre + detalle) y una tabla `td.label` → `td` (valor).
 *
 * Cache en memoria 1h por estado (doc §12): el scraping es costoso/lento, así que
 * NO se golpea la fuente en cada request. Si la fuente cae, se sirve el último
 * cache (stale); sin cache → el endpoint responde 502.
 */

const BASE_URL = "https://www.immigrationlawhelp.org";
const SEARCH_PATH = "/search?state=";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

const LABEL_AREAS = "Areas of legal assistance";
const LABEL_TYPES = "Types of legal assistance";
const LABEL_LOCATION = "Location";
const LABEL_CONTACT = "Contact";
const PHONE_RE = /\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/;

const LegalAidOrgSchema = z.object({
  name: z.string(),
  detailUrl: z.string().nullable(),
  location: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  email: z.string().nullable(),
  areasOfAssistance: z.array(z.string()),
  typesOfAssistance: z.array(z.string()),
});

export const LegalAidResultSchema = z.object({
  state: z.string(),
  count: z.number(),
  source: z.string(),
  organizations: z.array(LegalAidOrgSchema),
});

export type LegalAidOrg = z.infer<typeof LegalAidOrgSchema>;
export type LegalAidResult = z.infer<typeof LegalAidResultSchema>;

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Divide una lista CSV ("A, B, C") en items; tolera vacío. */
function splitList(text: string): string[] {
  return clean(text)
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Extrae teléfono (del texto), web (href http) y email (href mailto). Puro. */
function parseContact(
  text: string,
  hrefs: string[],
): { phone: string | null; website: string | null; email: string | null } {
  const phoneMatch = text.match(PHONE_RE);
  let website: string | null = null;
  let email: string | null = null;
  for (const href of hrefs) {
    if (href.toLowerCase().startsWith("mailto:")) {
      if (!email) email = href.slice("mailto:".length) || null;
    } else if (/^https?:\/\//i.test(href) && !website) {
      website = href;
    }
  }
  return { phone: phoneMatch ? phoneMatch[0].trim() : null, website, email };
}

/** Parsea el HTML del directorio a la lista de organizaciones (puro, testeable). */
export function parseLegalAid(html: string, state: string): LegalAidResult {
  const $ = cheerio.load(html);
  const key = state.toUpperCase();

  const organizations = $(".directory-organization-summary")
    .map((_, el) => {
      const $el = $(el);
      const link = $el.find("h4 a").first();
      const detailHref = link.attr("href");
      const org: LegalAidOrg = {
        name: clean(link.text()),
        detailUrl: detailHref ? new URL(detailHref, BASE_URL).toString() : null,
        location: null,
        phone: null,
        website: null,
        email: null,
        areasOfAssistance: [],
        typesOfAssistance: [],
      };

      $el.find("table tr").each((__, tr) => {
        const $tr = $(tr);
        const label = clean($tr.find("td.label").first().text()).replace(/:$/, "");
        if (!label) return;
        const $value = $tr.find("td").not(".label").first();
        if (label === LABEL_AREAS) org.areasOfAssistance = splitList($value.text());
        else if (label === LABEL_TYPES) org.typesOfAssistance = splitList($value.text());
        else if (label === LABEL_LOCATION) org.location = clean($value.text()) || null;
        else if (label === LABEL_CONTACT) {
          const hrefs = $value
            .find("a")
            .map((___, a) => $(a).attr("href") ?? "")
            .get();
          Object.assign(org, parseContact($value.text(), hrefs));
        }
      });

      return org;
    })
    .get();

  return LegalAidResultSchema.parse({
    state: key,
    count: organizations.length,
    source: `${BASE_URL}${SEARCH_PATH}${key}`,
    organizations,
  });
}

interface CacheEntry {
  fetchedAt: number;
  data: LegalAidResult;
}
const memoryCache = new Map<string, CacheEntry>();

export interface LegalAidLookup {
  result: LegalAidResult;
  stale: boolean;
}

/** Obtiene la ayuda legal del estado, con cache en memoria 1h + fallback stale. */
export async function getLegalAid(state: string): Promise<LegalAidLookup> {
  const key = state.toUpperCase();
  const hit = memoryCache.get(key);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return { result: hit.data, stale: false };
  }
  try {
    const html = await eoirFetch(`${BASE_URL}${SEARCH_PATH}${key}`);
    const data = parseLegalAid(html, key);
    memoryCache.set(key, { fetchedAt: Date.now(), data });
    return { result: data, stale: false };
  } catch (error) {
    if (hit) return { result: hit.data, stale: true };
    throw error;
  }
}

/** Limpia el cache en memoria. Solo para tests. */
export function __clearLegalAidCache(): void {
  memoryCache.clear();
}
