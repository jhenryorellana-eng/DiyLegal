import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feeds/cache", () => ({ loadCache: vi.fn() }));
vi.mock("@/lib/gemini/client", () => ({ geminiJson: vi.fn(), GEMINI_PRO: "gemini-2.5-pro" }));

import { POST } from "@/app/api/aaf/validate/route";
import { loadCache } from "@/lib/feeds/cache";
import { geminiJson } from "@/lib/gemini/client";
import { clearResponseCache } from "@/lib/gemini/response-cache";

const FLAG = "AAF_ENABLE_GEMINI";
const original = process.env[FLAG];

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("https://x.test/api/aaf/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

afterEach(() => {
  if (original === undefined) delete process.env[FLAG];
  else process.env[FLAG] = original;
  vi.mocked(loadCache).mockReset();
  vi.mocked(geminiJson).mockReset();
  clearResponseCache();
});

describe("POST /api/aaf/validate (flag AAF_ENABLE_GEMINI)", () => {
  it("503 con el flag apagado", async () => {
    delete process.env[FLAG];
    expect((await post({ filingDate: "2025-03-10", venue: "USCIS_affirmative" })).status).toBe(503);
  });

  it("200 con fallback valid cuando Gemini no está disponible", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue(null);
    vi.mocked(geminiJson).mockRejectedValue(new Error("no billing"));
    const res = await post({
      filingDate: "2025-03-10",
      venue: "USCIS_affirmative",
      asOf: "2026-04-01",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.validation.fromFallback).toBe(true);
    expect(body.data.validation.valid).toBe(true);
    expect(body.data.result.branch).toBe("A");
  });
});
