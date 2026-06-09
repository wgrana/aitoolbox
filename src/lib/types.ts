import { z } from "zod";

export const evaluationModeSchema = z.enum(["simple", "enhanced", "ai_guard"]);
export type EvaluationMode = z.infer<typeof evaluationModeSchema>;

export const recommendationSchema = z.enum([
  "reject",
  "maybe",
  "interview",
  "strong_interview"
]);

export const modelOutputSchema = z.object({
  score: z.number().min(0).max(100),
  recommendation: recommendationSchema,
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  rationale: z.string(),
  suspiciousContent: z.array(z.string()).optional()
});

export type ModelOutput = z.infer<typeof modelOutputSchema>;

export type FinalDecision = {
  scoreTrusted: boolean;
  finalScore?: number;
  finalRecommendation:
    | "reject"
    | "maybe"
    | "interview"
    | "strong_interview"
    | "manual_review"
    | "blocked";
  explanation: string;
};

export type EvaluateResponse = {
  mode: EvaluationMode;
  modelOutput?: ModelOutput;
  finalDecision: FinalDecision;
  guardrailResult?: {
    provider: "none" | "mock" | "zscaler_ai_guard";
    promptAction: "allowed" | "blocked" | "flagged" | "not_inspected";
    responseAction: "allowed" | "blocked" | "flagged" | "not_inspected";
    detections: Array<{
      type: string;
      severity: "info" | "low" | "medium" | "high" | "critical";
      location: "prompt" | "response" | "resume";
      explanation: string;
    }>;
  };
  auditTrail: string[];
  raw?: {
    promptSentToModel?: string;
    rawModelResponse?: string;
    rawGuardrailResponse?: unknown;
  };
};

export const evaluateRequestSchema = z.object({
  jobPosting: z.string().min(20).max(30000),
  resumeText: z.string().min(10).max(50000),
  mode: evaluationModeSchema
});
