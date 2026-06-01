import { afterEach, describe, expect, it, vi } from "vitest";
import { CivicsSchema, type CivicsData, selectVersion } from "@/lib/feeds/civics";

vi.mock("@/lib/gemini/client", () => ({ geminiJson: vi.fn(), GEMINI_FLASH: "gemini-2.5-flash" }));
vi.mock("@/lib/feeds/cache", () => ({ loadCache: vi.fn(), saveCache: vi.fn() }));

import { GET } from "@/app/api/static/civics/route";
import { geminiJson } from "@/lib/gemini/client";
import { loadCache } from "@/lib/feeds/cache";

const DATA: CivicsData = {
  version: "2008",
  questions: [
    {
      number: 1,
      questionEn: "What is the supreme law of the land?",
      questionEs: "¿Cuál es la ley suprema?",
      answers: ["the Constitution"],
    },
  ],
};

describe("selectVersion — frontera 2025-10-20 (doc 09 §10)", () => {
  it("version explícito gana", () => {
    expect(selectVersion({ version: "2008", filingDate: "2025-12-01" })).toBe("2008");
  });
  it("filingDate antes del cutoff → 2008", () => {
    expect(selectVersion({ filingDate: "2025-10-19" })).toBe("2008");
  });
  it("filingDate en/after el cutoff → 2025", () => {
    expect(selectVersion({ filingDate: "2025-10-20" })).toBe("2025");
    expect(selectVersion({ filingDate: "2026-01-01" })).toBe("2025");
  });
  it("sin datos → 2025 (vigente)", () => {
    expect(selectVersion({})).toBe("2025");
  });
});

describe("CivicsSchema", () => {
  it("valida la estructura de pregunta bilingüe", () => {
    expect(CivicsSchema.parse(DATA).questions[0]?.number).toBe(1);
  });
});

describe("GET /api/static/civics (cache-first)", () => {
  const FLAG = "FEEDS_ENABLE_CIVICS";
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
    vi.mocked(loadCache).mockReset();
    vi.mocked(geminiJson).mockReset();
  });

  function call(qs = ""): Promise<Response> {
    return GET(new Request(`https://x.test/api/static/civics${qs}`));
  }

  it("503 ConfigMissing cuando el flag está apagado", async () => {
    delete process.env[FLAG];
    expect((await call()).status).toBe(503);
  });

  it("sirve del cache con count, sin llamar a Gemini", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue({ fetchedAt: "2026-05-01T07:00:00.000Z", data: DATA });
    const res = await call("?version=2008");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.count).toBe(1);
    expect(body.data.version).toBe("2008");
    expect(geminiJson).not.toHaveBeenCalled();
  });

  it("400 si filingDate no es YYYY-MM-DD", async () => {
    process.env[FLAG] = "1";
    expect((await call("?filingDate=2025/10/20")).status).toBe(400);
  });

  it("arranque en frío: llama a Gemini y persiste", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue(null);
    vi.mocked(geminiJson).mockResolvedValue(DATA);
    const res = await call("?version=2008");
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
