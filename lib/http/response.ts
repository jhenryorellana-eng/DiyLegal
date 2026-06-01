import { type ErrorKind, statusForKind } from "@/lib/http/errors";

/**
 * Contrato de respuesta uniforme de la API (doc 00 §convenciones, doc 07 §1):
 *   éxito → { ok: true, data }
 *   error → { ok: false, error: { kind, message? } }
 *
 * Se usa `Response` web-estándar (no `NextResponse`) para que la infraestructura
 * sea agnóstica del framework y trivialmente testeable. Los route handlers de Next
 * pueden devolver `Response` directamente.
 */

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: { kind: ErrorKind; message?: string };
}

export type ApiResponse<T> = ApiOk<T> | ApiError;

/** Construye el sobre de éxito (puro, sin tocar HTTP). */
export function ok<T>(data: T): ApiOk<T> {
  return { ok: true, data };
}

/** Construye el sobre de error (puro, sin tocar HTTP). */
export function err(kind: ErrorKind, message?: string): ApiError {
  return { ok: false, error: message ? { kind, message } : { kind } };
}

export interface JsonResponseOptions {
  /** Segundos para el header `Retry-After` (solo aplica a `RateLimited`). */
  retryAfter?: number;
  headers?: HeadersInit;
}

/** Respuesta HTTP de éxito (status 200 por defecto). */
export function jsonOk<T>(data: T, status = 200, options?: JsonResponseOptions): Response {
  return Response.json(ok(data), { status, headers: new Headers(options?.headers) });
}

/** Respuesta HTTP de error; el status sale del catálogo (doc 07 §2). */
export function jsonErr(
  kind: ErrorKind,
  message?: string,
  options?: JsonResponseOptions,
): Response {
  const headers = new Headers(options?.headers);
  if (kind === "RateLimited" && options?.retryAfter !== undefined) {
    headers.set("Retry-After", String(options.retryAfter));
  }
  return Response.json(err(kind, message), { status: statusForKind(kind), headers });
}

/** Convierte un sobre `ApiError` ya construido en una `Response`. */
export function jsonFrom(error: ApiError, options?: JsonResponseOptions): Response {
  return jsonErr(error.error.kind, error.error.message, options);
}
