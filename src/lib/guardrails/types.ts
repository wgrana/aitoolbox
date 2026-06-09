export type GuardrailInspectionInput = {
  stage: "prompt" | "response";
  content: string;
  metadata?: {
    appName?: string;
    mode?: string;
    model?: string;
    policyId?: string;
  };
};

export type GuardrailInspectionResult = {
  provider: "mock" | "zscaler_ai_guard";
  action: "allowed" | "blocked" | "flagged";
  detections: Array<{
    type: string;
    severity: "info" | "low" | "medium" | "high" | "critical";
    location: "prompt" | "response" | "resume";
    explanation: string;
  }>;
  raw?: unknown;
};

export interface GuardrailProvider {
  inspect(input: GuardrailInspectionInput): Promise<GuardrailInspectionResult>;
}
