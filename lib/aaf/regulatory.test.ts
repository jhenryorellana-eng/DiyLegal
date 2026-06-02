import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feeds/cache", () => ({ loadCache: vi.fn() }));

import { loadCache } from "@/lib/feeds/cache";
import {
  REGULATORY_CACHE_NAME,
  RegulatorySnapshotSchema,
  SEED_REGULATORY,
  loadRegulatory,
} from "@/lib/aaf/regulatory";

describe("SEED_REGULATORY", () => {
  it("es un snapshot válido (FY2026 = 10200¢)", () => {
    expect(RegulatorySnapshotSchema.parse(SEED_REGULATORY).amountCents).toBe(10_200);
  });
});

describe("loadRegulatory (cache-first + fallback semilla)", () => {
  afterEach(() => vi.mocked(loadCache).mockReset());

  it("usa el cache cuando es válido", async () => {
    const data = {
      ...SEED_REGULATORY,
      amountCents: 10_500,
      lastCheckedAt: "2026-06-01T06:00:00.000Z",
    };
    vi.mocked(loadCache).mockResolvedValue({ fetchedAt: "2026-06-01T06:00:00.000Z", data });
    const r = await loadRegulatory();
    expect(r.fromCache).toBe(true);
    expect(r.snapshot.amountCents).toBe(10_500);
    expect(vi.mocked(loadCache).mock.calls[0]?.[0]).toBe(REGULATORY_CACHE_NAME);
  });

  it("cae a la semilla cuando no hay cache", async () => {
    vi.mocked(loadCache).mockResolvedValue(null);
    const r = await loadRegulatory();
    expect(r.fromCache).toBe(false);
    expect(r.snapshot.amountCents).toBe(10_200);
  });

  it("cae a la semilla cuando el cache es inválido (no rompe)", async () => {
    vi.mocked(loadCache).mockResolvedValue({
      fetchedAt: "x",
      data: { amountCents: -1 } as never,
    });
    const r = await loadRegulatory();
    expect(r.fromCache).toBe(false);
    expect(r.snapshot.amountCents).toBe(10_200);
  });
});
