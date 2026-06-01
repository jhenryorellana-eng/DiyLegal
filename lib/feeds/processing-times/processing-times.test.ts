import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildProcessingTimesData,
  lookupProcessingTime,
  type RawProcessingRows,
} from "@/lib/feeds/processing-times";

// Mocks: aislar del filesystem (cache) y del sync (red + node:sqlite).
vi.mock("@/lib/feeds/cache", () => ({ loadCache: vi.fn(), saveCache: vi.fn() }));
vi.mock("@/lib/feeds/processing-times/sync", () => ({ syncProcessingTimes: vi.fn() }));

import { GET } from "@/app/api/feeds/processing-times/route";
import { GET as cronGET } from "@/app/api/cron/processing-times-sync/route";
import { loadCache } from "@/lib/feeds/cache";
import { syncProcessingTimes } from "@/lib/feeds/processing-times/sync";

/**
 * Fixture con VALORES REALES del mirror `jzebedee/uscis` (release 2026-06-01),
 * incluyendo el caso límite real: `range_lower=null` con unidad "See notes".
 * Las columnas usan snake_case tal como las devuelve node:sqlite.
 */
const RAW: RawProcessingRows = {
  forms: [
    {
      name: "I-130",
      description_en: "Petition for Alien Relative",
      description_es: "Petición de Familiar Extranjero",
    },
    {
      name: "N-400",
      description_en: "Application for Naturalization",
      description_es: "Solicitud de Naturalización",
    },
  ],
  offices: [
    { code: "NBC", description: "National Benefits Center" },
    { code: "FOD", description: "All Field Offices" },
    { code: "SCD", description: "Service Center Operations (SCOPS)" },
  ],
  times: [
    {
      form_name: "I-130",
      office_code: "NBC",
      form_subtype: "134A-IR",
      publication_date: "May 22, 2026",
      range_lower: 51,
      range_upper: 54.5,
      range_lower_unit: "Months",
      range_upper_unit: "Months",
      service_request_date: "November 26, 2021",
      subtype_info_en: "U.S. citizen filing for a spouse, parent, or child under 21",
      subtype_info_es:
        "Petición de un ciudadano de EE.UU. para un cónyuge, un padre, o un niño menor de 21 años",
    },
    {
      form_name: "I-130",
      office_code: "NBC",
      form_subtype: "134A-F21",
      publication_date: "May 22, 2026",
      range_lower: 52,
      range_upper: 58.5,
      range_lower_unit: "Months",
      range_upper_unit: "Months",
      service_request_date: "July 24, 2021",
      subtype_info_en: "Permanent resident filing for a spouse or child under 21",
      subtype_info_es:
        "Petición de un residente permanente para un cónyuge o un niño menor de 21años",
    },
    {
      form_name: "I-130",
      office_code: "FOD",
      form_subtype: "134B-F41",
      publication_date: "May 22, 2026",
      range_lower: 298,
      range_upper: 301.5,
      range_lower_unit: "Months",
      range_upper_unit: "Months",
      service_request_date: "May 06, 2001",
      subtype_info_en: "U.S. citizen filing for a brother or sister",
      subtype_info_es: "Petición de un ciudadano de EE.UU. para un hermano o una hermana",
    },
    {
      // Caso límite REAL (I-130 / SCD / 134B-F11 en el release 2026-06-01):
      // lower ausente con unidad textual "See notes" (no numérica).
      form_name: "I-130",
      office_code: "SCD",
      form_subtype: "134B-F11",
      publication_date: "May 22, 2026",
      range_lower: null,
      range_upper: 107,
      range_lower_unit: "See notes",
      range_upper_unit: "Months",
      service_request_date: "July 16, 2017",
      subtype_info_en: "U.S. citizen filing for unmarried son/daughter 21 or older",
      subtype_info_es:
        "Ciudadano estadounidense que presenta solicitud para hijo o hija soltero de 21 años o mayor",
    },
  ],
};

const DATA = buildProcessingTimesData("2026-06-01", "https://example.test/2026-06-01.db", RAW);

describe("buildProcessingTimesData — mapeo fiel snake_case → camelCase", () => {
  it("mapea forms/offices/times y conserva metadatos del release", () => {
    expect(DATA.release).toBe("2026-06-01");
    expect(DATA.forms[0]).toEqual({
      name: "I-130",
      descriptionEn: "Petition for Alien Relative",
      descriptionEs: "Petición de Familiar Extranjero",
    });
    expect(DATA.offices.find((o) => o.code === "NBC")?.description).toBe(
      "National Benefits Center",
    );
    expect(DATA.times).toHaveLength(4);
  });

  it("preserva null (lower) y la unidad textual exacta — NO colapsa unidades", () => {
    const seeNotes = DATA.times.find((t) => t.subtype === "134B-F11");
    expect(seeNotes?.lower).toBeNull();
    expect(seeNotes?.lowerUnit).toBe("See notes");
    expect(seeNotes?.upper).toBe(107);
    expect(seeNotes?.upperUnit).toBe("Months");
  });
});

describe("lookupProcessingTime — consulta pura", () => {
  it("filtra por formulario y ordena por oficina y subtipo", () => {
    const r = lookupProcessingTime(DATA, "I-130");
    expect(r.form).toBe("I-130");
    expect(r.formName).toEqual({
      en: "Petition for Alien Relative",
      es: "Petición de Familiar Extranjero",
    });
    expect(r.release).toBe("2026-06-01");
    expect(r.publicationDate).toBe("May 22, 2026");
    expect(r.offices).toHaveLength(4);
    // Orden estable por officeCode (FOD < NBC < SCD) y luego subtype.
    expect(r.offices.map((o) => `${o.office}/${o.subtype}`)).toEqual([
      "FOD/134B-F41",
      "NBC/134A-F21",
      "NBC/134A-IR",
      "SCD/134B-F11",
    ]);
    expect(r.offices[0]?.officeName).toBe("All Field Offices");
  });

  it("filtra por oficina (normaliza mayúsculas) y mantiene units separadas", () => {
    const r = lookupProcessingTime(DATA, "i-130", "nbc");
    expect(r.offices).toHaveLength(2);
    expect(r.offices.every((o) => o.office === "NBC")).toBe(true);
    const ir = r.offices.find((o) => o.subtype === "134A-IR");
    expect(ir?.lower).toBe(51);
    expect(ir?.upper).toBe(54.5);
    expect(ir?.lowerUnit).toBe("Months");
    expect(ir?.serviceRequestDate).toBe("November 26, 2021");
  });

  it("formulario sin datos → offices vacío y formName en null (no es error)", () => {
    const r = lookupProcessingTime(DATA, "I-999");
    expect(r.offices).toHaveLength(0);
    expect(r.formName).toEqual({ en: null, es: null });
    expect(r.publicationDate).toBeNull();
  });

  it("oficina ausente del catálogo → officeName null (defensivo)", () => {
    const synthetic = buildProcessingTimesData("r", "s", {
      forms: [],
      offices: [],
      times: [{ form_name: "I-1", office_code: "ZZZ", form_subtype: "x" }],
    });
    expect(lookupProcessingTime(synthetic, "I-1").offices[0]?.officeName).toBeNull();
  });
});

describe("GET /api/feeds/processing-times", () => {
  const FLAG = "FEEDS_ENABLE_PROCESSING_TIMES";
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
    vi.mocked(loadCache).mockReset();
  });

  function call(qs = ""): Promise<Response> {
    return GET(new Request(`https://x.test/api/feeds/processing-times${qs}`));
  }

  it("503 ConfigMissing cuando el flag está apagado", async () => {
    delete process.env[FLAG];
    expect((await call("?form=I-130")).status).toBe(503);
  });

  it("400 si falta o es inválido el form / office", async () => {
    process.env[FLAG] = "true";
    expect((await call()).status).toBe(400);
    expect((await call("?form=hola")).status).toBe(400);
    expect((await call("?form=I-130&office=12345678")).status).toBe(400);
  });

  it("acepta sufijos de formulario REALES del mirror (no 400): I-129CW, I-526(L)", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue({ fetchedAt: "2026-06-01T14:00:00.000Z", data: DATA });
    // El regex no debe rechazar formularios legítimos con sufijo compuesto.
    expect((await call("?form=I-129CW")).status).toBe(200);
    expect((await call("?form=I-526(L)")).status).toBe(200);
    expect((await call("?form=I-600A3")).status).toBe(200);
  });

  it("502 si aún no hay cache sincronizado", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue(null);
    const res = await call("?form=I-130");
    expect(res.status).toBe(502);
    expect((await res.json()).error.kind).toBe("BackendUnavailable");
  });

  it("502 si el cache es inválido (no valida el schema)", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue({
      fetchedAt: "2026-06-01T14:00:00.000Z",
      data: { nope: true },
    });
    expect((await call("?form=I-130")).status).toBe(502);
  });

  it("200 con plazos desde el cache (filtra por oficina)", async () => {
    process.env[FLAG] = "true";
    vi.mocked(loadCache).mockResolvedValue({ fetchedAt: "2026-06-01T14:00:00.000Z", data: DATA });
    const res = await call("?form=I-130&office=NBC");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.form).toBe("I-130");
    expect(body.data.offices).toHaveLength(2);
    expect(body.data.offices[0].lowerUnit).toBe("Months");
  });
});

describe("GET /api/cron/processing-times-sync", () => {
  const FLAG = "FEEDS_ENABLE_PROCESSING_TIMES";
  const SECRET = "cron-secret";
  const originalFlag = process.env[FLAG];
  const originalSecret = process.env.INTERNAL_CRON_SECRET;
  afterEach(() => {
    if (originalFlag === undefined) delete process.env[FLAG];
    else process.env[FLAG] = originalFlag;
    if (originalSecret === undefined) delete process.env.INTERNAL_CRON_SECRET;
    else process.env.INTERNAL_CRON_SECRET = originalSecret;
    vi.mocked(syncProcessingTimes).mockReset();
  });

  function cronCall(headers: Record<string, string> = {}): Promise<Response> {
    return cronGET(new Request("https://x.test/api/cron/processing-times-sync", { headers }));
  }

  it("401 sin autorización", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    expect((await cronCall()).status).toBe(401);
  });

  it("503 si autorizado pero el flag está apagado", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    delete process.env[FLAG];
    expect((await cronCall({ authorization: `Bearer ${SECRET}` })).status).toBe(503);
  });

  it("200 synced cuando autorizado y habilitado", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    process.env[FLAG] = "true";
    vi.mocked(syncProcessingTimes).mockResolvedValue(DATA);
    const res = await cronCall({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.synced).toBe(true);
    expect(body.data.release).toBe("2026-06-01");
    expect(body.data.times).toBe(4);
  });

  it("502 si el sync falla", async () => {
    process.env.INTERNAL_CRON_SECRET = SECRET;
    process.env[FLAG] = "true";
    vi.mocked(syncProcessingTimes).mockRejectedValue(new Error("node:sqlite no disponible"));
    expect((await cronCall({ authorization: `Bearer ${SECRET}` })).status).toBe(502);
  });
});
