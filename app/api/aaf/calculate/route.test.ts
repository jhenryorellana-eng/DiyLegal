import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feeds/cache", () => ({ loadCache: vi.fn(), saveCache: vi.fn() }));

import { POST } from "@/app/api/aaf/calculate/route";
import { loadCache } from "@/lib/feeds/cache";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("https://x.test/api/aaf/calculate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/aaf/calculate (core, sin flag)", () => {
  afterEach(() => vi.mocked(loadCache).mockReset());

  it("400 si falta venue", async () => {
    expect((await post({ filingDate: "2025-03-10" })).status).toBe(400);
  });

  it("400 si filingDate no es YYYY-MM-DD", async () => {
    expect((await post({ filingDate: "2025/03/10", venue: "USCIS_affirmative" })).status).toBe(400);
  });

  it("400 si el cuerpo no es JSON", async () => {
    expect((await post("no-json")).status).toBe(400);
  });

  it("200 con cálculo determinista (sin cache → semilla 10200¢)", async () => {
    vi.mocked(loadCache).mockResolvedValue(null);
    const res = await post({
      filingDate: "2025-03-10",
      venue: "USCIS_affirmative",
      asOf: "2026-04-01",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.branch).toBe("A");
    expect(body.data.amountCents).toBe(10_200);
    expect(body.data.aafStatus).toBe("overdue");
    expect(body.data.regulatory.fromCache).toBe(false);
  });
});
