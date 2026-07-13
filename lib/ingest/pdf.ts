import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

/**
 * Extract selectable text from a PDF as plain text. Scanned/image-only PDFs
 * have no text layer and are rejected (OCR is out of v0.1 scope, strategy §7.5).
 * Server-only.
 */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  const out = text.trim();
  if (!out) {
    throw new Error(
      "No selectable text found — this looks like a scanned PDF (OCR is not supported yet).",
    );
  }
  return out;
}
