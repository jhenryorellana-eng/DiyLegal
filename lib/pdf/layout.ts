import { type PDFDocument, type PDFFont, type PDFPage, degrees, rgb } from "pdf-lib";

/**
 * Utilidades de maquetación para generar PDFs con `pdf-lib` (doc 09 §3.6).
 * pdf-lib no hace word-wrap ni saltos de página: este `PdfWriter` mantiene el
 * cursor, envuelve texto y pagina automáticamente.
 */

const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.42, 0.46);

/** Parte `text` en líneas que caben en `maxWidth` para `font`/`size`. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    let current = "";
    for (const word of rawLine.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }
  return lines;
}

export interface WriterFonts {
  regular: PDFFont;
  bold: PDFFont;
}

export class PdfWriter {
  private page: PDFPage;
  private y: number;
  private readonly width: number;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: WriterFonts,
    private readonly margin = 56,
  ) {
    this.page = doc.addPage();
    this.width = this.page.getWidth() - margin * 2;
    this.y = this.page.getHeight() - margin;
  }

  private ensureSpace(needed: number): void {
    if (this.y - needed < this.margin) {
      this.page = this.doc.addPage();
      this.y = this.page.getHeight() - this.margin;
    }
  }

  heading(text: string, size = 16): void {
    this.ensureSpace(size + 8);
    this.page.drawText(text, {
      x: this.margin,
      y: this.y,
      size,
      font: this.fonts.bold,
      color: INK,
    });
    this.y -= size + 8;
  }

  paragraph(text: string, opts: { size?: number; bold?: boolean; muted?: boolean } = {}): void {
    const size = opts.size ?? 11;
    const font = opts.bold ? this.fonts.bold : this.fonts.regular;
    const color = opts.muted ? MUTED : INK;
    for (const line of wrapText(text, font, size, this.width)) {
      this.ensureSpace(size + 4);
      this.page.drawText(line, { x: this.margin, y: this.y, size, font, color });
      this.y -= size + 4;
    }
  }

  keyValue(label: string, value: string, size = 11): void {
    this.ensureSpace(size + 4);
    this.page.drawText(`${label}:`, {
      x: this.margin,
      y: this.y,
      size,
      font: this.fonts.bold,
      color: INK,
    });
    const labelWidth = this.fonts.bold.widthOfTextAtSize(`${label}: `, size);
    this.page.drawText(value, {
      x: this.margin + labelWidth,
      y: this.y,
      size,
      font: this.fonts.regular,
      color: INK,
    });
    this.y -= size + 6;
  }

  spacer(height = 12): void {
    this.y -= height;
  }
}

/** Dibuja una marca de agua diagonal en TODAS las páginas (p. ej. "DRAFT"). */
export function applyWatermark(doc: PDFDocument, text: string, font: PDFFont): void {
  for (const page of doc.getPages()) {
    page.drawText(text, {
      x: page.getWidth() / 2 - 160,
      y: page.getHeight() / 2,
      size: 72,
      font,
      color: rgb(0.85, 0.85, 0.88),
      rotate: degrees(45),
      opacity: 0.4,
    });
  }
}
