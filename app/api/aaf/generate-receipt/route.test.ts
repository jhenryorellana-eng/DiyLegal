import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feeds/cache", () => ({ loadCache: vi.fn() }));

import { POST } from "@/app/api/aaf/generate-receipt/route";
import { loadCache } from "@/lib/feeds/cache";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("https://x.test/api/aaf/generate-receipt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

afterEach(() => vi.mocked(loadCache).mockReset());

describe("POST /api/aaf/generate-receipt (core, PDF)", () => {
  it("400 si el body es inválido", async () => {
    expect((await post({ filingDate: "2025-03-10" })).status).toBe(400);
  });

  it("200 devuelve un PDF con metadata en headers", async () => {
    vi.mocked(loadCache).mockResolvedValue(null);
    const res = await post({
      filingDate: "2025-03-10",
      venue: "USCIS_affirmative",
      asOf: "2026-04-01",
      applicantName: "Jane Doe",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("x-aaf-branch")).toBe("A");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
