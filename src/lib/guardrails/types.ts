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

export type GuardrailThreatScore = {
  name: string;
  score?: number;
  threshold?: number;
  action?: string;
  triggered?: boolean;
  severity?: "info" | "low" | "medium" | "high" | "critical";
  location: "prompt" | "response" | "resume";
  explanation?: string;
};

export type GuardrailInspectionResult = {
  provider: "zscaler_ai_guard";
  action: "allowed" | "blocked" | "flagged" | "not_inspected";
  threatScores: GuardrailThreatScore[];
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
