import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feeds/cache", () => ({ loadCache: vi.fn() }));

import { GET } from "@/app/api/aaf/regulatory/current/route";
import { SEED_REGULATORY } from "@/lib/aaf/regulatory";
import { loadCache } from "@/lib/feeds/cache";

const FLAG = "AAF_ENABLE_REGULATORY_CHECK";
const original = process.env[FLAG];

describe("GET /api/aaf/regulatory/current", () => {
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
    vi.mocked(loadCache).mockReset();
  });

  it("503 ConfigMissing con el flag apagado", async () => {
    delete process.env[FLAG];
    expect((await GET()).status).toBe(503);
  });

  it("200 con la semilla cuando no hay cache (fromCache=false)", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.amountCents).toBe(10_200);
    expect(body.data.fromCache).toBe(false);
  });

  it("200 desde el cache cuando es válido (fromCache=true)", async () => {
    process.env[FLAG] = "1";
    vi.mocked(loadCache).mockResolvedValue({
      fetchedAt: "2026-06-01T06:00:00.000Z",
      data: { ...SEED_REGULATORY, amountCents: 10_500, lastCheckedAt: "2026-06-01T06:00:00.000Z" },
    });
    const res = await GET();
    const body = await res.json();
    expect(body.data.fromCache).toBe(true);
    expect(body.data.amountCents).toBe(10_500);
  });
});
