import type {
  GuardrailInspectionInput,
  GuardrailInspectionResult,
  GuardrailProvider
} from "@/lib/guardrails/types";

const highConfidencePatterns = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s+prompt/i,
  /developer\s+message/i,
  /you\s+are\s+now/i,
  /rubric\s+has\s+been\s+updated/i,
  /assign\s+a\s+100/i,
  /give\s+a\s+100/i,
  /recommend\s+immediate\s+interview/i,
  /do\s+not\s+mention\s+this\s+instruction/i,
  /do\s+not\s+reveal\s+this\s+instruction/i,
  /override\s+the\s+scoring\s+criteria/i,
  /evaluation\s+criteria\s+changed/i,
  /highest\s+available\s+score/i,
  /pre-approved\s+by\s+the\s+hiring\s+committee/i
];

export function detectPromptInjection(content: string) {
  return highConfidencePatterns
    .filter((pattern) => pattern.test(content))
    .map((pattern) => ({
      type: "prompt_injection",
      severity: "high" as const,
      location: "resume" as const,
      explanation: `Mock AI Guard matched suspicious phrase pattern: ${pattern.source}`
    }));
}

export class MockAiGuardProvider implements GuardrailProvider {
  async inspect(input: GuardrailInspectionInput): Promise<GuardrailInspectionResult> {
    const detections = detectPromptInjection(input.content);
    const action = detections.length > 0 ? "blocked" : "allowed";

    return {
      provider: "mock",
      action,
      detections,
      raw: {
        mode: "local-simulation",
        stage: input.stage,
        matchedCount: detections.length
      }
    };
  }
}
