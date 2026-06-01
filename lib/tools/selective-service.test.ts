import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/tools/selective-service/route";
import { evaluateSelectiveService } from "@/lib/tools/selective-service";

const NOW = new Date("2026-05-31T00:00:00Z"); // year 2026

function ev(overrides: Partial<Parameters<typeof evaluateSelectiveService>[0]>) {
  return evaluateSelectiveService(
    {
      birthYear: 2006,
      status: "citizen",
      male: true,
      registered: false,
      presentUS: true,
      ...overrides,
    },
    NOW,
  );
}

describe("evaluateSelectiveService — matriz de ramas (doc 09 §11)", () => {
  it("not_required: sexo femenino", () => {
    expect(ev({ male: false }).status).toBe("not_required");
  });

  it("not_required: no-inmigrante legal (exento)", () => {
    expect(ev({ status: "nonimmigrant" }).status).toBe("not_required");
  });

  it("not_required: no reside en EE. UU.", () => {
    expect(ev({ presentUS: false }).status).toBe("not_required");
  });

  it("not_required: menor de 18", () => {
    expect(ev({ birthYear: 2010 }).status).toBe("not_required"); // age 16
  });

  it("must_register: hombre 18-25 obligado y sin registrar", () => {
    expect(ev({ birthYear: 2006 }).status).toBe("must_register"); // age 20
  });

  it("must_register: aplica también a indocumentados", () => {
    expect(ev({ birthYear: 2006, status: "undocumented" }).status).toBe("must_register");
  });

  it("registered: ya registrado", () => {
    expect(ev({ birthYear: 2006, registered: true }).status).toBe("registered");
  });

  it("needs SIL: 26+ obligado y nunca registrado → bloquea N-400", () => {
    const r = ev({ birthYear: 1996, registered: false }); // age 30
    expect(r.status).toBe("needs_status_information_letter");
    expect(r.blocksNaturalization).toBe(true);
  });

  it("registered a los 26+: cumplió, no bloquea", () => {
    const r = ev({ birthYear: 1996, registered: true });
    expect(r.status).toBe("registered");
    expect(r.blocksNaturalization).toBe(false);
  });
});

describe("GET /api/tools/selective-service", () => {
  const FLAG = "FEEDS_ENABLE_SELECTIVE_SERVICE";
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
  });

  function call(qs: string): Promise<Response> {
    return GET(new Request(`https://x.test/api/tools/selective-service${qs}`));
  }

  it("503 ConfigMissing cuando el flag está apagado", async () => {
    delete process.env[FLAG];
    const res = await call(
      "?birthYear=2006&status=citizen&male=true&registered=false&presentUS=true",
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error.kind).toBe("ConfigMissing");
  });

  it("200 {ok,data} con todos los parámetros válidos", async () => {
    process.env[FLAG] = "true";
    const res = await call(
      "?birthYear=2006&status=undocumented&male=true&registered=false&presentUS=true",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("must_register");
  });

  it("no acepta 'false' como true (booleano de query correcto)", async () => {
    process.env[FLAG] = "true";
    const res = await call(
      "?birthYear=2006&status=citizen&male=false&registered=false&presentUS=true",
    );
    const body = await res.json();
    expect(body.data.status).toBe("not_required");
  });

  it("400 ValidationError si falta un parámetro", async () => {
    process.env[FLAG] = "true";
    const res = await call("?birthYear=2006&status=citizen&male=true");
    expect(res.status).toBe(400);
    expect((await res.json()).error.kind).toBe("ValidationError");
  });

  it("400 si el status no está en el enum", async () => {
    process.env[FLAG] = "1";
    const res = await call(
      "?birthYear=2006&status=marciano&male=true&registered=false&presentUS=true",
    );
    expect(res.status).toBe(400);
  });
});
