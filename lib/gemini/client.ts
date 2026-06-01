import { z } from "zod";

/**
 * Cliente Gemini vía REST (doc 09 §3.5). Se usa REST en vez del SDK
 * `@google/generative-ai` (EOL). Soporta grounding (búsqueda web) para obtener
 * datos oficiales actualizados sin alucinar.
 *
 * Modelos: `gemini-2.5-flash` (free tier, con grounding) para extracción de datos;
 * `gemini-2.5-pro` (requiere billing) para mociones AAF (Fase 2). La key
 * (GEMINI_API_KEY) es server-side (.env.local), nunca al cliente ni al repo.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const GEMINI_FLASH = "gemini-2.5-flash";
export const GEMINI_PRO = "gemini-2.5-pro";

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no está configurada");
  return key;
}

export interface GeminiOptions {
  model?: string;
  /** Activa la herramienta google_search (datos en vivo). */
  grounded?: boolean;
  temperature?: number;
  /** Pide responseMimeType JSON (incompatible con grounded; se ignora si grounded). */
  json?: boolean;
  /** Límite de tokens de salida (subir para respuestas grandes, p. ej. civics). */
  maxOutputTokens?: number;
}

/** Genera texto con Gemini. Lanza si falta la key o si HTTP no-ok. */
export async function geminiGenerate(prompt: string, options: GeminiOptions = {}): Promise<string> {
  const model = options.model ?? GEMINI_FLASH;
  const generationConfig: Record<string, unknown> = { temperature: options.temperature ?? 0.2 };
  if (options.json && !options.grounded) {
    generationConfig.responseMimeType = "application/json";
  }
  if (options.maxOutputTokens) {
    generationConfig.maxOutputTokens = options.maxOutputTokens;
  }
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig,
  };
  if (options.grounded) body.tools = [{ google_search: {} }];

  const res = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data: unknown = await res.json();
  const text = readText(data);
  if (!text) throw new Error("Gemini devolvió una respuesta vacía");
  return text;
}

function readText(data: unknown): string {
  const parts =
    (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]
      ?.content?.parts ?? [];
  return parts
    .map((p) => p.text)
    .filter((t): t is string => Boolean(t))
    .join("");
}

/**
 * Extrae y parsea JSON de la respuesta del modelo, tolerando fences ```json y
 * prosa alrededor (frecuente con grounding).
 */
export function extractJson<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const fencedContent = fenced?.[1];
  let raw = (fencedContent ?? text).trim();
  if (fencedContent === undefined) {
    const firstObj = raw.indexOf("{");
    const firstArr = raw.indexOf("[");
    const start =
      firstArr === -1 ? firstObj : firstObj === -1 ? firstArr : Math.min(firstObj, firstArr);
    const openChar = start >= 0 ? raw[start] : undefined;
    if (openChar !== undefined && start > 0) {
      const close = openChar === "{" ? "}" : "]";
      const end = raw.lastIndexOf(close);
      if (end > start) raw = raw.slice(start, end + 1);
    }
  }
  return JSON.parse(raw) as T;
}

/** Genera con Gemini, extrae el JSON y lo valida con un schema Zod. */
export async function geminiJson<T>(
  prompt: string,
  schema: z.ZodType<T>,
  options: GeminiOptions = {},
): Promise<T> {
  const text = await geminiGenerate(prompt, options);
  return schema.parse(extractJson(text));
}
