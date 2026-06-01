import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/static/civics/route";

const FLAG = "FEEDS_ENABLE_CIVICS";

function call(url = "https://x.test/api/static/civics"): Promise<Response> {
  return GET(new Request(url));
}

describe("GET /api/static/civics — patrón transversal (doc 07 §4.5)", () => {
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
  });

  it("503 ConfigMissing cuando el flag está apagado", async () => {
    delete process.env[FLAG];
    const res = await call();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.kind).toBe("ConfigMissing");
  });

  it("200 {ok,data} cuando el flag está encendido", async () => {
    process.env[FLAG] = "true";
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.totalQuestions).toBe(128);
  });

  it("400 ValidationError ante query inválida", async () => {
    process.env[FLAG] = "1";
    const res = await call("https://x.test/api/static/civics?version=1999");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.kind).toBe("ValidationError");
  });

  it("200 cuando la query es válida (version=2025)", async () => {
    process.env[FLAG] = "true";
    const res = await call("https://x.test/api/static/civics?version=2025");
    expect(res.status).toBe(200);
  });
});
