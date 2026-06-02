import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCourtDetails } from "@/lib/eoir/court-intelligence/scrapers/court-details";
import type { CourtStatus } from "@/lib/eoir/court-intelligence/types";

vi.mock("@/lib/feeds/cache", () => ({ loadCache: vi.fn(), saveCache: vi.fn() }));
vi.mock("@/lib/eoir/court-intelligence/scrapers/http-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/eoir/court-intelligence/scrapers/http-client")>();
  return { ...actual, eoirFetch: vi.fn() };
});

import { GET } from "@/app/api/eoir/courts/[slug]/route";
import { GET as cronGET } from "@/app/api/cron/eoir-court-details-sync/route";
import { loadCache, saveCache } from "@/lib/feeds/cache";
import { eoirFetch } from "@/lib/eoir/court-intelligence/scrapers/http-client";

const SLUG = "adelanto-immigration-court";
const FIXTURE = readFileSync(
  fileURLToPath(new URL("../__fixtures__/court-details-adelanto.html", import.meta.url)),
  "utf8",
);
const DETAILS = parseCourtDetails(FIXTURE, SLUG);

describe("parseCourtDetails — estructura real verificada", () => {
  it("extrae nombre, dirección, teléfono, emails y administrador", () => {
    expect(DETAILS.name).toBe("Adelanto Immigration Court");
    expect(DETAILS.address).toEqual([
      "Adelanto ICE Processing Center",
      "10250 Rancho Road, Suite 201A",
      "Adelanto, CA 92301",
    ]);
    expect(DETAILS.phone).toBe("760-561-6500");
    expect(DETAILS.emails).toContain("Adelanto.Immigration.Court@usdoj.gov");
    expect(DETAILS.emails).toContain("Asylum.Clock.Adelanto@usdoj.gov");
    expect(DETAILS.courtAdministrator).toBe("Valerie Roberts");
    expect(DETAILS.assistantChiefImmigrationJudge).toBe("Jonathan W. Hitesman");
  });

  it("lista los jueces de la <ul> y excluye el backup ACIJ del <p>", () => {
    expect(DETAILS.immigrationJudges).toContain("Patrick Barrett");
    expect(DETAILS.immigrationJudges).toContain("Curtis White");
    expect(DETAILS.immigrationJudges).toHaveLength(6);
    expect(DETAILS.immigrationJudges).not.toContain("Julie L. Nelson");
  });
});

describe("GET /api/eoir/courts/[slug]", () => {
  const FLAG = "AAF_ENABLE_COURT_INTELLIGENCE";
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
    vi.mocked(loadCache).mockReset();
    vi.mocked(eoirFetch).mockReset();
  });

  function call(slug: string): Promise<Response> {
    return GET(new Request(`https://x.test/api/eoir/courts/${slug}`), {
      params: Promise.resolve({ slug }),
    });
  }

  it("503 cuando el flag está apagado", async () => {
    delete process.env[FLAG];
    expect((await call(SLUG)).status).toBe(503);
  });

  it("400 ante slug inválido", async () => {
    process.env[FLAG] = "true";
    expect((await call("no válido!")).status).toBe(400);
  });

  it("200 desde el cache LRU", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue({
      fetchedAt: "2026-06-02T00:00:00.000Z",
      data: { [SLUG]: { value: DETAILS, touchedAt: "2026-06-02T00:00:00.000Z" } },
    });
    const res = await call(SLUG);
    expect(res.status).toBe(200);
    expect((await res.json()).data.name).toBe("Adelanto Immigration Court");
    expect(eoirFetch).not.toHaveBeenCalled();
  });

  it("arranque en frío: scrape en vivo y persiste", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue(null);
    vi.mocked(eoirFetch).mockResolvedValue(FIXTURE);
    const res = await call(SLUG);
    expect(res.status).toBe(200);
    expect(saveCache).toHaveBeenCalled();
  });

  it("404 si la corte no existe (HTTP 404)", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue(null);
    vi.mocked(eoirFetch).mockRejectedValue(new Error("https://x respondió HTTP 404"));
    expect((await call("nope-immigration-court")).status).toBe(404);
  });
});

describe("GET /api/cron/eoir-court-details-sync", () => {
  const FLAG = "AAF_ENABLE_COURT_INTELLIGENCE_CRON";
  const SECRET = "cron-secret";
  const originalFlag = process.env[FLAG];
  const originalSecret = process.env.INTERNAL_CRON_SECRET;
  afterEach(() => {
    if (originalFlag === undefined) delete process.env[FLAG];
    else process.env[FLAG] = originalFlag;
    if (originalSecret === undefined) delete process.env.INTERNAL_CRON_SECRET;
    else process.env.INTERNAL_CRON_SECRET = originalSecret;
    vi.mocked(loadCache).mockReset();
    vi.mocked(eoirFetch).mockReset();
  });

  const statuses: CourtStatus[] = [
    {
      name: "A",
      slug: "a-court",
      detailUrl: "u",
      status: "OPEN",
      closed: false,
      address: {
        line1: null,
        line2: null,
        locality: null,
        region: null,
        postalCode: null,
        country: null,
      },
    },
    {
      name: "B",
      slug: "b-court",
      detailUrl: "u",
      status: "OPEN",
      closed: false,
      address: {
        line1: null,
        line2: null,
        locality: null,
        region: null,
        postalCode: null,
        country: null,
      },
    },
  ];

  function cronCall(headers: Record<string, string> = {}): Promise<Response> {
    return cronGET(new Request("https://x.test/api/cron/eoir-court-details-sync", { headers }));
  }

  it("401 sin autorización", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    expect((await cronCall()).status).toBe(401);
  });

  it("503 si el flag del cron está apagado", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    delete process.env[FLAG];
    expect((await cronCall({ authorization: `Bearer ${SECRET}` })).status).toBe(503);
  });

  it("200 refresca hasta CAP cortes y reporta el conteo", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockImplementation(async (name: string) =>
      name === "eoir-court-status"
        ? { fetchedAt: "2026-06-02T00:00:00.000Z", data: statuses }
        : null,
    );
    vi.mocked(eoirFetch).mockResolvedValue(FIXTURE);
    const res = await cronCall({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    expect((await res.json()).data.synced).toBe(2);
  });
});
