import { afterEach, describe, expect, it, vi } from "vitest";
import { parseFederalRegister } from "@/lib/feeds/federal-register";

// Mock del cache para aislar los tests del filesystem.
vi.mock("@/lib/feeds/cache", () => ({
  loadCache: vi.fn(),
  saveCache: vi.fn(),
}));

import { GET } from "@/app/api/feeds/regulations/route";
import { GET as cronGET } from "@/app/api/cron/federal-register-sync/route";
import { loadCache } from "@/lib/feeds/cache";

/** Fixture reducido derivado de la respuesta REAL de la API (no inventado). */
const FIXTURE = {
  count: 2041,
  total_pages: 50,
  results: [
    {
      title:
        "Agency Information Collection Activities; Petition To Remove the Conditions on Residence",
      type: "Notice",
      abstract: "The Department of Homeland Security (DHS), USCIS invites the general public...",
      document_number: "2026-10716",
      html_url: "https://www.federalregister.gov/documents/2026/05/29/2026-10716/agency-info",
      pdf_url: "https://www.govinfo.gov/content/pkg/FR-2026-05-29/pdf/2026-10716.pdf",
      publication_date: "2026-05-29",
      agencies: [
        { raw_name: "DEPARTMENT OF HOMELAND SECURITY", name: "Homeland Security Department" },
      ],
    },
    {
      // Documento con campos opcionales ausentes → debe tolerarse.
      title: "Rule sin abstract ni pdf",
      document_number: "2026-99999",
      html_url: "https://www.federalregister.gov/documents/2026/05/20/2026-99999/x",
      publication_date: "2026-05-20",
      agencies: [{ name: "U.S. Citizenship and Immigration Services" }],
    },
  ],
};

function stubFetchOk(json: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => json }));
}
function stubFetchHttpError(status = 503) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status }));
}

describe("parseFederalRegister — schema real, tolerante", () => {
  it("normaliza la respuesta y mapea agencias a nombres", () => {
    const r = parseFederalRegister(FIXTURE);
    expect(r.count).toBe(2041);
    expect(r.results).toHaveLength(2);
    expect(r.results[0]?.documentNumber).toBe("2026-10716");
    expect(r.results[0]?.agencies).toContain("Homeland Security Department");
  });

  it("tolera campos opcionales ausentes (abstract/type/pdf → null)", () => {
    const r = parseFederalRegister(FIXTURE);
    expect(r.results[1]?.type).toBeNull();
    expect(r.results[1]?.abstract).toBeNull();
    expect(r.results[1]?.pdfUrl).toBeNull();
  });

  it("rechaza respuestas que no validan", () => {
    expect(() => parseFederalRegister({ nope: true })).toThrow();
  });
});

describe("GET /api/feeds/regulations", () => {
  const FLAG = "FEEDS_ENABLE_FEDERAL_REGISTER";
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
    vi.unstubAllGlobals();
    vi.mocked(loadCache).mockReset();
  });

  function call(qs = ""): Promise<Response> {
    return GET(new Request(`https://x.test/api/feeds/regulations${qs}`));
  }

  it("503 ConfigMissing cuando el flag está apagado", async () => {
    delete process.env[FLAG];
    const res = await call();
    expect(res.status).toBe(503);
    expect((await res.json()).error.kind).toBe("ConfigMissing");
  });

  it("200 con datos en vivo cuando la API responde", async () => {
    process.env[FLAG] = "true";
    stubFetchOk(FIXTURE);
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.results).toHaveLength(2);
  });

  it("400 ValidationError si perPage excede el máximo", async () => {
    process.env[FLAG] = "1";
    const res = await call("?perPage=999");
    expect(res.status).toBe(400);
    expect((await res.json()).error.kind).toBe("ValidationError");
  });

  it("fallback: sirve el cache (stale) si la API falla", async () => {
    process.env[FLAG] = "true";
    stubFetchHttpError();
    vi.mocked(loadCache).mockResolvedValue({
      fetchedAt: "2026-05-30T05:00:00.000Z",
      data: { count: 1, results: [] },
    });
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.stale).toBe(true);
  });

  it("502 BackendUnavailable si la API falla y no hay cache", async () => {
    process.env[FLAG] = "true";
    stubFetchHttpError();
    vi.mocked(loadCache).mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(502);
    expect((await res.json()).error.kind).toBe("BackendUnavailable");
  });
});

describe("GET /api/cron/federal-register-sync", () => {
  const FLAG = "FEEDS_ENABLE_FEDERAL_REGISTER";
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

  function cronCall(headers: Record<string, string> = {}): Promise<Response> {
    return cronGET(new Request("https://x.test/api/cron/federal-register-sync", { headers }));
  }

  it("401 sin autorización", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    const res = await cronCall();
    expect(res.status).toBe(401);
  });

  it("503 si autorizado pero el flag está apagado", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    delete process.env[FLAG];
    const res = await cronCall({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(503);
  });

  it("200 synced cuando autorizado y habilitado", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    process.env[FLAG] = "true";
    stubFetchOk(FIXTURE);
    const res = await cronCall({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    expect((await res.json()).data.synced).toBe(true);
  });
});
