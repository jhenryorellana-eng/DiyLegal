import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EoirCaptchaDetectedError } from "@/lib/eoir/court-intelligence/scrapers/http-client";
import { __clearLegalAidCache, getLegalAid, parseLegalAid } from "@/lib/legal/legal-aid";

// Mockea solo eoirFetch; conserva la clase de error real.
vi.mock("@/lib/eoir/court-intelligence/scrapers/http-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/eoir/court-intelligence/scrapers/http-client")>();
  return { ...actual, eoirFetch: vi.fn() };
});

import { GET } from "@/app/api/legal/legal-aid/route";
import { eoirFetch } from "@/lib/eoir/court-intelligence/scrapers/http-client";

/** HTML REAL recortado de immigrationlawhelp.org?state=CA (3 organizaciones). */
const FIXTURE = readFileSync(
  fileURLToPath(new URL("./__fixtures__/immigrationlawhelp-ca.html", import.meta.url)),
  "utf8",
);

describe("parseLegalAid — selectores verificados contra el HTML real", () => {
  const r = parseLegalAid(FIXTURE, "ca");

  it("extrae las organizaciones y normaliza el estado", () => {
    expect(r.state).toBe("CA");
    expect(r.count).toBe(3);
    expect(r.source).toContain("state=CA");
  });

  it("mapea nombre, detalle absoluto, ubicación, teléfono y web (sin email)", () => {
    const aba = r.organizations[0];
    expect(aba?.name).toBe("ABA Immigration Justice Project of San Diego");
    expect(aba?.detailUrl).toBe(
      "https://www.immigrationlawhelp.org/organization.392628-ABA_Immigration_Justice_Project_of_San_Diego",
    );
    expect(aba?.location).toBe("2727 Camino del Rio South, Suite 320, San Diego, CA 92108");
    expect(aba?.phone).toBe("(619) 255-8810");
    expect(aba?.website).toBe("http://www.americanbar.org/ijp");
    expect(aba?.email).toBeNull();
    expect(aba?.areasOfAssistance).toContain("Asylum applications");
    expect(aba?.typesOfAssistance).toContain("Help completing forms");
  });

  it("extrae el email cuando existe (mailto)", () => {
    const access = r.organizations[1];
    expect(access?.name).toBe("Access California Services");
    expect(access?.email).toBe("request@accesscal.org");
    expect(access?.website).toBe("http://www.accesscal.org");
    expect(access?.phone).toBe("(714) 917-0440");
  });
});

describe("GET /api/legal/legal-aid", () => {
  const FLAG = "FEEDS_ENABLE_LEGAL_AID";
  const original = process.env[FLAG];
  beforeEach(() => __clearLegalAidCache());
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
    vi.mocked(eoirFetch).mockReset();
    vi.useRealTimers();
  });

  function call(qs = ""): Promise<Response> {
    return GET(new Request(`https://x.test/api/legal/legal-aid${qs}`));
  }

  it("503 ConfigMissing cuando el flag está apagado", async () => {
    delete process.env[FLAG];
    expect((await call("?state=CA")).status).toBe(503);
  });

  it("400 si el estado falta o es inválido", async () => {
    process.env[FLAG] = "true";
    expect((await call()).status).toBe(400);
    expect((await call("?state=California")).status).toBe(400);
    expect((await call("?state=C")).status).toBe(400);
  });

  it("200 con el directorio parseado", async () => {
    process.env[FLAG] = "true";
    vi.mocked(eoirFetch).mockResolvedValue(FIXTURE);
    const res = await call("?state=CA");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.count).toBe(3);
    expect(body.data.organizations[0].name).toContain("ABA");
  });

  it("cachea en memoria: una 2ª consulta no vuelve a golpear la fuente", async () => {
    process.env[FLAG] = "true";
    vi.mocked(eoirFetch).mockResolvedValue(FIXTURE);
    await call("?state=CA");
    await call("?state=CA");
    expect(eoirFetch).toHaveBeenCalledTimes(1);
  });

  it("502 si la fuente cae y no hay cache previo", async () => {
    process.env[FLAG] = "true";
    vi.mocked(eoirFetch).mockRejectedValue(new Error("down"));
    expect((await call("?state=NY")).status).toBe(502);
  });

  it("502 ante desafío anti-bot (EoirCaptchaDetectedError)", async () => {
    process.env[FLAG] = "true";
    vi.mocked(eoirFetch).mockRejectedValue(new EoirCaptchaDetectedError("https://x"));
    expect((await call("?state=TX")).status).toBe(502);
  });

  it("sirve cache stale si la fuente cae tras expirar el TTL de 1h", async () => {
    process.env[FLAG] = "true";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-02T00:00:00Z"));
    vi.mocked(eoirFetch).mockResolvedValueOnce(FIXTURE);
    expect((await call("?state=CA")).status).toBe(200);

    vi.setSystemTime(new Date("2026-06-02T02:00:00Z")); // +2h > TTL
    vi.mocked(eoirFetch).mockRejectedValueOnce(new Error("down"));
    const res = await call("?state=CA");
    expect(res.status).toBe(200);
    expect((await res.json()).data.stale).toBe(true);
  });
});

describe("getLegalAid — fallback stale a nivel de función", () => {
  beforeEach(() => __clearLegalAidCache());
  afterEach(() => {
    vi.mocked(eoirFetch).mockReset();
    vi.useRealTimers();
  });

  it("devuelve stale=false en datos frescos y stale=true al servir cache vencido", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-02T00:00:00Z"));
    vi.mocked(eoirFetch).mockResolvedValueOnce(FIXTURE);
    expect((await getLegalAid("CA")).stale).toBe(false);

    vi.setSystemTime(new Date("2026-06-02T03:00:00Z"));
    vi.mocked(eoirFetch).mockRejectedValueOnce(new Error("down"));
    const r = await getLegalAid("CA");
    expect(r.stale).toBe(true);
    expect(r.result.count).toBe(3);
  });
});
