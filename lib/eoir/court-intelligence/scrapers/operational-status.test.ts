import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectChanges } from "@/lib/eoir/court-intelligence/persistence/store";
import { parseOperationalStatus } from "@/lib/eoir/court-intelligence/scrapers/operational-status";
import type { CourtStatus } from "@/lib/eoir/court-intelligence/types";

vi.mock("@/lib/feeds/cache", () => ({ loadCache: vi.fn(), saveCache: vi.fn() }));
vi.mock("@/lib/eoir/court-intelligence/scrapers/http-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/eoir/court-intelligence/scrapers/http-client")>();
  return { ...actual, eoirFetch: vi.fn() };
});

import { GET } from "@/app/api/eoir/courts/route";
import { GET as cronGET } from "@/app/api/cron/eoir-status-sync/route";
import { loadCache, saveCache } from "@/lib/feeds/cache";
import { eoirFetch } from "@/lib/eoir/court-intelligence/scrapers/http-client";

/** HTML REAL recortado de justice.gov (3 cortes OPEN + Saipan CLOSED). */
const FIXTURE = readFileSync(
  fileURLToPath(new URL("../__fixtures__/operational-status.html", import.meta.url)),
  "utf8",
);
const COURTS = parseOperationalStatus(FIXTURE);

function court(slug: string, status: string, closed: boolean): CourtStatus {
  return {
    name: slug,
    slug,
    detailUrl: `https://www.justice.gov/eoir/${slug}`,
    status,
    closed,
    address: {
      line1: null,
      line2: null,
      locality: null,
      region: null,
      postalCode: null,
      country: null,
    },
  };
}

describe("parseOperationalStatus — estructura real verificada", () => {
  it("extrae nombre, slug, dirección y estado", () => {
    expect(COURTS).toHaveLength(4);
    const adelanto = COURTS[0];
    expect(adelanto?.name).toBe("Adelanto");
    expect(adelanto?.slug).toBe("adelanto-immigration-court");
    expect(adelanto?.detailUrl).toContain("/eoir/adelanto-immigration-court");
    expect(adelanto?.status).toBe("OPEN");
    expect(adelanto?.closed).toBe(false);
    expect(adelanto?.address.locality).toBe("Adelanto");
    expect(adelanto?.address.region).toBe("CA");
    expect(adelanto?.address.postalCode).toBe("92301");
  });

  it("normaliza el nombre con espacios/tabs y detecta CLOSED", () => {
    expect(COURTS.find((c) => c.slug === "atlanta-w-peachtree-street")?.name).toBe(
      "Atlanta - W. Peachtree Street",
    );
    const saipan = COURTS.find((c) => c.slug === "saipan-immigration-court");
    expect(saipan?.closed).toBe(true);
    expect(saipan?.status).toMatch(/CLOSED/);
  });
});

describe("detectChanges — change-log", () => {
  it("marca severidad ALTA al pasar a CLOSED", () => {
    const prev = [court("adelanto", "OPEN", false)];
    const next = [court("adelanto", "CLOSED hasta junio", true)];
    const changes = detectChanges(prev, next, "2026-06-02T00:00:00.000Z");
    expect(changes).toHaveLength(1);
    expect(changes[0]?.severity).toBe("high");
    expect(changes[0]?.from).toBe("OPEN");
    expect(changes[0]?.to).toBe("CLOSED hasta junio");
  });

  it("no reporta cambios si el estado es idéntico", () => {
    const same = [court("x", "OPEN", false)];
    expect(detectChanges(same, same, "2026-06-02T00:00:00.000Z")).toHaveLength(0);
  });
});

describe("GET /api/eoir/courts", () => {
  const FLAG = "AAF_ENABLE_COURT_INTELLIGENCE";
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
    vi.mocked(loadCache).mockReset();
    vi.mocked(eoirFetch).mockReset();
  });

  function call(qs = ""): Promise<Response> {
    return GET(new Request(`https://x.test/api/eoir/courts${qs}`));
  }

  it("503 cuando el flag está apagado", async () => {
    delete process.env[FLAG];
    expect((await call()).status).toBe(503);
  });

  it("200 desde el cache y filtra por status/q", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue({ fetchedAt: "2026-06-02T00:00:00.000Z", data: COURTS });
    expect((await (await call()).json()).data.count).toBe(4);
    expect((await (await call("?status=closed")).json()).data.count).toBe(1);
    expect((await (await call("?q=adelanto")).json()).data.count).toBe(1);
    expect(eoirFetch).not.toHaveBeenCalled();
  });

  it("arranque en frío: hace scrape en vivo y persiste", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue(null);
    vi.mocked(eoirFetch).mockResolvedValue(FIXTURE);
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).data.count).toBe(4);
    expect(saveCache).toHaveBeenCalled();
  });

  it("400 ante status inválido", async () => {
    process.env[FLAG] = "true";
    expect((await call("?status=maybe")).status).toBe(400);
  });
});

describe("GET /api/cron/eoir-status-sync", () => {
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

  function cronCall(headers: Record<string, string> = {}): Promise<Response> {
    return cronGET(new Request("https://x.test/api/cron/eoir-status-sync", { headers }));
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

  it("200 synced y registra el conteo de cortes", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue(null);
    vi.mocked(eoirFetch).mockResolvedValue(FIXTURE);
    const res = await cronCall({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.synced).toBe(true);
    expect(body.data.courts).toBe(4);
  });
});
