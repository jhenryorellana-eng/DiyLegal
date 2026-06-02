import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feeds/cache", () => ({ loadCache: vi.fn(), saveCache: vi.fn() }));
vi.mock("@/lib/feeds/pdf", () => ({ fetchPdfText: vi.fn() }));

import { GET } from "@/app/api/cron/icpm-check/route";
import { loadCache } from "@/lib/feeds/cache";
import { fetchPdfText } from "@/lib/feeds/pdf";

const SECRET = "cron-secret";
const FLAG = "AAF_ENABLE_ICPM_GROUNDING";
const env = { ...process.env };

beforeEach(() => {
  process.env.INTERNAL_CRON_SECRET = SECRET;
  process.env[FLAG] = "true";
});
afterEach(() => {
  process.env = { ...env };
  vi.mocked(loadCache).mockReset();
  vi.mocked(fetchPdfText).mockReset();
});

function get(bearer?: string): Promise<Response> {
  const headers = bearer ? { authorization: `Bearer ${bearer}` } : undefined;
  return GET(new Request("https://x.test/api/cron/icpm-check", { headers }));
}

describe("GET /api/cron/icpm-check", () => {
  it("401 si el bearer no coincide", async () => {
    expect((await get("wrong")).status).toBe(401);
  });

  it("503 si el flag está apagado", async () => {
    process.env[FLAG] = "false";
    expect((await get(SECRET)).status).toBe(503);
  });

  it("200 descarga y persiste el cache", async () => {
    vi.mocked(loadCache).mockResolvedValue(null);
    vi.mocked(fetchPdfText).mockResolvedValue("ICPM full text");
    const res = await get(SECRET);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.synced).toBe(true);
    expect(body.data.changed).toBeGreaterThanOrEqual(1);
  });

  it("502 si la descarga falla", async () => {
    vi.mocked(loadCache).mockResolvedValue(null);
    vi.mocked(fetchPdfText).mockRejectedValue(new Error("PDF HTTP 503"));
    expect((await get(SECRET)).status).toBe(502);
  });
});
