import { z } from "zod";
import type { AafResult } from "@/lib/aaf/calculator";
import { AAF_LEGAL_CITATIONS } from "@/lib/aaf/constants";
import { GEMINI_PRO, geminiJson } from "@/lib/gemini/client";
import { withCache } from "@/lib/gemini/response-cache";

/**
 * Borrador de la moción "Notice of Compliance with Annual Asylum Fee Payment"
 * para EOIR (doc 13 §3.1). Intenta redactar con Gemini Pro y, si falla (incl.
 * falta de billing), cae a un TEMPLATE determinista — el endpoint nunca queda
 * sin moción. La moción es un BORRADOR ("DRAFT"): no es asesoría legal.
 */

export interface MotionInput {
  applicantName: string;
  /** A-Number (PII) — opcional; va en el caption si se provee. */
  aNumber?: string;
  /** Corte/juez (de Court Intelligence, doc 13 §3.1) para encabezado correcto. */
  courtName?: string;
  judgeName?: string;
  filingDate: string;
  /** Sin abogado → marca de agua DRAFT en el PDF (doc 13 §3.1). */
  proSe: boolean;
  result: AafResult;
}

export interface MotionDraft {
  caption: string;
  bodyParagraphs: string[];
  prayer: string;
  signatureBlock: string;
  certificateOfService: string;
  fullText: string;
  /** `true` si se usó el template (Gemini no disponible/falló). */
  fromFallback: boolean;
}

const MotionSchema = z.object({
  caption: z.string().min(1),
  bodyParagraphs: z.array(z.string().min(1)).min(1),
  prayer: z.string().min(1),
  signatureBlock: z.string().min(1),
  certificateOfService: z.string().min(1),
});

function composeFullText(parts: Omit<MotionDraft, "fullText" | "fromFallback">): string {
  return [
    parts.caption,
    "",
    parts.bodyParagraphs.join("\n\n"),
    "",
    parts.prayer,
    "",
    parts.signatureBlock,
    "",
    parts.certificateOfService,
  ].join("\n");
}

/** Template determinista (fallback) — siempre disponible, sin Gemini. */
export function buildTemplateMotion(input: MotionInput): MotionDraft {
  const court = input.courtName ?? "United States Immigration Court";
  const aLine = input.aNumber ? ` (A-Number: ${input.aNumber})` : "";
  const caption = `${court}\n\nIn the Matter of: ${input.applicantName}${aLine}\n\nNOTICE OF COMPLIANCE WITH ANNUAL ASYLUM FEE PAYMENT`;
  const bodyParagraphs = [
    `Respondent, ${input.applicantName}, respectfully submits this Notice of Compliance regarding the Annual Asylum Fee (AAF) required under ${AAF_LEGAL_CITATIONS[0]} (${AAF_LEGAL_CITATIONS[1]}).`,
    `Respondent's Form I-589 was filed on ${input.filingDate}. The applicable annual fee for the current fiscal year (FY${input.result.fiscalYear}) is $${input.result.amountUsd} (USD ${input.result.amountCents} cents).`,
    `Respondent submits this notice to document compliance with the annual fee obligation while the asylum application remains pending. This is a supporting draft document and not legal advice; it should be reviewed with an attorney before filing.`,
  ];
  const prayer = `WHEREFORE, Respondent respectfully requests that this Notice be entered into the record as evidence of compliance with the Annual Asylum Fee requirement.`;
  const judge = input.judgeName ? `\nThe Honorable ${input.judgeName}` : "";
  const signatureBlock = `Respectfully submitted,${judge}\n\n_____________________________\n${input.applicantName}${input.proSe ? " (Pro Se)" : ""}\nDate: ${input.filingDate}`;
  const certificateOfService = `CERTIFICATE OF SERVICE\n\nI certify that a copy of this Notice was served on the Office of the Chief Counsel, U.S. Department of Homeland Security, on the date indicated above.`;
  const parts = { caption, bodyParagraphs, prayer, signatureBlock, certificateOfService };
  return { ...parts, fullText: composeFullText(parts), fromFallback: true };
}

function buildPrompt(input: MotionInput): string {
  return [
    "Draft a formal EOIR motion titled 'Notice of Compliance with Annual Asylum Fee Payment'.",
    `Applicant: ${input.applicantName}.`,
    input.aNumber ? `A-Number: ${input.aNumber}.` : "",
    input.courtName ? `Court: ${input.courtName}.` : "",
    input.judgeName ? `Immigration Judge: ${input.judgeName}.` : "",
    `Filing date of Form I-589: ${input.filingDate}.`,
    `Fee for FY${input.result.fiscalYear}: $${input.result.amountUsd}.`,
    `Cite ${AAF_LEGAL_CITATIONS[0]} and the One Big Beautiful Bill Act.`,
    "Return ONLY JSON:",
    '{"caption":"","bodyParagraphs":[""],"prayer":"","signatureBlock":"","certificateOfService":""}',
    "Professional legal English. Do not invent facts beyond those given.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Redacta la moción con Gemini Pro; cae al template si falla (resiliencia). */
export async function draftMotion(input: MotionInput): Promise<MotionDraft> {
  const cacheKey = `motion:${input.applicantName}:${input.filingDate}:${input.result.fiscalYear}:${input.result.amountCents}`;
  try {
    return await withCache(cacheKey, async () => {
      const parts = await geminiJson(buildPrompt(input), MotionSchema, {
        model: GEMINI_PRO,
        temperature: 0.2,
        maxOutputTokens: 4096,
      });
      return { ...parts, fullText: composeFullText(parts), fromFallback: false };
    });
  } catch {
    return buildTemplateMotion(input);
  }
}
