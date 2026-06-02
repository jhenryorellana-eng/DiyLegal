import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feeds/pdf", () => ({ fetchPdfText: vi.fn() }));

import { fetchPdfText } from "@/lib/feeds/pdf";
import { type IcpmSource, refreshIcpm } from "@/lib/aaf/icpm-check";

const SOURCES: IcpmSource[] = [{ chapter: "c1", url: "https://x.test/icpm.pdf" }];
const NOW = "2026-06-02T06:00:00.000Z";

afterEach(() => vi.mocked(fetchPdfText).mockReset());

describe("refreshIcpm (dedup por SHA-256)", () => {
  it("descarga, hashea y cuenta como cambiado sin cache previo", async () => {
    vi.mocked(fetchPdfText).mockResolvedValue("manual text");
    const { cache, changed } = await refreshIcpm(NOW, null, SOURCES);
    expect(changed).toBe(1);
    expect(cache.entries[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(cache.entries[0]?.chars).toBe("manual text".length);
  });

  it("no cuenta cambio si el SHA-256 coincide con el previo", async () => {
    vi.mocked(fetchPdfText).mockResolvedValue("manual text");
    const first = await refreshIcpm(NOW, null, SOURCES);
    const second = await refreshIcpm(NOW, first.cache, SOURCES);
    expect(second.changed).toBe(0);
  });

  it("cuenta cambio si el contenido difiere", async () => {
    vi.mocked(fetchPdfText).mockResolvedValueOnce("v1");
    const first = await refreshIcpm(NOW, null, SOURCES);
    vi.mocked(fetchPdfText).mockResolvedValueOnce("v2 distinto");
    const second = await refreshIcpm(NOW, first.cache, SOURCES);
    expect(second.changed).toBe(1);
  });

  it("propaga el error si la descarga falla", async () => {
    vi.mocked(fetchPdfText).mockRejectedValue(new Error("PDF HTTP 503"));
    await expect(refreshIcpm(NOW, null, SOURCES)).rejects.toThrow();
  });
});
