import { z } from "zod";

/**
 * USCIS Processing Times — superficie pura de lectura (doc 09 §7).
 *
 * Fuente: mirror diario `jzebedee/uscis` (un GitHub Action publica un SQLite por
 * release), porque `egov.uscis.gov/processing-times/api/*` responde 403
 * `Cf-Mitigated: challenge` (Cloudflare). El SQLite SOLO se lee en `sync.ts`
 * (node:sqlite, dynamic import); en runtime se sirve el JSON volcado → portable.
 *
 * Este módulo NO importa `node:sqlite` ni red: contiene los schemas, los tipos y
 * la lógica pura (`buildProcessingTimesData`, `lookupProcessingTime`). Por eso el
 * endpoint de lectura puede importarlo sin arrastrar el módulo nativo.
 *
 * EXACTITUD (RNF-OPS-04, doc 10): los plazos son datos sensibles. Se preservan
 * los valores y unidades EXACTOS de la fuente, sin interpretar ni colapsar. La
 * fuente real publica `range_lower_unit`/`range_upper_unit` POR SEPARADO y a
 * veces DIFIEREN (p. ej. "Days"/"Months", "Weeks"/"Months") o no son numéricas
 * ("See notes"/"learn more." con valor `null`). Por eso exponemos `lowerUnit` y
 * `upperUnit` distintos en vez del `unit` único que sugería el doc 09 §7.
 */

/** Nombre del cache JSON (lo escribe `sync.ts`; lo lee el endpoint). */
export const PROCESSING_TIMES_CACHE = "processing-times-cache";

// --- Schemas del cache (validación en el borde de lectura, doc 07 §1) --------

const ProcessingFormSchema = z.object({
  name: z.string(),
  descriptionEn: z.string().nullable(),
  descriptionEs: z.string().nullable(),
});

const ProcessingOfficeSchema = z.object({
  code: z.string(),
  description: z.string().nullable(),
});

const ProcessingTimeRowSchema = z.object({
  formName: z.string(),
  officeCode: z.string(),
  subtype: z.string(),
  publicationDate: z.string().nullable(),
  lower: z.number().nullable(),
  upper: z.number().nullable(),
  lowerUnit: z.string().nullable(),
  upperUnit: z.string().nullable(),
  serviceRequestDate: z.string().nullable(),
  subtypeInfoEn: z.string().nullable(),
  subtypeInfoEs: z.string().nullable(),
});

export const ProcessingTimesDataSchema = z.object({
  release: z.string(),
  source: z.string(),
  forms: z.array(ProcessingFormSchema),
  offices: z.array(ProcessingOfficeSchema),
  times: z.array(ProcessingTimeRowSchema),
});

export type ProcessingForm = z.infer<typeof ProcessingFormSchema>;
export type ProcessingOffice = z.infer<typeof ProcessingOfficeSchema>;
export type ProcessingTimeRow = z.infer<typeof ProcessingTimeRowSchema>;
export type ProcessingTimesData = z.infer<typeof ProcessingTimesDataSchema>;

// --- Forma de la respuesta del endpoint (doc 09 §7) --------------------------

export interface ProcessingTimeOffice {
  office: string;
  officeName: string | null;
  subtype: string;
  subtypeInfoEn: string | null;
  subtypeInfoEs: string | null;
  lower: number | null;
  upper: number | null;
  lowerUnit: string | null;
  upperUnit: string | null;
  serviceRequestDate: string | null;
}

export interface ProcessingTimesResult {
  form: string;
  formName: { en: string | null; es: string | null };
  release: string;
  publicationDate: string | null;
  offices: ProcessingTimeOffice[];
}

// --- Transformación pura: filas crudas del SQLite → cache (sin node:sqlite) ---

type RawRow = Record<string, unknown>;

function strOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

export interface RawProcessingRows {
  forms: RawRow[];
  offices: RawRow[];
  times: RawRow[];
}

/**
 * Mapea las filas crudas (columnas snake_case del mirror) al cache camelCase.
 * Preserva `null` (lower/upper/units pueden faltar) sin inventar valores.
 */
export function buildProcessingTimesData(
  release: string,
  source: string,
  raw: RawProcessingRows,
): ProcessingTimesData {
  return {
    release,
    source,
    forms: raw.forms.map((r) => ({
      name: String(r.name),
      descriptionEn: strOrNull(r.description_en),
      descriptionEs: strOrNull(r.description_es),
    })),
    offices: raw.offices.map((r) => ({
      code: String(r.code),
      description: strOrNull(r.description),
    })),
    times: raw.times.map((r) => ({
      formName: String(r.form_name),
      officeCode: String(r.office_code),
      subtype: String(r.form_subtype ?? ""),
      publicationDate: strOrNull(r.publication_date),
      lower: numOrNull(r.range_lower),
      upper: numOrNull(r.range_upper),
      lowerUnit: strOrNull(r.range_lower_unit),
      upperUnit: strOrNull(r.range_upper_unit),
      serviceRequestDate: strOrNull(r.service_request_date),
      subtypeInfoEn: strOrNull(r.subtype_info_en),
      subtypeInfoEs: strOrNull(r.subtype_info_es),
    })),
  };
}

// --- Consulta pura sobre el cache --------------------------------------------

/**
 * Devuelve los plazos del formulario (opcionalmente filtrados por oficina).
 * `form`/`office` se normalizan a mayúsculas. Si no hay coincidencias, `offices`
 * queda vacío (no es un error: USCIS simplemente no publica ese plazo).
 */
export function lookupProcessingTime(
  data: ProcessingTimesData,
  form: string,
  office?: string,
): ProcessingTimesResult {
  const formCode = form.trim().toUpperCase();
  const officeCode = office?.trim().toUpperCase();
  const officeNames = new Map(data.offices.map((o) => [o.code.toUpperCase(), o.description]));

  const matches = data.times
    .filter((t) => t.formName.toUpperCase() === formCode)
    .filter((t) => officeCode === undefined || t.officeCode.toUpperCase() === officeCode)
    .sort((a, b) => a.officeCode.localeCompare(b.officeCode) || a.subtype.localeCompare(b.subtype));

  const formMeta = data.forms.find((f) => f.name.toUpperCase() === formCode);

  return {
    form: formCode,
    formName: { en: formMeta?.descriptionEn ?? null, es: formMeta?.descriptionEs ?? null },
    release: data.release,
    publicationDate: matches[0]?.publicationDate ?? null,
    offices: matches.map((t) => ({
      office: t.officeCode,
      officeName: officeNames.get(t.officeCode.toUpperCase()) ?? null,
      subtype: t.subtype,
      subtypeInfoEn: t.subtypeInfoEn,
      subtypeInfoEs: t.subtypeInfoEs,
      lower: t.lower,
      upper: t.upper,
      lowerUnit: t.lowerUnit,
      upperUnit: t.upperUnit,
      serviceRequestDate: t.serviceRequestDate,
    })),
  };
}
