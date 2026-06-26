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
  let text = "";
  let pageCount: number | undefined;

  try {
    const result = await pdf(buffer);
    text = result.text.trim();
    pageCount = result.numpages;
  } catch {
    text = extractSimplePdfText(buffer);
    pageCount = countSimplePdfPages(buffer);
  }

  if (!text) {
    throw new Error("PDF text extraction returned no readable text.");
  }

  return {
    text,
    metadata: {
      pageCount,
      fileName: file.name,
      sizeBytes: file.size
    }
  };
}

function countSimplePdfPages(buffer: Buffer) {
  const source = buffer.toString("latin1");
  return [...source.matchAll(/\/Type\s*\/Page(?!s)/g)].length || undefined;
}

function extractSimplePdfText(buffer: Buffer) {
  const source = buffer.toString("latin1");
  const chunks: string[] = [];

  for (const streamMatch of source.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    const stream = streamMatch[1];
    for (const textMatch of stream.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)) {
      chunks.push(unescapePdfLiteral(textMatch[0].replace(/\)\s*Tj$/, "").slice(1)));
    }
    for (const arrayMatch of stream.matchAll(/\[((?:.|\n)*?)\]\s*TJ/g)) {
      for (const textMatch of arrayMatch[1].matchAll(/\((?:\\.|[^\\)])*\)/g)) {
        chunks.push(unescapePdfLiteral(textMatch[0].slice(1, -1)));
      }
    }
  }

  return chunks.join("\n").trim();
}

function unescapePdfLiteral(value: string) {
  return value
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\([\\()])/g, "$1")
    .replace(/\\\r?\n/g, "");
}
