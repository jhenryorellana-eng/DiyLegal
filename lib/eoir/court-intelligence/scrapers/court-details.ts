import * as cheerio from "cheerio";
import { eoirFetch } from "@/lib/eoir/court-intelligence/scrapers/http-client";
import { CourtDetailsSchema, type CourtDetails } from "@/lib/eoir/court-intelligence/types";

/**
 * Scraper de detalle de corte (doc 09 §8). Página `justice.gov/eoir/<slug>`.
 *
 * Estructura real verificada: `h1` (nombre); secciones bajo headings `h2/h3`:
 * "Address" (`<p>` con `<br>`), "Contact the Court" (teléfono en prosa + mailto),
 * "Assistant Chief Immigration Judge", "Court Administrator", "Immigration Judges"
 * (`<ul><li>`).
 */

export const COURT_BASE_URL = "https://www.justice.gov/eoir/";
const PHONE_RE = /\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/;

function clean(text: string): string {
  return text.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/** Convierte un HTML con `<br>` en líneas limpias (puro). */
function brLines(html: string): string[] {
  const withNewlines = html.replace(/<br\s*\/?>/gi, "\n");
  return cheerio.load(`<x>${withNewlines}</x>`)("x").text().split("\n").map(clean).filter(Boolean);
}

/** Parsea el detalle de una corte (puro, testeable contra fixtures). */
export function parseCourtDetails(html: string, slug: string): CourtDetails {
  const $ = cheerio.load(html);
  const section = (label: string) =>
    $("h2, h3")
      .filter((_, el) => $(el).text().trim().replace(/\*$/, "").trim() === label)
      .first()
      .nextUntil("h2, h3");
  const sectionHtml = (label: string) =>
    section(label)
      .map((_, el) => $.html(el))
      .get()
      .join("");

  const phoneMatch = section("Contact the Court").text().match(PHONE_RE);
  const emails = [
    ...new Set(
      $("a[href^='mailto:']")
        .map((_, a) => ($(a).attr("href") ?? "").slice("mailto:".length).split("?")[0] ?? "")
        .get()
        .filter((e) => e.includes("@")),
    ),
  ];
  const judges = section("Immigration Judges")
    .find("li")
    .map((_, li) => clean($(li).text()))
    .get()
    .filter(Boolean);

  return CourtDetailsSchema.parse({
    slug,
    name: clean($("h1").first().text()),
    address: brLines(sectionHtml("Address")),
    phone: phoneMatch ? phoneMatch[0].trim() : null,
    emails,
    assistantChiefImmigrationJudge:
      clean(section("Assistant Chief Immigration Judge").text()) || null,
    courtAdministrator: clean(section("Court Administrator").text()) || null,
    immigrationJudges: judges,
    source: `${COURT_BASE_URL}${slug}`,
  });
}

/** Descarga y parsea el detalle de una corte por slug. */
export async function fetchCourtDetails(slug: string): Promise<CourtDetails> {
  return parseCourtDetails(await eoirFetch(`${COURT_BASE_URL}${slug}`), slug);
}
