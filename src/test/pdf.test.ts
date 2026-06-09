import { describe, expect, it, vi } from "vitest";
import { extractPdfText, validatePdfUpload } from "@/lib/pdf";

describe("PDF upload validation", () => {
  it("rejects non-PDF files", () => {
    const file = new File(["hello"], "resume.txt", { type: "text/plain" });
    expect(validatePdfUpload(file)).toBe("Only PDF files are supported.");
  });

  it("handles extraction errors cleanly", async () => {
    const file = new File(["not a real pdf"], "resume.pdf", { type: "application/pdf" });
    await expect(extractPdfText(file)).rejects.toThrow();
  });
});
