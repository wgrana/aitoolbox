import { describe, expect, it } from "vitest";
import { modelOutputSchema } from "@/lib/types";

describe("Zod model output validation", () => {
  it("accepts valid model JSON", () => {
    expect(
      modelOutputSchema.parse({
        score: 72,
        recommendation: "interview",
        summary: "Solid fit",
        strengths: ["ML platform work"],
        weaknesses: ["Limited safety depth"],
        rationale: "Relevant background",
        suspiciousContent: []
      })
    ).toMatchObject({ score: 72 });
  });

  it("rejects invalid scores and recommendations", () => {
    expect(() =>
      modelOutputSchema.parse({
        score: 120,
        recommendation: "hire_now",
        summary: "Invalid",
        strengths: [],
        weaknesses: [],
        rationale: "Invalid"
      })
    ).toThrow();
  });
});
