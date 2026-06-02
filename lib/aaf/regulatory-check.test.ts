import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gemini/client", () => ({ geminiJson: vi.fn(), GEMINI_FLASH: "gemini-2.5-flash" }));

import { geminiJson } from "@/lib/gemini/client";
import { refreshRegulatory } from "@/lib/aaf/regulatory-check";

afterEach(() => vi.mocked(geminiJson).mockReset());

describe("refreshRegulatory (Gemini grounded)", () => {
  it("construye el snapshot y deduplica fuentes por URL", async () => {
    vi.mocked(geminiJson).mockResolvedValue({
      amountCents: 10_200,
      fiscalYear: 2026,
      effectiveDate: "2025-10-01",
      pauses: [],
      sources: [
        { title: "FR", url: "https://federalregister.gov/a" },
        { title: "FR dup", url: "https://federalregister.gov/a" },
        { title: "USCIS", url: "https://uscis.gov/b" },
      ],
    });
    const snap = await refreshRegulatory("2026-06-02T06:00:00.000Z");
    expect(snap.amountCents).toBe(10_200);
    expect(snap.lastCheckedAt).toBe("2026-06-02T06:00:00.000Z");
    expect(snap.sources).toHaveLength(2);
  });

  it("usa el modelo Flash grounded", async () => {
    vi.mocked(geminiJson).mockResolvedValue({
      amountCents: 10_200,
      fiscalYear: 2026,
      effectiveDate: "2025-10-01",
      pauses: [],
      sources: [{ title: "x", url: "https://x.test/a" }],
    });
    await refreshRegulatory("2026-06-02T06:00:00.000Z");
    const opts = vi.mocked(geminiJson).mock.calls[0]?.[2];
    expect(opts).toMatchObject({ grounded: true, model: "gemini-2.5-flash" });
  });

  it("propaga el error si Gemini falla", async () => {
    vi.mocked(geminiJson).mockRejectedValue(new Error("429"));
    await expect(refreshRegulatory("2026-06-02T06:00:00.000Z")).rejects.toThrow();
  });
});
