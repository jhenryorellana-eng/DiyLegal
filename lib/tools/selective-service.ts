/**
 * Orientación de registro en el Servicio Selectivo (doc 09 §11, doc 02 §RF-SSS).
 *
 * Reglas (del doc): personas de sexo masculino de 18 a 25 años en EE.UU. deben
 * registrarse, incluidas las indocumentadas; los no-inmigrantes legales (F/J/H…)
 * están exentos; quien cumple 26 sin haberse registrado puede necesitar una
 * Status Information Letter (SIL), que suele requerirse para la naturalización
 * (N-400). NO se pide ni se acepta el SSN (PII; doc 10).
 *
 * Esto es información, no asesoría legal (límite UPL, doc 10).
 *
 * SUPUESTOS declarados (el doc NO los fija; no se alucinan):
 *  - Taxonomía de `status` (SS_STATUSES): elegida por nosotros; "nonimmigrant"
 *    representa los no-inmigrantes legales exentos. Validar contra fuente real.
 *  - La edad se aproxima por año (now.año − birthYear), sin mes/día.
 */

/** Estatus migratorio considerado. `nonimmigrant` = no-inmigrante legal (exento). */
export const SS_STATUSES = [
  "citizen",
  "permanent_resident",
  "refugee_asylee",
  "parolee",
  "undocumented",
  "nonimmigrant",
] as const;

export type SsStatus = (typeof SS_STATUSES)[number];

export type SelectiveServiceStatus =
  | "must_register"
  | "registered"
  | "needs_status_information_letter"
  | "not_required";

export interface SelectiveServiceResult {
  status: SelectiveServiceStatus;
  /** Explicación informativa (no asesoría). */
  reason: string;
  /** true solo cuando la falta de registro puede afectar la naturalización (N-400). */
  blocksNaturalization: boolean;
}

const REGISTRATION_MIN_AGE = 18;
const REGISTRATION_MAX_AGE = 25;

const REASONS = {
  female: "El registro en el Servicio Selectivo aplica a personas de sexo masculino.",
  notPresent: "El registro aplica a quienes residen en EE. UU.",
  nonimmigrant:
    "Las personas con estatus de no-inmigrante (por ejemplo F, J o H) que mantienen ese estatus están exentas.",
  under18: "El registro corresponde a partir de los 18 años; aún no aplica.",
  mustRegister:
    "Las personas de sexo masculino de 18 a 25 años en EE. UU. deben registrarse, incluidas las indocumentadas.",
  registered: "Figura como registrado en el Servicio Selectivo.",
  needsSil:
    "Por no haberse registrado antes de los 26, podría necesitar una Status Information Letter del Servicio Selectivo, que suele requerirse para la naturalización (N-400).",
} as const;

/**
 * Evalúa la situación de registro. `now` se inyecta para tests deterministas.
 */
export function evaluateSelectiveService(
  input: {
    birthYear: number;
    status: SsStatus;
    male: boolean;
    registered: boolean;
    presentUS: boolean;
  },
  now: Date = new Date(),
): SelectiveServiceResult {
  const notRequired = (reason: string): SelectiveServiceResult => ({
    status: "not_required",
    reason,
    blocksNaturalization: false,
  });

  if (!input.male) return notRequired(REASONS.female);
  if (!input.presentUS) return notRequired(REASONS.notPresent);
  if (input.status === "nonimmigrant") return notRequired(REASONS.nonimmigrant);

  const age = now.getUTCFullYear() - input.birthYear;
  if (age < REGISTRATION_MIN_AGE) return notRequired(REASONS.under18);

  if (input.registered) {
    return { status: "registered", reason: REASONS.registered, blocksNaturalization: false };
  }

  if (age <= REGISTRATION_MAX_AGE) {
    return { status: "must_register", reason: REASONS.mustRegister, blocksNaturalization: false };
  }

  // 26+ y sin registro estando obligado → posible Status Information Letter.
  return {
    status: "needs_status_information_letter",
    reason: REASONS.needsSil,
    blocksNaturalization: true,
  };
}
