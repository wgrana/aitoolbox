import pdf from "pdf-parse";

export const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;

export function validatePdfUpload(file: File) {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return "Only PDF files are supported.";
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    return "PDF is too large. The local demo limit is 5 MB.";
  }

  return null;
}

export async function extractPdfText(file: File) {
  const validationError = validatePdfUpload(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await pdf(buffer);
  const text = result.text.trim();

  if (!text) {
    throw new Error("PDF text extraction returned no readable text.");
  }

  return {
    text,
    metadata: {
      pageCount: result.numpages,
      fileName: file.name,
      sizeBytes: file.size
    }
  };
}
