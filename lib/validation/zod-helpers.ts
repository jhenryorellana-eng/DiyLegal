import { z } from "zod";
import { type ApiError, err } from "@/lib/http/response";

/**
 * Helpers de validación con Zod en el borde de la API (doc 06 §5, doc 07 §1).
 * Un fallo de validación se traduce a un `ApiError` `ValidationError` (400).
 */

export type ParseResult<T> = { success: true; data: T } | { success: false; error: ApiError };

export function parseWith<T>(schema: z.ZodType<T>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const message = result.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  return { success: false, error: err("ValidationError", message) };
}

/** Convierte `URLSearchParams` en un objeto plano para validar con Zod. */
export function searchParamsToObject(searchParams: URLSearchParams): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    obj[key] = value;
  }
  return obj;
}
