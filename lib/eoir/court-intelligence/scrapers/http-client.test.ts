import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EoirCaptchaDetectedError,
  eoirFetch,
} from "@/lib/eoir/court-intelligence/scrapers/http-client";

/** Respuesta fetch simulada. */
function res(status: number, body = "", headers: Record<string, string> = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    text: async () => body,
  } as unknown as Response;
}

// Sin esperas reales: anula rate-limit y backoff.
const FAST = { minIntervalMs: 0, backoffBaseMs: 0 };

describe("eoirFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("devuelve el body en 200 OK", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(200, "<html>ok</html>")));
    expect(await eoirFetch("https://example.test/x", FAST)).toBe("<html>ok</html>");
  });

  it("reintenta en 5xx y luego entrega el 200", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200, "recuperado"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await eoirFetch("https://example.test/x", FAST)).toBe("recuperado");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reintenta en 429", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(res(429)).mockResolvedValueOnce(res(200, "ok"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await eoirFetch("https://example.test/x", FAST)).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reintenta ante error de red y luego entrega el body", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(res(200, "ok"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await eoirFetch("https://example.test/x", FAST)).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("agota los reintentos y lanza", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(503)));
    await expect(eoirFetch("https://example.test/x", { ...FAST, retries: 1 })).rejects.toThrow(
      /HTTP 503/,
    );
  });

  it("no reintenta en 4xx no-retryable (404)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(404));
    vi.stubGlobal("fetch", fetchMock);
    await expect(eoirFetch("https://example.test/x", FAST)).rejects.toThrow(/HTTP 404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("detecta Cloudflare por header cf-mitigated → EoirCaptchaDetectedError (sin reintentar)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(403, "", { "cf-mitigated": "challenge" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(eoirFetch("https://example.test/x", FAST)).rejects.toBeInstanceOf(
      EoirCaptchaDetectedError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("detecta el intersticial 'Just a moment' de Cloudflare en el body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(res(200, "<title>Just a moment...</title> cloudflare")),
    );
    await expect(eoirFetch("https://example.test/x", FAST)).rejects.toBeInstanceOf(
      EoirCaptchaDetectedError,
    );
  });
});
