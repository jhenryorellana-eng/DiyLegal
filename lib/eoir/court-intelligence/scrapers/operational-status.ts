import * as cheerio from "cheerio";
import { eoirFetch } from "@/lib/eoir/court-intelligence/scrapers/http-client";
import { CourtStatusListSchema, type CourtStatus } from "@/lib/eoir/court-intelligence/types";

/**
 * Scraper de estado operativo de cortes (doc 09 §8). Tabla maestra
 * `justice.gov/eoir/immigration-court-operational-status` vía `eoirFetch`.
 *
 * Estructura real verificada: una `table.usa-table`; por fila, celda 0 con
 * `a[href=/eoir/<slug>]` (nombre + detalle) y `p.address` con spans
 * (`.address-line1/2`, `.locality`, `.administrative-area`, `.postal-code`,
 * `.country`); celda 1 con el estado (`OPEN`, o texto largo que incluye `CLOSED`).
 */

export const OPERATIONAL_STATUS_URL =
  "https://www.justice.gov/eoir/immigration-court-operational-status";

function clean(text: string): string {
  return text.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function slugFromHref(href: string): string {
  try {
    return new URL(href, "https://www.justice.gov").pathname.split("/").filter(Boolean).pop() ?? "";
  } catch {
    return "";
  }
}

/** Parsea la tabla de estado operativo (puro, testeable contra fixtures). */
export function parseOperationalStatus(html: string): CourtStatus[] {
  const $ = cheerio.load(html);

  const courts = $("table.usa-table tr")
    .filter((_, tr) => $(tr).find("td").length >= 2)
    .map((_, tr) => {
      const $name = $(tr).find("td").eq(0);
      const link = $name.find("a").first();
      const href = link.attr("href") ?? "";
      const span = (sel: string): string | null => clean($name.find(sel).first().text()) || null;

      // Estado: une el texto de los nodos hoja (ignora `<p>&nbsp;</p>` vacíos).
      const $status = $(tr).find("td").eq(1);
      const parts = $status
        .find("p, div")
        .filter((__, el) => $(el).children("p, div").length === 0)
        .map((__, el) => clean($(el).text()))
        .get()
        .filter(Boolean);
      const status = parts.length ? parts.join(" ") : clean($status.text());

      return {
        name: clean(link.text()),
        slug: slugFromHref(href),
        detailUrl: href,
        status,
        closed: /\bclosed\b/i.test(status),
        address: {
          line1: span(".address-line1"),
          line2: span(".address-line2"),
          locality: span(".locality"),
          region: span(".administrative-area"),
          postalCode: span(".postal-code"),
          country: span(".country"),
        },
      };
    })
    .get()
    .filter((c) => c.name && c.slug);

  return CourtStatusListSchema.parse(courts);
}

/** Descarga y parsea la tabla maestra. */
export async function fetchOperationalStatus(): Promise<CourtStatus[]> {
  return parseOperationalStatus(await eoirFetch(OPERATIONAL_STATUS_URL));
}
