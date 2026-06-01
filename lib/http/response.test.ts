import { describe, expect, it } from "vitest";
import { statusForKind } from "@/lib/http/errors";
import { err, jsonErr, jsonOk, ok } from "@/lib/http/response";

describe("contrato de respuesta {ok,data} (doc 07 §1)", () => {
  it("ok() envuelve la data", () => {
    expect(ok({ a: 1 })).toEqual({ ok: true, data: { a: 1 } });
  });

  it("err() sin mensaje", () => {
    expect(err("CaseNotFound")).toEqual({ ok: false, error: { kind: "CaseNotFound" } });
  });

  it("err() con mensaje", () => {
    expect(err("ValidationError", "campo x inválido")).toEqual({
      ok: false,
      error: { kind: "ValidationError", message: "campo x inválido" },
    });
  });
});

describe("mapeo kind → status (doc 07 §2)", () => {
  it("mapea los kinds principales", () => {
    expect(statusForKind("ConfigMissing")).toBe(503);
    expect(statusForKind("ValidationError")).toBe(400);
    expect(statusForKind("BackendUnavailable")).toBe(502);
    expect(statusForKind("CaseNotFound")).toBe(404);
    expect(statusForKind("CaptchaInvalid")).toBe(401);
    expect(statusForKind("RateLimited")).toBe(429);
    expect(statusForKind("Unauthorized")).toBe(401);
    expect(statusForKind("Unknown")).toBe(500);
  });
});

describe("helpers HTTP (Response web-estándar)", () => {
  it("jsonOk() devuelve 200 y el sobre ok", async () => {
    const res = jsonOk({ hello: "world" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { hello: "world" } });
  });

  it("jsonErr() usa el status del catálogo", async () => {
    const res = jsonErr("ConfigMissing", "apagado");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      ok: false,
      error: { kind: "ConfigMissing", message: "apagado" },
    });
  });

  it("jsonErr() agrega Retry-After solo en RateLimited", () => {
    const limited = jsonErr("RateLimited", undefined, { retryAfter: 30 });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("30");

    const other = jsonErr("BackendUnavailable", undefined, { retryAfter: 30 });
    expect(other.headers.get("Retry-After")).toBeNull();
  });
});
