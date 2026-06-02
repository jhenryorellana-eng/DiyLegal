import { z } from "zod";

/**
 * Tipos y schemas Zod de Court Intelligence (doc 09 §8).
 * Compartidos por los scrapers (operational-status, court-details, judge-stats),
 * la persistencia y los endpoints `/api/eoir/*`.
 */

export const CourtAddressSchema = z.object({
  line1: z.string().nullable(),
  line2: z.string().nullable(),
  locality: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
});

/** Estado operativo de una corte (tabla maestra justice.gov). */
export const CourtStatusSchema = z.object({
  name: z.string(),
  slug: z.string(),
  detailUrl: z.string(),
  status: z.string(),
  closed: z.boolean(),
  address: CourtAddressSchema,
});

export const CourtStatusListSchema = z.array(CourtStatusSchema);

export type CourtAddress = z.infer<typeof CourtAddressSchema>;
export type CourtStatus = z.infer<typeof CourtStatusSchema>;

/** Detalle de una corte (página justice.gov/eoir/<slug>). */
export const CourtDetailsSchema = z.object({
  slug: z.string(),
  name: z.string(),
  address: z.array(z.string()),
  phone: z.string().nullable(),
  emails: z.array(z.string()),
  assistantChiefImmigrationJudge: z.string().nullable(),
  courtAdministrator: z.string().nullable(),
  immigrationJudges: z.array(z.string()),
  source: z.string(),
});

export type CourtDetails = z.infer<typeof CourtDetailsSchema>;

/** Estadísticas de asilo por juez (TRAC). `code`/`baseCityCode` del enlace real. */
export const JudgeStatsSchema = z.object({
  code: z.string(),
  judge: z.string(),
  court: z.string(),
  baseCityCode: z.string(),
  totalDecisions: z.number(),
  grantedAsylumPct: z.number().nullable(),
  grantedOtherReliefPct: z.number().nullable(),
  deniedPct: z.number().nullable(),
  profileUrl: z.string(),
});

export const JudgeStatsListSchema = z.array(JudgeStatsSchema);

export type JudgeStats = z.infer<typeof JudgeStatsSchema>;
