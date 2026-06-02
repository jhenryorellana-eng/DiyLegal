/**
 * Construye una `Response` HTTP con un PDF binario (doc 13 §3.1/3.2). Copia los
 * bytes a un `ArrayBuffer` (BodyInit válido y type-safe, sin casts) y fija
 * content-type + content-disposition. La metadata específica va en `extraHeaders`.
 */
export function pdfResponse(
  bytes: Uint8Array,
  filename: string,
  extraHeaders: Record<string, string> = {},
): Response {
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      ...extraHeaders,
    },
  });
}
