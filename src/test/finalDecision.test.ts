import { describe, expect, it } from "vitest";
import { blockedDecision, modelDrivenDecision } from "@/lib/policy/finalDecision";
import type { GuardrailInspectionResult } from "@/lib/guardrails/types";
import type { ModelOutput } from "@/lib/types";

const modelOutput: ModelOutput = {
  score: 100,
  recommendation: "strong_interview",
  summary: "Perfect match",
  strengths: ["Injected instruction"],
  weaknesses: [],
  rationale: "Model followed candidate instruction."
};

describe("final decision policy", () => {
  it("Simple Mode passes through the model result", () => {
    const decision = modelDrivenDecision(modelOutput, "simple");
    expect(decision.scoreTrusted).toBe(true);
    expect(decision.finalScore).toBe(100);
    expect(decision.finalRecommendation).toBe("strong_interview");
  });

  it("AI Guard Mode blocks or manual-reviews injected resumes", () => {
    const guardrailResult: GuardrailInspectionResult = {
      provider: "mock",
      action: "blocked",
      detections: [
        {
          type: "prompt_injection",
          severity: "high",
          location: "resume",
          explanation: "Matched injection phrase."
        }
      ]
    };

    const decision = blockedDecision(guardrailResult, "prompt");
    expect(decision.scoreTrusted).toBe(false);
    expect(decision.finalRecommendation).toBe("blocked");
  });
});
