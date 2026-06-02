import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseTracJudgeStats } from "@/lib/eoir/court-intelligence/scrapers/trac-judge-stats";
import type { CourtStatus } from "@/lib/eoir/court-intelligence/types";

vi.mock("@/lib/feeds/cache", () => ({ loadCache: vi.fn(), saveCache: vi.fn() }));
vi.mock("@/lib/eoir/court-intelligence/scrapers/http-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/eoir/court-intelligence/scrapers/http-client")>();
  return { ...actual, eoirFetch: vi.fn() };
});

import { GET as judgesGET } from "@/app/api/eoir/judges/route";
import { GET as judgeByCodeGET } from "@/app/api/eoir/judges/[code]/route";
import { GET as intelGET } from "@/app/api/eoir/intelligence/case/route";
import { GET as cronGET } from "@/app/api/cron/trac-judge-stats-sync/route";
import { loadCache, saveCache } from "@/lib/feeds/cache";
import { eoirFetch } from "@/lib/eoir/court-intelligence/scrapers/http-client";

const FIXTURE = readFileSync(
  fileURLToPath(new URL("../__fixtures__/trac-judge-reports.html", import.meta.url)),
  "utf8",
);
const JUDGES = parseTracJudgeStats(FIXTURE);

const COURTS: CourtStatus[] = [
  {
    name: "Adelanto",
    slug: "adelanto-immigration-court",
    detailUrl: "https://www.justice.gov/eoir/adelanto-immigration-court",
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

function judgeCacheImpl(name: string) {
  if (name === "eoir-judge-cache") return { fetchedAt: "2026-06-02T00:00:00.000Z", data: JUDGES };
  if (name === "eoir-court-status") return { fetchedAt: "2026-06-02T00:00:00.000Z", data: COURTS };
  return null;
}

describe("parseTracJudgeStats — estructura real (rowspan + código del enlace)", () => {
  it("hereda la corte vía rowspan y extrae código/base city code", () => {
    expect(JUDGES).toHaveLength(9);
    const riley = JUDGES[0];
    expect(riley?.judge).toBe("Riley, Kevin W.");
    expect(riley?.court).toBe("Adelanto");
    expect(riley?.code).toBe("00347ADL");
    expect(riley?.baseCityCode).toBe("ADL");
    expect(riley?.totalDecisions).toBe(102);
    expect(riley?.grantedAsylumPct).toBe(2.9);
    expect(riley?.deniedPct).toBe(95.1);
    expect(riley?.profileUrl).toContain("00347ADL/index.html");
  });

  it("la primera fila de la siguiente corte (6 celdas) reinicia la corte", () => {
    const gardey = JUDGES.find((j) => j.code === "01065ANN");
    expect(gardey?.judge).toBe("Gardey, David A.");
    expect(gardey?.court).toBe("Annandale");
    expect(gardey?.baseCityCode).toBe("ANN");
    expect(JUDGES.filter((j) => j.baseCityCode === "ADL")).toHaveLength(8);
  });
});

describe("GET /api/eoir/judges", () => {
  const FLAG = "AAF_ENABLE_JUDGE_STATS";
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
    vi.mocked(loadCache).mockReset();
    vi.mocked(eoirFetch).mockReset();
  });

  function call(qs = ""): Promise<Response> {
    return judgesGET(new Request(`https://x.test/api/eoir/judges${qs}`));
  }

  it("503 cuando el flag está apagado", async () => {
    delete process.env[FLAG];
    expect((await call()).status).toBe(503);
  });

  it("200 desde el cache y filtra por baseCityCode/judge", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue({ fetchedAt: "x", data: JUDGES });
    expect((await (await call("?baseCityCode=ADL")).json()).data.count).toBe(8);
    expect((await (await call("?judge=mullins")).json()).data.count).toBe(1);
    expect(eoirFetch).not.toHaveBeenCalled();
  });

  it("arranque en frío: scrape en vivo y persiste", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue(null);
    vi.mocked(eoirFetch).mockResolvedValue(FIXTURE);
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).data.count).toBe(9);
    expect(saveCache).toHaveBeenCalled();
  });
});

describe("GET /api/eoir/judges/[code]", () => {
  const FLAG = "AAF_ENABLE_JUDGE_STATS";
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
    vi.mocked(loadCache).mockReset();
    vi.mocked(eoirFetch).mockReset();
  });

  function call(code: string): Promise<Response> {
    return judgeByCodeGET(new Request(`https://x.test/api/eoir/judges/${code}`), {
      params: Promise.resolve({ code }),
    });
  }

  it("200 por código TRAC", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue({ fetchedAt: "x", data: JUDGES });
    const res = await call("00347ADL");
    expect(res.status).toBe(200);
    expect((await res.json()).data.judge).toBe("Riley, Kevin W.");
  });

  it("404 si el código no existe; 400 si es inválido", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue({ fetchedAt: "x", data: JUDGES });
    expect((await call("99999ZZZ")).status).toBe(404);
    expect((await call("a")).status).toBe(400);
  });
});

describe("GET /api/eoir/intelligence/case", () => {
  const FLAG = "AAF_ENABLE_COURT_INTELLIGENCE";
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
    vi.mocked(loadCache).mockReset();
    vi.mocked(eoirFetch).mockReset();
  });

  function call(qs = ""): Promise<Response> {
    return intelGET(new Request(`https://x.test/api/eoir/intelligence/case${qs}`));
  }

  it("400 si no se indica ningún filtro", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockImplementation(async (name: string) => judgeCacheImpl(name));
    expect((await call()).status).toBe(400);
  });

  it("agrega estadísticas del juez y estado de la corte", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockImplementation(async (name: string) => judgeCacheImpl(name));
    const res = await call("?judgeCode=00347ADL");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.judges).toHaveLength(1);
    expect(body.data.court.name).toBe("Adelanto");
  });
});

describe("GET /api/cron/trac-judge-stats-sync", () => {
  const FLAG = "AAF_ENABLE_JUDGE_STATS";
  const SECRET = "cron-secret";
  const originalFlag = process.env[FLAG];
  const originalSecret = process.env.INTERNAL_CRON_SECRET;
  afterEach(() => {
    if (originalFlag === undefined) delete process.env[FLAG];
    else process.env[FLAG] = originalFlag;
    if (originalSecret === undefined) delete process.env.INTERNAL_CRON_SECRET;
    else process.env.INTERNAL_CRON_SECRET = originalSecret;
    vi.mocked(eoirFetch).mockReset();
  });

  function cronCall(headers: Record<string, string> = {}): Promise<Response> {
    return cronGET(new Request("https://x.test/api/cron/trac-judge-stats-sync", { headers }));
  }

  it("401 sin autorización", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    expect((await cronCall()).status).toBe(401);
  });

  it("200 synced con el conteo de jueces", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    process.env[FLAG] = "true";
    vi.mocked(eoirFetch).mockResolvedValue(FIXTURE);
    const res = await cronCall({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    expect((await res.json()).data.judges).toBe(9);
  });
});
