import { PDFDocument, StandardFonts } from "pdf-lib";
import type { AafResult } from "@/lib/aaf/calculator";
import { PdfWriter } from "@/lib/pdf/layout";

/**
 * Genera el PDF "AAF Status Report" (recibo) con el resultado del cálculo
 * (doc 13 §3.2). Incluye el disclaimer UPL embebido (doc 13 §8). Devuelve los
 * bytes del PDF para que el endpoint los entregue con `Content-Type`.
 */

const STATUS_LABEL: Record<AafResult["aafStatus"], string> = {
  not_due: "Not due yet",
  due_soon: "Due soon",
  due_now: "Due now",
  overdue: "Overdue",
  paid_current: "Paid (current period)",
  case_closed: "Case closed",
};

export interface ReceiptMeta {
  applicantName?: string;
  generatedAt: string;
}

export async function generateReceiptPdf(
  result: AafResult,
  meta: ReceiptMeta,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const w = new PdfWriter(doc, fonts);

  w.heading("Annual Asylum Fee — Status Report", 18);
  w.paragraph(`Generated: ${meta.generatedAt}`, { size: 9, muted: true });
  if (meta.applicantName)
    w.paragraph(`Applicant: ${meta.applicantName}`, { size: 10, muted: true });
  w.spacer();

  w.keyValue("Branch", result.branch);
  w.keyValue("Fiscal year", `FY${result.fiscalYear}`);
  w.keyValue("Amount", `$${result.amountUsd} (${result.amountCents} cents)`);
  w.keyValue("Status", STATUS_LABEL[result.aafStatus]);
  w.keyValue("Next due date", result.nextDueDate ?? "—");
  if (result.daysUntilDue !== null) w.keyValue("Days until due", String(result.daysUntilDue));
  if (result.pause) w.keyValue("Pause", result.pause.label);
  w.spacer();

  w.heading("Legal references", 12);
  for (const cite of result.legalCitations) w.paragraph(`• ${cite}`, { size: 10 });
  w.spacer();

  w.heading("Important notices", 12);
  for (const note of result.caveats.en) w.paragraph(`• ${note}`, { size: 9, muted: true });
  w.spacer();
  w.paragraph(
    "This document is an informational status report, not legal advice and not an official receipt. Confirm all amounts and dates with USCIS/EOIR.",
    { size: 9, muted: true },
  );

  return doc.save();
}
