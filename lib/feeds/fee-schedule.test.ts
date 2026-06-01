import { afterEach, describe, expect, it, vi } from "vitest";
import { buildFeeResult, extractFeeLines } from "@/lib/feeds/fee-schedule";

vi.mock("@/lib/feeds/pdf", () => ({ fetchPdfText: vi.fn() }));
vi.mock("@/lib/feeds/cache", () => ({ loadCache: vi.fn(), saveCache: vi.fn() }));

import { GET } from "@/app/api/feeds/fees/route";
import { loadCache } from "@/lib/feeds/cache";
import { fetchPdfText } from "@/lib/feeds/pdf";

/** Texto representativo del G-1055 (celdas aplanadas con " | "). */
const PDF_TEXT = [
  "Form | Description | Fee",
  "N-400 | Application for Naturalization | $760",
  "N-400 | Certain military applicants under INA 328/329 | $0",
  "I-130 | Petition for Alien Relative (uscis.gov/i-130) | $675",
  "I-589 | Application for Asylum (uscis.gov/i-589) | General filing | $100",
  "Línea sin código de formulario | $999",
].join("\n");

describe("extractFeeLines — exactitud literal (RNF-OPS-04)", () => {
  it("devuelve solo las líneas del formulario pedido", () => {
    const lines = extractFeeLines(PDF_TEXT, "N-400");
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.includes("N-400"))).toBe(true);
  });

  it("NO simplifica ni altera los dígitos (preserva $760 y $0 literales)", () => {
    const lines = extractFeeLines(PDF_TEXT, "N-400");
    expect(lines.some((l) => l.includes("$760"))).toBe(true);
    expect(lines.some((l) => l.includes("$0"))).toBe(true);
    // No mezcla con otros formularios.
    expect(lines.some((l) => l.includes("$675"))).toBe(false);
  });

  it("es case-insensitive y tolera el guion", () => {
    expect(extractFeeLines(PDF_TEXT, "i-130")).toHaveLength(1);
  });

  it("buildFeeResult normaliza el form y adjunta la fuente", () => {
    const r = buildFeeResult(PDF_TEXT, "i-589");
    expect(r.form).toBe("I-589");
    expect(r.source).toContain("g-1055.pdf");
    expect(r.feeLines).toHaveLength(1);
  });
});

describe("GET /api/feeds/fees", () => {
  const FLAG = "FEEDS_ENABLE_FEE_SCHEDULE";
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
    vi.mocked(loadCache).mockReset();
    vi.mocked(fetchPdfText).mockReset();
  });

  function call(qs = ""): Promise<Response> {
    return GET(new Request(`https://x.test/api/feeds/fees${qs}`));
  }

  it("503 ConfigMissing cuando el flag está apagado", async () => {
    delete process.env[FLAG];
    expect((await call("?form=N-400")).status).toBe(503);
  });

  it("400 si falta o es inválido el form", async () => {
    process.env[FLAG] = "true";
    expect((await call()).status).toBe(400);
    expect((await call("?form=hola")).status).toBe(400);
  });

  it("200 con feeLines desde el cache (sin descargar el PDF)", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue({
      fetchedAt: "2026-05-01T12:00:00.000Z",
      data: PDF_TEXT,
    });
    const res = await call("?form=N-400");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.form).toBe("N-400");
    expect(body.data.feeLines.some((l: string) => l.includes("$760"))).toBe(true);
    expect(fetchPdfText).not.toHaveBeenCalled();
  });

  it("arranque en frío: descarga el PDF y persiste", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue(null);
    vi.mocked(fetchPdfText).mockResolvedValue(PDF_TEXT);
    const res = await call("?form=I-130");
    expect(res.status).toBe(200);
    expect(fetchPdfText).toHaveBeenCalledTimes(1);
  });

  it("502 si no hay cache y la descarga falla", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue(null);
    vi.mocked(fetchPdfText).mockRejectedValue(new Error("HTTP 503"));
    expect((await call("?form=N-400")).status).toBe(502);
  });
});
