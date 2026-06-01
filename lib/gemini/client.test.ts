import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { extractJson, geminiGenerate, geminiJson } from "@/lib/gemini/client";

describe("extractJson — tolera fences y prosa", () => {
  it("parsea JSON crudo", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parsea JSON dentro de fences ```json", () => {
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });

  it("recorta prosa alrededor del objeto", () => {
    expect(extractJson('Aquí tienes: {"a":3} (según la fuente)')).toEqual({ a: 3 });
  });

  it("parsea arrays con prosa alrededor", () => {
    expect(extractJson("Resultado: [1,2,3] listo")).toEqual([1, 2, 3]);
  });
});

describe("geminiGenerate (REST mockeado)", () => {
  const original = process.env.GEMINI_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = original;
    vi.unstubAllGlobals();
  });

  function stubGemini(text: string, ok = true, status = 200) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok,
        status,
        json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
        text: async () => "error body",
      }),
    );
  }

  it("lanza si falta GEMINI_API_KEY", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(geminiGenerate("hola")).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it("devuelve el texto del candidato", async () => {
    process.env.GEMINI_API_KEY = "k";
    stubGemini("respuesta ok");
    expect(await geminiGenerate("hola")).toBe("respuesta ok");
  });

  it("lanza ante HTTP no-ok (p. ej. 429)", async () => {
    process.env.GEMINI_API_KEY = "k";
    stubGemini("", false, 429);
    await expect(geminiGenerate("hola")).rejects.toThrow(/429/);
  });

  it("geminiJson valida con Zod", async () => {
    process.env.GEMINI_API_KEY = "k";
    stubGemini('```json\n{"n":5}\n```');
    const schema = z.object({ n: z.number() });
    expect(await geminiJson("dame n", schema)).toEqual({ n: 5 });
  });
});
