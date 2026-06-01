import { z } from "zod";
import { feedEnabled } from "@/lib/feeds/config";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";
import { parseWith, searchParamsToObject } from "@/lib/validation/zod-helpers";

/**
 * GET /api/static/civics — examen de ciudadanía (doc 07 §4.5, doc 02 §civics).
 *
 * STUB de la Fase 0: ejercita el patrón transversal completo en miniatura
 *   flag (503) → Zod (400) → {ok,data} (200)
 * antes de replicarlo a las ~15 fuentes. Los pools reales (2008 = 100 q,
 * 2025 = 128 q) y el builder de datos llegan en la Fase 1.
 */
export const runtime = "nodejs";

const QuerySchema = z.object({
  version: z.enum(["2008", "2025"]).optional(),
  filingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado YYYY-MM-DD")
    .optional(),
});

const CIVICS_STUB = {
  version: "2025",
  totalQuestions: 128,
  questions: [] as { id: number; question: string; answers: string[] }[],
  note: "stub-fase-0",
} as const;

export async function GET(request: Request): Promise<Response> {
  if (!feedEnabled("civics")) {
    return jsonErr("ConfigMissing", "La función civics no está habilitada todavía");
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseWith(QuerySchema, searchParamsToObject(searchParams));
  if (!parsed.success) {
    return jsonFrom(parsed.error);
  }

  return jsonOk(CIVICS_STUB);
}
