import { z } from "zod";

/**
 * Federal Register — regulaciones recientes de USCIS (doc 09 §9, doc 02 §RF-REG).
 * API JSON pública oficial, SIN API key. Datos en vivo (no hardcodeados).
 * Schema derivado de la respuesta real de la API (inspeccionada, no inventada).
 */

const API_URL = "https://www.federalregister.gov/api/v1/documents.json";
const AGENCY_USCIS = "u-s-citizenship-and-immigration-services";
const DEFAULT_PER_PAGE = 20;

/** Campos que se piden a la API (acota el payload y fija el contrato). */
const FIELDS = [
  "title",
  "type",
  "abstract",
  "document_number",
  "html_url",
  "pdf_url",
  "publication_date",
  "agencies",
] as const;

const RawAgencySchema = z.object({
  name: z.string().nullish(),
  raw_name: z.string().nullish(),
});

const RawDocSchema = z.object({
  title: z.string(),
  type: z.string().nullish(),
  abstract: z.string().nullish(),
  document_number: z.string(),
  html_url: z.string(),
  pdf_url: z.string().nullish(),
  publication_date: z.string(),
  agencies: z.array(RawAgencySchema).nullish(),
});

const RawResponseSchema = z.object({
  count: z.number(),
  results: z.array(RawDocSchema),
});

export interface FederalRegisterDoc {
  documentNumber: string;
  title: string;
  type: string | null;
  abstract: string | null;
  htmlUrl: string;
  pdfUrl: string | null;
  publicationDate: string;
  agencies: string[];
}

export interface FederalRegisterResult {
  count: number;
  results: FederalRegisterDoc[];
}

export interface FederalRegisterQuery {
  term?: string;
  agency?: string;
  perPage?: number;
}

function mapDoc(d: z.infer<typeof RawDocSchema>): FederalRegisterDoc {
  return {
    documentNumber: d.document_number,
    title: d.title,
    type: d.type ?? null,
    abstract: d.abstract ?? null,
    htmlUrl: d.html_url,
    pdfUrl: d.pdf_url ?? null,
    publicationDate: d.publication_date,
    agencies: (d.agencies ?? [])
      .map((a) => a.name ?? a.raw_name ?? null)
      .filter((n): n is string => n !== null),
  };
}

/** Valida y normaliza la respuesta cruda de la API (puro; testeable con fixture). */
export function parseFederalRegister(raw: unknown): FederalRegisterResult {
  const parsed = RawResponseSchema.parse(raw);
  return { count: parsed.count, results: parsed.results.map(mapDoc) };
}

function buildUrl(query: FederalRegisterQuery): URL {
  const url = new URL(API_URL);
  url.searchParams.set("per_page", String(query.perPage ?? DEFAULT_PER_PAGE));
  url.searchParams.set("order", "newest");
  url.searchParams.append("conditions[agencies][]", query.agency ?? AGENCY_USCIS);
  if (query.term) url.searchParams.set("conditions[term]", query.term);
  for (const field of FIELDS) url.searchParams.append("fields[]", field);
  return url;
}

/** Consulta la API en vivo. Lanza si HTTP no-ok o la respuesta no valida. */
export async function fetchFederalRegister(
  query: FederalRegisterQuery = {},
): Promise<FederalRegisterResult> {
  const res = await fetch(buildUrl(query), { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Federal Register respondió HTTP ${res.status}`);
  }
  return parseFederalRegister(await res.json());
}

/** Nombre del cache base (lo mantiene el cron; el endpoint lo usa de fallback). */
export const FEDERAL_REGISTER_CACHE = "federal-register-cache";
