import { afterEach, describe, expect, it, vi } from "vitest";
import { DmvSchema, type DmvData, findDmvState } from "@/lib/feeds/dmv";

vi.mock("@/lib/gemini/client", () => ({ geminiJson: vi.fn(), GEMINI_FLASH: "gemini-2.5-flash" }));
vi.mock("@/lib/feeds/cache", () => ({ loadCache: vi.fn(), saveCache: vi.fn() }));

import { GET } from "@/app/api/static/dmv-manual/route";
import { geminiJson } from "@/lib/gemini/client";
import { loadCache } from "@/lib/feeds/cache";

const DATA: DmvData = {
  states: [
    {
      code: "CA",
      name: "California",
      dmvHomepage: "https://www.dmv.ca.gov/",
      manualEnUrl: "https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/",
      manualEsUrl: "https://www.dmv.ca.gov/portal/handbook/manual-del-conductor/",
    },
    {
      code: "TX",
      name: "Texas",
      dmvHomepage: "https://www.dps.texas.gov/",
      manualEnUrl: "https://www.dps.texas.gov/section/driver-license/texas-driver-handbook",
      manualEsUrl: null,
    },
  ],
  asOf: "2026-05",
};

describe("DmvSchema y findDmvState", () => {
  it("valida estados con manual EN/ES (ES nullable)", () => {
    expect(DmvSchema.parse(DATA).states).toHaveLength(2);
    expect(DATA.states[1]?.manualEsUrl).toBeNull();
  });
  it("findDmvState es case-insensitive y null si no existe", () => {
    expect(findDmvState(DATA, "ca")?.name).toBe("California");
    expect(findDmvState(DATA, "ZZ")).toBeNull();
  });
});

describe("GET /api/static/dmv-manual (cache-first)", () => {
  const FLAG = "FEEDS_ENABLE_DMV";
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
    vi.mocked(loadCache).mockReset();
    vi.mocked(geminiJson).mockReset();
  });

  function call(qs = ""): Promise<Response> {
    return GET(new Request(`https://x.test/api/static/dmv-manual${qs}`));
  }

  it("503 ConfigMissing cuando el flag está apagado", async () => {
    delete process.env[FLAG];
    expect((await call()).status).toBe(503);
  });

  it("sirve del cache; ?state= devuelve ese estado, sin llamar a Gemini", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue({ fetchedAt: "2026-05-01T07:30:00.000Z", data: DATA });
    const res = await call("?state=TX");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.state.code).toBe("TX");
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
