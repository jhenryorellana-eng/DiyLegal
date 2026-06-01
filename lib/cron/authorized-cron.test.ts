import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authorizedCron } from "@/lib/cron/authorized-cron";

const SECRET = "s3cr3t-cron";

function reqWith(headers: Record<string, string>): Request {
  return new Request("https://x.test/api/cron/example", { headers });
}

describe("authorizedCron (doc 07 §3)", () => {
  const original = process.env.INTERNAL_CRON_SECRET;
  beforeEach(() => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.INTERNAL_CRON_SECRET;
    else process.env.INTERNAL_CRON_SECRET = original;
  });

  it("autoriza con Bearer correcto", () => {
    expect(authorizedCron(reqWith({ authorization: `Bearer ${SECRET}` }))).toBeNull();
  });

  it("autoriza con x-vercel-cron-secret correcto", () => {
    expect(authorizedCron(reqWith({ "x-vercel-cron-secret": SECRET }))).toBeNull();
  });

  it("rechaza Bearer incorrecto con Unauthorized", () => {
    const result = authorizedCron(reqWith({ authorization: "Bearer wrong" }));
    expect(result?.error.kind).toBe("Unauthorized");
  });

  it("rechaza sin credenciales", () => {
    expect(authorizedCron(reqWith({}))?.error.kind).toBe("Unauthorized");
  });

  it("devuelve ConfigMissing si no hay secreto configurado", () => {
    delete process.env.INTERNAL_CRON_SECRET;
    expect(authorizedCron(reqWith({ authorization: `Bearer ${SECRET}` }))?.error.kind).toBe(
      "ConfigMissing",
    );
  });
});
