import { afterEach, describe, expect, it, vi } from "vitest";
import { RealIdSchema, findState, type RealIdData } from "@/lib/feeds/real-id";

vi.mock("@/lib/gemini/client", () => ({ geminiJson: vi.fn(), GEMINI_FLASH: "gemini-2.5-flash" }));
vi.mock("@/lib/feeds/cache", () => ({ loadCache: vi.fn(), saveCache: vi.fn() }));

import { GET } from "@/app/api/static/real-id/route";
import { geminiJson } from "@/lib/gemini/client";
import { loadCache } from "@/lib/feeds/cache";

const DATA: RealIdData = {
  federal: {
    enforcedSince: "2025-05-07",
    requiredDocuments: ["Proof of identity", "Proof of SSN", "Proof of residency"],
    source: "https://www.dhs.gov/real-id",
  },
  states: [
    { code: "CA", name: "California", offersLicenseToUndocumented: true },
    { code: "TX", name: "Texas", offersLicenseToUndocumented: false },
  ],
  asOf: "2026-05",
};

describe("RealIdSchema y findState", () => {
  it("valida la estructura federal + estados", () => {
    expect(RealIdSchema.parse(DATA).states).toHaveLength(2);
  });
  it("findState es case-insensitive y devuelve null si no existe", () => {
    expect(findState(DATA, "ca")?.offersLicenseToUndocumented).toBe(true);
    expect(findState(DATA, "ZZ")).toBeNull();
  });
});

describe("GET /api/static/real-id (cache-first)", () => {
  const FLAG = "FEEDS_ENABLE_REAL_ID";
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
    vi.mocked(loadCache).mockReset();
    vi.mocked(geminiJson).mockReset();
  });

  function call(qs = ""): Promise<Response> {
    return GET(new Request(`https://x.test/api/static/real-id${qs}`));
  }

  it("503 ConfigMissing cuando el flag está apagado", async () => {
    delete process.env[FLAG];
    expect((await call()).status).toBe(503);
  });

  it("sirve del cache; con ?state= devuelve federal + ese estado", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue({ fetchedAt: "2026-05-01T06:30:00.000Z", data: DATA });
    const res = await call("?state=CA");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.state.code).toBe("CA");
    expect(body.data.federal.enforcedSince).toBe("2025-05-07");
    expect(geminiJson).not.toHaveBeenCalled();
  });

  it("400 si el state no es código de 2 letras", async () => {
    process.env[FLAG] = "1";
    expect((await call("?state=California")).status).toBe(400);
  });

  it("arranque en frío: llama a Gemini y persiste", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue(null);
    vi.mocked(geminiJson).mockResolvedValue(DATA);
    const res = await call();
    expect(res.status).toBe(200);
    expect(geminiJson).toHaveBeenCalledTimes(1);
  });

  it("502 si no hay cache y Gemini falla", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue(null);
    vi.mocked(geminiJson).mockRejectedValue(new Error("429"));
    expect((await call()).status).toBe(502);
  });
});
