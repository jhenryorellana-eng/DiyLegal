/**
 * Catálogo único de error kinds y su mapeo a HTTP status (doc 07 §2).
 *
 * El cliente decide por `kind`, no por el status crudo (doc 07 §1) y traduce cada
 * kind a un mensaje sin jerga técnica (doc 04, doc 05 §6). Mantener sincronizado
 * con la tabla del doc 07 §2.
 */
export const ERROR_KINDS = [
  "ConfigMissing", // 503 — flag apagado / falta env
  "ValidationError", // 400 — body/query inválidos (Zod)
  "BackendUnavailable", // 502 — fuente externa caída
  "InvalidInput", // 400 — EOIR: A-Number / nacionalidad
  "CaseNotFound", // 404 — EOIR/USCIS/NVC: no existe
  "CaptchaInvalid", // 401 — EOIR: token hCaptcha rechazado (doc 09 §4)
  "RateLimited", // 429 — límite de fuente o de usuario (+ Retry-After)
  "SchemaError", // 500 — respuesta externa no valida contra Zod
  "Unauthorized", // 401 — USCIS Torch / sesión
  "ReceiptNotFound", // 404 — USCIS Torch
  "Unknown", // 500 — no clasificado
] as const;

export type ErrorKind = (typeof ERROR_KINDS)[number];

/** Mapeo kind → HTTP status (doc 07 §2). */
export const ERROR_STATUS: Record<ErrorKind, number> = {
  ConfigMissing: 503,
  ValidationError: 400,
  BackendUnavailable: 502,
  InvalidInput: 400,
  CaseNotFound: 404,
  CaptchaInvalid: 401,
  RateLimited: 429,
  SchemaError: 500,
  Unauthorized: 401,
  ReceiptNotFound: 404,
  Unknown: 500,
};

export function statusForKind(kind: ErrorKind): number {
  return ERROR_STATUS[kind];
}
