import { PDFParse } from "pdf-parse";

/**
 * Lectura de PDF (doc 09 §3.6). pdf-parse v2: `new PDFParse({data}).getText().text`.
 * `pdf-parse`/`pdfjs-dist` están en serverExternalPackages (next.config.ts).
 */
export async function fetchPdfText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`PDF respondió HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const result = await new PDFParse({ data: buffer }).getText();
  return result.text;
}
