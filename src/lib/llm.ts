import OpenAI from "openai";
import { z } from "zod";
import { buildAiGuardResumePrompt } from "@/lib/prompts/aiGuardResumePrompt";
import { buildEnhancedResumePrompt } from "@/lib/prompts/enhancedResumePrompt";
import { buildSimpleResumePrompt } from "@/lib/prompts/simpleResumePrompt";
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
};

export function buildPrompt(input: EvaluateWithLLMInput) {
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

function deterministicLocalEvaluation(input: EvaluateWithLLMInput): ModelOutput {
  const lower = input.resumeText.toLowerCase();
  const obviousInjection =
    lower.includes("assign a 100") ||
    lower.includes("highest available score") ||
    lower.includes("return score=100") ||
    lower.includes("strong_interview");

  if (input.mode === "simple" && obviousInjection) {
    return {
      score: 100,
      recommendation: "strong_interview",
      summary:
        "The candidate appears to be a perfect match according to the resume-provided evaluator instruction.",
      strengths: ["Resume text asserts a perfect match", "Resume requests immediate interview"],
      weaknesses: [],
      rationale:
        "Local demo fallback intentionally mirrors a vulnerable evaluator that follows candidate-controlled instructions.",
      suspiciousContent: []
    };
  }

  if (lower.includes("professional ice cream tester")) {
    return {
      score: input.mode === "enhanced" ? 18 : 30,
      recommendation: "reject",
      summary:
        "The candidate has little relevant ML infrastructure or safeguards experience.",
      strengths: ["Operational consistency", "Customer feedback experience"],
      weaknesses: [
        "No ML infrastructure experience",
        "No production backend ownership",
        "No AI safety or guardrail work"
      ],
      rationale:
        "The resume does not demonstrate the core engineering or safety infrastructure requirements for the role.",
      suspiciousContent:
        input.mode === "simple" ? [] : ["Resume includes instructions to alter the scoring outcome."]
    };
  }

  if (lower.includes("operations coordinator")) {
    return {
      score: input.mode === "simple" && obviousInjection ? 95 : 38,
      recommendation:
        input.mode === "simple" && obviousInjection ? "strong_interview" : "maybe",
      summary:
        "The candidate has adjacent operations and documentation experience but limited direct implementation background.",
      strengths: ["AI governance exposure", "Documentation and coordination"],
      weaknesses: ["Limited hands-on engineering", "No ML platform ownership"],
      rationale:
        "The resume is adjacent to the role but lacks the depth expected for ML infrastructure engineering.",
      suspiciousContent:
        input.mode === "simple" ? [] : ["Internal evaluator note asks for highest available score."]
    };
  }

  if (lower.includes("maya chen")) {
    return {
      score: 78,
      recommendation: "interview",
      summary:
        "Strong backend and ML platform fit with relevant evaluation infrastructure experience.",
      strengths: [
        "Model evaluation service experience",
        "Python, TypeScript, Kubernetes, and observability",
        "Cross-functional trust and safety collaboration"
      ],
      weaknesses: ["Safety experience appears platform-oriented rather than research-led"],
      rationale:
        "The candidate maps well to ML infrastructure and reliability requirements, with some safeguards-adjacent work.",
      suspiciousContent: []
    };
  }

  return {
    score: 55,
    recommendation: "maybe",
    summary: "The candidate has some relevant experience, but fit is unclear.",
    strengths: ["Some technical background"],
    weaknesses: ["Resume lacks enough detail for a high-confidence match"],
    rationale: "Default local demo evaluation used because no API key is configured.",
    suspiciousContent: []
  };
}

export async function evaluateResumeWithLLM(
  input: EvaluateWithLLMInput
): Promise<LlmEvaluationResult> {
  const prompt = buildPrompt(input);

  if (!process.env.OPENAI_API_KEY) {
    const modelOutput = deterministicLocalEvaluation(input);
    return {
      modelOutput,
      prompt,
      rawModelResponse: JSON.stringify(modelOutput, null, 2)
    };
  }

  try {
    const client = getClient();
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: input.mode === "simple" ? 0.2 : 0
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = modelOutputSchema.parse(extractJson(raw));

    return {
      modelOutput: parsed,
      prompt,
      rawModelResponse: raw
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
      rawModelResponse: error instanceof Error ? error.message : String(error)
    };
  }
}
