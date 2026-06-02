import { PDFDocument, StandardFonts } from "pdf-lib";
import type { MotionDraft } from "@/lib/aaf/draft-motion";
import { PdfWriter, applyWatermark } from "@/lib/pdf/layout";

/**
 * Genera el PDF de la moción "Notice of Compliance…" (doc 13 §3.1) a partir del
 * borrador (Gemini o template). Si es pro se, estampa la marca de agua "DRAFT"
 * en todas las páginas y añade el disclaimer UPL.
 */

export interface MotionPdfOptions {
  proSe: boolean;
}

export async function generateMotionPdf(
  draft: MotionDraft,
  options: MotionPdfOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.TimesRoman),
    bold: await doc.embedFont(StandardFonts.TimesRomanBold),
  };
  const w = new PdfWriter(doc, fonts);

  for (const line of draft.caption.split("\n")) {
    w.paragraph(line, { bold: true, size: 12 });
  }
  w.spacer();
  for (const para of draft.bodyParagraphs) {
    w.paragraph(para, { size: 11 });
    w.spacer(8);
  }
  w.paragraph(draft.prayer, { size: 11 });
  w.spacer();
  w.paragraph(draft.signatureBlock, { size: 11 });
  w.spacer();
  w.paragraph(draft.certificateOfService, { size: 10, muted: true });
  w.spacer();
  w.paragraph(
    "DRAFT — supporting document, not legal advice. Review with an attorney before filing.",
    { size: 9, muted: true },
  );

  if (options.proSe) {
    const watermarkFont = await doc.embedFont(StandardFonts.HelveticaBold);
    applyWatermark(doc, "DRAFT", watermarkFont);
  }
  return doc.save();
}
