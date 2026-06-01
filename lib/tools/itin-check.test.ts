import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/tools/itin-check/route";
import { evaluateItin, maskItin } from "@/lib/tools/itin-check";

describe("evaluateItin — regla IRS de 3 años (now inyectado, determinista)", () => {
  it("active: usado recientemente, vencimiento lejano", () => {
    const r = evaluateItin(
      { itin: "912345678", lastUsedYear: 2025 },
      new Date("2026-05-31T00:00:00Z"),
    );
    expect(r.status).toBe("active");
    expect(r.expiresOn).toBe("2028-12-31");
  });

  it("expiring: dentro de la ventana (últimos meses del año de vencimiento)", () => {
    const r = evaluateItin(
      { itin: "912345678", lastUsedYear: 2023 },
      new Date("2026-11-15T00:00:00Z"),
    );
    expect(r.status).toBe("expiring");
    expect(r.expiresOn).toBe("2026-12-31");
  });

  it("expired: no usado en 3+ años", () => {
    const r = evaluateItin(
      { itin: "912345678", lastUsedYear: 2018 },
      new Date("2026-05-31T00:00:00Z"),
    );
    expect(r.status).toBe("expired");
  });

  it("unknown: sin lastUsedYear", () => {
    const r = evaluateItin({ itin: "912345678" }, new Date("2026-05-31T00:00:00Z"));
    expect(r.status).toBe("unknown");
    expect(r.expiresOn).toBeNull();
  });
});

describe("maskItin — PII", () => {
  it("solo muestra el 9 inicial y los últimos 4 dígitos", () => {
    expect(maskItin("912345678")).toBe("9XX-XX-5678");
  });

  it("nunca expone los dígitos centrales", () => {
    expect(maskItin("912345678")).not.toContain("2345");
  });
});

describe("GET /api/tools/itin-check", () => {
  const FLAG = "FEEDS_ENABLE_ITIN";
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
  });

  function call(qs: string): Promise<Response> {
    return GET(new Request(`https://x.test/api/tools/itin-check${qs}`));
  }

  it("503 ConfigMissing cuando el flag está apagado", async () => {
    delete process.env[FLAG];
    const res = await call("?itin=912345678");
    expect(res.status).toBe(503);
    expect((await res.json()).error.kind).toBe("ConfigMissing");
  });

  it("200 {ok,data} con flag encendido", async () => {
    process.env[FLAG] = "true";
    const res = await call("?itin=912345678&lastUsedYear=2020");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(["active", "expiring", "expired", "unknown"]).toContain(body.data.status);
  });

  it("400 ValidationError si el ITIN no empieza en 9", async () => {
    process.env[FLAG] = "true";
    const res = await call("?itin=123456789");
    expect(res.status).toBe(400);
    expect((await res.json()).error.kind).toBe("ValidationError");
  });

  it("400 si el ITIN es demasiado corto", async () => {
    process.env[FLAG] = "true";
    const res = await call("?itin=912");
    expect(res.status).toBe(400);
  });

  it("PII: la respuesta nunca incluye el ITIN crudo, solo el enmascarado", async () => {
    process.env[FLAG] = "1";
    const res = await call("?itin=912345678&lastUsedYear=2020");
    const text = await res.text();
    expect(text).not.toContain("912345678");
    expect(text).toContain("9XX-XX-5678");
  });
});
