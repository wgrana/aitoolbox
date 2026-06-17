import { z } from "zod";

export const supportChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000)
});

export const supportChatRequestSchema = z.object({
  messages: z.array(supportChatMessageSchema).min(1).max(30),
  guardrailsEnabled: z.boolean()
});

export type SupportChatMessage = z.infer<typeof supportChatMessageSchema>;
export type SupportChatRequest = z.infer<typeof supportChatRequestSchema>;

export type SupportChatResponse = {
  assistantMessage?: string;
  blocked: boolean;
  guardrailResult?: {
    provider: "none" | "zscaler_ai_guard";
    promptAction: "allowed" | "blocked" | "flagged" | "not_inspected" | "off";
    responseAction: "allowed" | "blocked" | "flagged" | "not_inspected" | "off";
    detections: Array<{
      type: string;
      severity: "info" | "low" | "medium" | "high" | "critical";
      location: "prompt" | "response" | "resume";
      explanation: string;
    }>;
  };
  runMetadata?: {
    provider: "openai_compatible";
    baseUrlHost?: string;
    model: string;
    startedAt: string;
    completedAt: string;
    totalLatencyMs: number;
    llmLatencyMs?: number;
    guardrailLatencyMs?: number;
  };
  raw?: {
    promptSentToModel?: string;
    rawModelResponse?: string;
    rawGuardrailResponse?: unknown;
  };
  error?: string;
};
