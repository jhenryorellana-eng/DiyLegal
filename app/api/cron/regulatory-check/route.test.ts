import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feeds/cache", () => ({ saveCache: vi.fn() }));
vi.mock("@/lib/gemini/client", () => ({ geminiJson: vi.fn(), GEMINI_FLASH: "gemini-2.5-flash" }));

import { GET } from "@/app/api/cron/regulatory-check/route";
import { geminiJson } from "@/lib/gemini/client";

const SECRET = "cron-secret";
const FLAG = "AAF_ENABLE_REGULATORY_CHECK";
const env = { ...process.env };

beforeEach(() => {
  process.env.INTERNAL_CRON_SECRET = SECRET;
  process.env[FLAG] = "true";
});
afterEach(() => {
  process.env = { ...env };
  vi.mocked(geminiJson).mockReset();
});

function get(bearer?: string): Promise<Response> {
  const headers = bearer ? { authorization: `Bearer ${bearer}` } : undefined;
  return GET(new Request("https://x.test/api/cron/regulatory-check", { headers }));
}

describe("GET /api/cron/regulatory-check", () => {
  it("401 si el bearer no coincide", async () => {
    expect((await get("wrong")).status).toBe(401);
  });

  it("503 si el flag está apagado", async () => {
    process.env[FLAG] = "false";
    expect((await get(SECRET)).status).toBe(503);
  });

  it("200 y persiste el snapshot cuando autoriza + flag on", async () => {
    vi.mocked(geminiJson).mockResolvedValue({
      amountCents: 10_200,
      fiscalYear: 2026,
      effectiveDate: "2025-10-01",
      pauses: [],
      sources: [{ title: "FR", url: "https://federalregister.gov/a" }],
    });
    const res = await get(SECRET);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.synced).toBe(true);
    expect(body.data.amountCents).toBe(10_200);
  });

  it("502 si Gemini falla", async () => {
    vi.mocked(geminiJson).mockRejectedValue(new Error("429"));
    expect((await get(SECRET)).status).toBe(502);
  });
});
