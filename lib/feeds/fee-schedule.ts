import { fetchPdfText } from "@/lib/feeds/pdf";

/**
 * Fee Schedule G-1055 (doc 09 §9). EXACTITUD CRÍTICA (RNF-OPS-04, doc 10):
 * `feeLines` son las líneas LITERALES del PDF que mencionan el formulario —
 * está PROHIBIDO simplificar, reformatear u omitir dígitos. La UI muestra el
 * aviso "confirma el monto exacto". Aquí NO se usa Gemini (alteraría dígitos):
 * se parsea el PDF oficial real con pdf-parse.
 *
 * Nota: pdf-parse v2 también expone `getTable()` (tablas estructuradas, 57
 * páginas) — mejora futura para delimitar el bloque exacto de cada formulario.
 */

export const G1055_URL = "https://www.uscis.gov/sites/default/files/document/forms/g-1055.pdf";

/** Cachea el TEXTO del PDF (el formulario es un query); lo refresca el cron. */
export const FEE_SCHEDULE_CACHE = "fee-schedule-text";

export interface FeeScheduleResult {
  form: string;
  feeLines: string[];
  source: string;
}

/**
 * Devuelve las líneas literales del PDF que mencionan el formulario (sin alterar
 * dígitos ni formato). El código se compara con límite de palabra y guion opcional.
 */
export function extractFeeLines(pdfText: string, form: string): string[] {
  const code = form.trim().toUpperCase();
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  return pdfText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && re.test(line));
}

export function buildFeeResult(pdfText: string, form: string): FeeScheduleResult {
  return {
    form: form.trim().toUpperCase(),
    feeLines: extractFeeLines(pdfText, form),
    source: G1055_URL,
  };
}

/** Descarga el G-1055 y devuelve su texto. */
export async function fetchFeeScheduleText(): Promise<string> {
  return fetchPdfText(G1055_URL);
}
