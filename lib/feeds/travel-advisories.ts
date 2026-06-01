import { z } from "zod";

/**
 * Travel Advisories del Departamento de Estado (doc 09 §9, off por defecto).
 * API JSON oficial; REQUIERE User-Agent de navegador (gotcha del doc). El nivel
 * 1-4 se DERIVA del campo `Title` ("... - Level N: ..."). Datos en vivo.
 * Schema derivado de la respuesta real (inspeccionada, no inventada).
 */

const API_URL = "https://cadataapi.state.gov/api/TravelAdvisories";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const RawAdvisorySchema = z.object({
  Title: z.string(),
  Link: z.string(),
  Category: z.array(z.string()).nullish(),
  Summary: z.string().nullish(),
  Published: z.string().nullish(),
  Updated: z.string().nullish(),
});

const RawResponseSchema = z.array(RawAdvisorySchema);

export interface TravelAdvisory {
  country: string;
  /** Nivel 1-4 derivado del Title, o null si el Title no lo incluye. */
  level: number | null;
  title: string;
  link: string;
  category: string[];
  /** Resumen tal cual lo publica la fuente (puede contener HTML). */
  summary: string | null;
  published: string | null;
  updated: string | null;
}

export interface TravelAdvisoriesResult {
  count: number;
  results: TravelAdvisory[];
}

/** Extrae el nivel 1-4 del Title ("... - Level 2: ..."), o null. */
export function extractLevel(title: string): number | null {
  const match = title.match(/Level\s+([1-4])/i);
  return match ? Number(match[1]) : null;
}

/** Extrae el nombre del país del Title (texto antes de " - Level"). */
export function extractCountry(title: string): string {
  const idx = title.indexOf(" - Level");
  return idx > 0 ? title.slice(0, idx).trim() : title.trim();
}

function mapAdvisory(a: z.infer<typeof RawAdvisorySchema>): TravelAdvisory {
  return {
    country: extractCountry(a.Title),
    level: extractLevel(a.Title),
    title: a.Title,
    link: a.Link,
    category: a.Category ?? [],
    summary: a.Summary ?? null,
    published: a.Published ?? null,
    updated: a.Updated ?? null,
  };
}

/** Valida y normaliza la respuesta cruda (puro; testeable con fixture). */
export function parseTravelAdvisories(raw: unknown): TravelAdvisory[] {
  return RawResponseSchema.parse(raw).map(mapAdvisory);
}

/** Filtra por país: coincide con un código de Category o con el nombre. */
export function filterByCountry(items: TravelAdvisory[], country: string): TravelAdvisory[] {
  const needle = country.toLowerCase();
  return items.filter(
    (a) =>
      a.category.some((c) => c.toLowerCase() === needle) ||
      a.country.toLowerCase().includes(needle),
  );
}

/** Consulta la API en vivo (con UA de navegador). Lanza si HTTP no-ok o no valida. */
export async function fetchTravelAdvisories(): Promise<TravelAdvisory[]> {
  const res = await fetch(API_URL, {
    headers: { "user-agent": BROWSER_UA, accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Travel Advisories respondió HTTP ${res.status}`);
  }
  return parseTravelAdvisories(await res.json());
}

export const TRAVEL_ADVISORIES_CACHE = "travel-advisories-cache";
