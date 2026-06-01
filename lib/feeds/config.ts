/**
 * Feature flags de la Capa B (integración de datos) y configuración compartida
 * de feeds (doc 06 §4-5, doc 09 §2).
 *
 * Toda fuente nace en `false`; se enciende con la env var en "true" o "1".
 * Esto habilita rollout gradual y kill switch por fuente (doc 12).
 */

export function flag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  return raw === "true" || raw === "1";
}

/** Mapa lógico → nombre de env var de cada fuente de la Capa B. */
export const FEEDS_FLAGS = {
  federalRegister: "FEEDS_ENABLE_FEDERAL_REGISTER",
  travelAdvisories: "FEEDS_ENABLE_TRAVEL_ADVISORIES",
  visaBulletin: "FEEDS_ENABLE_VISA_BULLETIN",
  feeSchedule: "FEEDS_ENABLE_FEE_SCHEDULE",
  processingTimes: "FEEDS_ENABLE_PROCESSING_TIMES",
  civics: "FEEDS_ENABLE_CIVICS",
  vaccines: "FEEDS_ENABLE_VACCINES",
  dmv: "FEEDS_ENABLE_DMV",
  realId: "FEEDS_ENABLE_REAL_ID",
  itin: "FEEDS_ENABLE_ITIN",
  selectiveService: "FEEDS_ENABLE_SELECTIVE_SERVICE",
  i94: "FEEDS_ENABLE_I94",
  legalAid: "FEEDS_ENABLE_LEGAL_AID",
  countryReports: "FEEDS_ENABLE_COUNTRY_REPORTS",
  nvcCeac: "FEEDS_ENABLE_NVC_CEAC",
} as const;

export type FeedFlagKey = keyof typeof FEEDS_FLAGS;

/** ¿Está habilitada esta fuente de la Capa B? */
export function feedEnabled(key: FeedFlagKey): boolean {
  return flag(FEEDS_FLAGS[key]);
}

/**
 * Configuración compartida de obtención de feeds.
 * `rateLimitMsByHost`: límite de cortesía entre requests por host para `eoirFetch`
 * (doc 09 §2). Se consume a partir de la Fase 1.
 */
export const FEEDS_CONFIG = {
  rateLimitMsByHost: {
    "justice.gov": 2000,
    "tracreports.org": 3000,
  } as Record<string, number>,
} as const;
