import OpenAI from "openai";
import { z } from "zod";
import { buildAiGuardResumePrompt } from "@/lib/prompts/aiGuardResumePrompt";
import { buildChasmBankSupportPrompt } from "@/lib/prompts/chasmBankSupportPrompt";
import { buildEnhancedResumePrompt } from "@/lib/prompts/enhancedResumePrompt";
import { buildSimpleResumePrompt } from "@/lib/prompts/simpleResumePrompt";
import type { SupportChatMessage } from "@/lib/supportTypes";
import {
  type EvaluationMode,
  type ModelOutput,
  modelOutputSchema
} from "@/lib/types";

type EvaluateWithLLMInput = {
  jobPosting: string;
  resumeText: string;
  mode: EvaluationMode;
};

export type LlmEvaluationResult = {
  modelOutput?: ModelOutput;
  prompt: string;
  rawModelResponse?: string;
  error?: string;
  latencyMs?: number;
  model?: string;
  provider?: "openai_compatible";
};

export type LlmChatResult = {
  assistantMessage?: string;
  prompt: string;
  rawModelResponse?: string;
  error?: string;
  latencyMs?: number;
  model?: string;
  provider?: "openai_compatible";
};

export function buildPrompt(input: EvaluateWithLLMInput) {
  return buildPromptBundle(input).promptForDisplay;
}

function buildPromptBundle(input: EvaluateWithLLMInput) {
  if (input.mode === "simple") {
    return buildSimpleResumePrompt(input.jobPosting, input.resumeText);
  }

  if (input.mode === "ai_guard") {
    return buildAiGuardResumePrompt(input.jobPosting, input.resumeText);
  }

  return buildEnhancedResumePrompt(input.jobPosting, input.resumeText);
}

function getClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  });
}

function extractJson(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model response.");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

export async function evaluateResumeWithLLM(
  input: EvaluateWithLLMInput
): Promise<LlmEvaluationResult> {
  const promptBundle = buildPromptBundle(input);
  const prompt = promptBundle.promptForDisplay;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!process.env.OPENAI_API_KEY) {
    return {
      prompt,
      error:
        "OPENAI_API_KEY is not configured. Connect an OpenAI-compatible AI API before running evaluations.",
      model,
      provider: "openai_compatible"
    };
  }

  try {
    const client = getClient();
    const startedAt = Date.now();
    const messages = input.mode === "simple"
      ? [
          {
            role: "user" as const,
            content: prompt
          }
        ]
      : [
          {
            role: "system" as const,
            content: promptBundle.systemPrompt
          },
          {
            role: "user" as const,
            content: promptBundle.userPrompt
          }
        ];
    const request = {
      model,
      messages,
      temperature: input.mode === "simple" ? 0.2 : 0
    };
    const completion = await client.chat.completions.create(
      input.mode === "simple"
        ? request
        : {
            ...request,
            response_format: { type: "json_object" as const }
          }
    );
    const latencyMs = Date.now() - startedAt;

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = modelOutputSchema.parse(extractJson(raw));

    return {
      modelOutput: parsed,
      prompt,
      rawModelResponse: raw,
      latencyMs,
      model,
      provider: "openai_compatible"
    };
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "Model returned JSON that did not match the expected schema."
      : error instanceof Error
        ? error.message
        : "Unknown LLM error.";

    return {
      prompt,
      error: message,
      rawModelResponse: error instanceof Error ? error.message : String(error),
      model,
      provider: "openai_compatible"
    };
  }
}

export async function chatWithSupportLLM(
  messages: SupportChatMessage[]
): Promise<LlmChatResult> {
  const promptBundle = buildChasmBankSupportPrompt(messages);
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!process.env.OPENAI_API_KEY) {
    return {
      prompt: promptBundle.promptForDisplay,
      error:
        "OPENAI_API_KEY is not configured. Connect an OpenAI-compatible AI API before running support chat.",
      model,
      provider: "openai_compatible"
    };
  }

  try {
    const client = getClient();
    const startedAt = Date.now();
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: promptBundle.systemPrompt
        },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content
        }))
      ],
      temperature: 0.35
    });
    const latencyMs = Date.now() - startedAt;
    const raw = completion.choices[0]?.message?.content ?? "";

    return {
      assistantMessage: raw,
      prompt: promptBundle.promptForDisplay,
      rawModelResponse: raw,
      latencyMs,
      model,
      provider: "openai_compatible"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown LLM error.";

    return {
      prompt: promptBundle.promptForDisplay,
      error: message,
      rawModelResponse: error instanceof Error ? error.message : String(error),
      model,
      provider: "openai_compatible"
    };
  }
}
