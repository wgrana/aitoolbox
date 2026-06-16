import type { FinalDecision, ModelOutput } from "@/lib/types";
import type { GuardrailInspectionResult } from "@/lib/guardrails/types";

export function modelDrivenDecision(
  modelOutput: ModelOutput,
  mode: "simple" | "enhanced"
): FinalDecision {
  const explanation =
    mode === "simple"
      ? "Simple Mode accepts the model recommendation without runtime guardrail inspection."
      : "Enhanced Prompt Mode may cause the model to notice suspicious content, but there is no independent guardrail inspection or enforcement. The final decision is still model-driven and prompt-only.";

  return {
    scoreTrusted: true,
    finalScore: modelOutput.score,
    finalRecommendation: modelOutput.recommendation,
    explanation
  };
}

export function blockedDecision(
  result: GuardrailInspectionResult,
  stage: "prompt" | "response"
): FinalDecision {
  return {
    scoreTrusted: false,
    finalRecommendation: result.action === "blocked" ? "blocked" : "manual_review",
    explanation:
      stage === "prompt"
        ? "Runtime guardrail inspection detected prompt-injection-like content before the LLM call, so the application did not trust or request a model score."
        : "Runtime guardrail inspection detected unsafe or manipulated model output, so the application did not trust the model score."
  };
}

export function guardedDecision(
  modelOutput: ModelOutput,
  promptResult: GuardrailInspectionResult,
  responseResult: GuardrailInspectionResult
): FinalDecision {
  const flagged = promptResult.action === "flagged" || responseResult.action === "flagged";
  const skippedInspection =
    promptResult.action === "not_inspected" || responseResult.action === "not_inspected";

  if (flagged) {
    return {
      scoreTrusted: false,
      finalRecommendation: "manual_review",
      explanation:
        "Guardrail inspection flagged suspicious content. The model output is shown for transparency, but the application requires manual review."
    };
  }

  return {
    scoreTrusted: true,
    finalScore: modelOutput.score,
    finalRecommendation: modelOutput.recommendation,
    explanation:
      skippedInspection
        ? "Configured guardrail inspections passed, and one direction was not inspected because no detectors are enabled for that direction."
        : "Prompt and response inspections allowed the evaluation. The application still records guardrail checks before accepting the score."
  };
}
