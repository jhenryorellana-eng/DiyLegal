import * as cheerio from "cheerio";
import { eoirFetch } from "@/lib/eoir/court-intelligence/scrapers/http-client";
import { loadJudgeStats, saveJudgeStats } from "@/lib/eoir/court-intelligence/persistence/store";
import { JudgeStatsListSchema, type JudgeStats } from "@/lib/eoir/court-intelligence/types";

/**
 * Scraper de estadísticas de asilo por juez (doc 09 §8). TRAC:
 * `tracreports.org/immigration/reports/judgereports/` (ISO-8859-1 → latin1).
 *
 * Estructura real verificada: una tabla; la celda de la corte usa `rowspan`, por
 * lo que la 1ª fila de cada corte trae 6 celdas (corte incluida) y las siguientes
 * 5 (heredan la corte). La celda del juez es `a[href="<code>/index.html"]`; el
 * `code` (p. ej. `00347ADL`) termina en el base city code de la corte (`ADL`).
 * Columnas: Total Decisions, % Granted Asylum, % Granted Other Relief, % Denied.
 */

export const TRAC_JUDGE_REPORTS_URL = "https://tracreports.org/immigration/reports/judgereports/";

function clean(text: string): string {
  return text.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function toNumber(text: string): number | null {
  const value = Number.parseFloat(clean(text).replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

/** Parsea la tabla de TRAC (puro, testeable contra fixtures). */
export function parseTracJudgeStats(html: string): JudgeStats[] {
  const $ = cheerio.load(html);
  const judges: JudgeStats[] = [];
  let currentCourt = "";

  $("table tr").each((_, tr) => {
    const $tds = $(tr).find("td");
    const n = $tds.length;
    if (n !== 5 && n !== 6) return; // título/encabezado/separadores
    const offset = n === 6 ? 1 : 0;
    if (n === 6) currentCourt = clean($tds.eq(0).text());

    const link = $tds.eq(offset).find("a").first();
    const judge = clean(link.text());
    if (!judge) return;

    const href = link.attr("href") ?? "";
    const code = href.split("/")[0] ?? "";
    judges.push({
      code,
      judge,
      court: currentCourt,
      baseCityCode: (code.match(/[A-Za-z]+$/)?.[0] ?? "").toUpperCase(),
      totalDecisions: toNumber($tds.eq(offset + 1).text()) ?? 0,
      grantedAsylumPct: toNumber($tds.eq(offset + 2).text()),
      grantedOtherReliefPct: toNumber($tds.eq(offset + 3).text()),
      deniedPct: toNumber($tds.eq(offset + 4).text()),
      profileUrl: href ? new URL(href, TRAC_JUDGE_REPORTS_URL).toString() : "",
    });
  });

  return JudgeStatsListSchema.parse(judges);
}

/** Descarga (latin1) y parsea la tabla de jueces de TRAC. */
export async function fetchTracJudgeStats(): Promise<JudgeStats[]> {
  return parseTracJudgeStats(await eoirFetch(TRAC_JUDGE_REPORTS_URL, { decodeAs: "latin1" }));
}

/** Cache-first: sirve el snapshot persistido o, en frío, descarga y lo persiste. */
export async function getJudgeStats(): Promise<JudgeStats[]> {
  const cached = await loadJudgeStats();
  if (cached) return cached;
  const fresh = await fetchTracJudgeStats();
  await saveJudgeStats(fresh);
  return fresh;
}
