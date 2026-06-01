import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractCountry,
  extractLevel,
  filterByCountry,
  parseTravelAdvisories,
} from "@/lib/feeds/travel-advisories";

vi.mock("@/lib/feeds/cache", () => ({ loadCache: vi.fn(), saveCache: vi.fn() }));

import { GET } from "@/app/api/feeds/travel-advisories/route";
import { GET as cronGET } from "@/app/api/cron/travel-advisories-sync/route";
import { loadCache } from "@/lib/feeds/cache";

/** Fixture derivado de la respuesta REAL de la API (no inventado). */
const FIXTURE = [
  {
    Title: "British Virgin Islands - Level 1: Exercise Normal Precautions",
    Link: "https://travel.state.gov/.../british-virgin-islands-travel-advisory.html",
    Category: ["VI"],
    Summary: "<p>safe</p>",
    Published: "2026-01-01",
    Updated: "2026-05-01",
  },
  {
    Title: "Mexico - Level 2: Exercise Increased Caution",
    Link: "https://travel.state.gov/.../mexico-travel-advisory.html",
    Category: ["MX"],
    Summary: "<p>caution</p>",
    Published: "2026-02-01",
    Updated: "2026-05-15",
  },
  {
    // Sin "Level N" → level null; country = el Title completo.
    Title: "Worldwide Caution",
    Link: "https://travel.state.gov/.../worldwide-caution.html",
    Category: [],
  },
];

function stubFetchOk(json: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => json }));
}
function stubFetchHttpError(status = 503) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status }));
}

describe("parse de Travel Advisories (Title → nivel/país)", () => {
  it("extractLevel reconoce niveles 1-4 y null", () => {
    expect(extractLevel("X - Level 1: a")).toBe(1);
    expect(extractLevel("X - Level 4: a")).toBe(4);
    expect(extractLevel("Worldwide Caution")).toBeNull();
  });

  it("extractCountry toma el texto antes de ' - Level'", () => {
    expect(extractCountry("Mexico - Level 2: Exercise Increased Caution")).toBe("Mexico");
    expect(extractCountry("Worldwide Caution")).toBe("Worldwide Caution");
  });

  it("parseTravelAdvisories mapea la respuesta real", () => {
    const r = parseTravelAdvisories(FIXTURE);
    expect(r).toHaveLength(3);
    expect(r[0]?.level).toBe(1);
    expect(r[0]?.country).toBe("British Virgin Islands");
    expect(r[2]?.level).toBeNull();
  });

  it("filterByCountry coincide por código o por nombre", () => {
    const r = parseTravelAdvisories(FIXTURE);
    expect(filterByCountry(r, "MX")).toHaveLength(1);
    expect(filterByCountry(r, "mexico")).toHaveLength(1);
    expect(filterByCountry(r, "zz")).toHaveLength(0);
  });
});

describe("GET /api/feeds/travel-advisories", () => {
  const FLAG = "FEEDS_ENABLE_TRAVEL_ADVISORIES";
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
    vi.unstubAllGlobals();
    vi.mocked(loadCache).mockReset();
  });

  function call(qs = ""): Promise<Response> {
    return GET(new Request(`https://x.test/api/feeds/travel-advisories${qs}`));
  }

  it("503 ConfigMissing (off por defecto)", async () => {
    delete process.env[FLAG];
    const res = await call();
    expect(res.status).toBe(503);
  });

  it("200 con datos en vivo cuando se habilita", async () => {
    process.env[FLAG] = "true";
    stubFetchOk(FIXTURE);
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).data.count).toBe(3);
  });

  it("filtra por country", async () => {
    process.env[FLAG] = "true";
    stubFetchOk(FIXTURE);
    const res = await call("?country=MX");
    expect((await res.json()).data.count).toBe(1);
  });

  it("fallback stale si la API falla", async () => {
    process.env[FLAG] = "1";
    stubFetchHttpError();
    vi.mocked(loadCache).mockResolvedValue({ fetchedAt: "2026-05-26T09:00:00.000Z", data: [] });
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).data.stale).toBe(true);
  });

  it("502 si la API falla y no hay cache", async () => {
    process.env[FLAG] = "1";
    stubFetchHttpError();
    vi.mocked(loadCache).mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(502);
  });
});

describe("GET /api/cron/travel-advisories-sync", () => {
  const FLAG = "FEEDS_ENABLE_TRAVEL_ADVISORIES";
  const SECRET = "cron-secret";
  const originalFlag = process.env[FLAG];
  const originalSecret = process.env.INTERNAL_CRON_SECRET;
  afterEach(() => {
    if (originalFlag === undefined) delete process.env[FLAG];
    else process.env[FLAG] = originalFlag;
    if (originalSecret === undefined) delete process.env.INTERNAL_CRON_SECRET;
    else process.env.INTERNAL_CRON_SECRET = originalSecret;
    vi.unstubAllGlobals();
  });

  it("401 sin autorización", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    const res = await cronGET(new Request("https://x.test/api/cron/travel-advisories-sync"));
    expect(res.status).toBe(401);
  });

  it("200 synced cuando autorizado y habilitado", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    process.env[FLAG] = "true";
    stubFetchOk(FIXTURE);
    const res = await cronGET(
      new Request("https://x.test/api/cron/travel-advisories-sync", {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.synced).toBe(true);
  });
});
