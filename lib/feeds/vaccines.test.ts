import { afterEach, describe, expect, it, vi } from "vitest";
import { VaccinesSchema } from "@/lib/feeds/vaccines";

vi.mock("@/lib/gemini/client", () => ({ geminiJson: vi.fn(), GEMINI_FLASH: "gemini-2.5-flash" }));
vi.mock("@/lib/feeds/cache", () => ({ loadCache: vi.fn(), saveCache: vi.fn() }));

import { GET } from "@/app/api/static/vaccines/route";
import { GET as cronGET } from "@/app/api/cron/vaccines-sync/route";
import { fetchVaccines } from "@/lib/feeds/vaccines";
import { geminiJson } from "@/lib/gemini/client";
import { loadCache } from "@/lib/feeds/cache";

const VAX = {
  vaccines: [{ nameEn: "Measles, Mumps, Rubella (MMR)", nameEs: "Sarampión, paperas y rubéola" }],
  covidRequired: false,
  source: "https://www.uscis.gov/i-693",
  asOf: "2026-05",
};

describe("VaccinesSchema", () => {
  it("acepta una lista válida", () => {
    expect(VaccinesSchema.parse(VAX).vaccines).toHaveLength(1);
  });
  it("rechaza una lista vacía", () => {
    expect(() => VaccinesSchema.parse({ ...VAX, vaccines: [] })).toThrow();
  });
});

describe("fetchVaccines", () => {
  afterEach(() => vi.mocked(geminiJson).mockReset());
  it("usa Gemini con grounding", async () => {
    vi.mocked(geminiJson).mockResolvedValue(VAX);
    expect(await fetchVaccines()).toEqual(VAX);
    expect(geminiJson).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      expect.objectContaining({ grounded: true }),
    );
  });
});

describe("GET /api/static/vaccines (cache-first)", () => {
  const FLAG = "FEEDS_ENABLE_VACCINES";
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
    vi.mocked(loadCache).mockReset();
    vi.mocked(geminiJson).mockReset();
  });

  it("503 ConfigMissing cuando el flag está apagado", async () => {
    delete process.env[FLAG];
    expect((await GET()).status).toBe(503);
  });

  it("sirve del cache sin llamar a Gemini", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue({ fetchedAt: "2026-05-01T06:00:00.000Z", data: VAX });
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).data.cachedAt).toBe("2026-05-01T06:00:00.000Z");
    expect(geminiJson).not.toHaveBeenCalled();
  });

  it("arranque en frío: llama a Gemini y persiste", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue(null);
    vi.mocked(geminiJson).mockResolvedValue(VAX);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(geminiJson).toHaveBeenCalledTimes(1);
  });

  it("502 si no hay cache y Gemini falla", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue(null);
    vi.mocked(geminiJson).mockRejectedValue(new Error("429"));
    expect((await GET()).status).toBe(502);
  });
});

describe("GET /api/cron/vaccines-sync", () => {
  const FLAG = "FEEDS_ENABLE_VACCINES";
  const SECRET = "cron-secret";
  const originalFlag = process.env[FLAG];
  const originalSecret = process.env.INTERNAL_CRON_SECRET;
  afterEach(() => {
    if (originalFlag === undefined) delete process.env[FLAG];
    else process.env[FLAG] = originalFlag;
    if (originalSecret === undefined) delete process.env.INTERNAL_CRON_SECRET;
    else process.env.INTERNAL_CRON_SECRET = originalSecret;
    vi.mocked(geminiJson).mockReset();
  });

  it("401 sin autorización", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    const res = await cronGET(new Request("https://x.test/api/cron/vaccines-sync"));
    expect(res.status).toBe(401);
  });

  it("200 synced cuando autorizado y habilitado", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    process.env[FLAG] = "true";
    vi.mocked(geminiJson).mockResolvedValue(VAX);
    const res = await cronGET(
      new Request("https://x.test/api/cron/vaccines-sync", {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.synced).toBe(true);
  });
});
