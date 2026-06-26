import { NextResponse } from "next/server";
import { getGuardrailProvider } from "@/lib/guardrails";
import {
  blockedDecision,
  guardedDecision,
  modelDrivenDecision
} from "@/lib/policy/finalDecision";
import { buildPrompt, evaluateResumeWithLLM } from "@/lib/llm";
import {
  type EvaluateResponse,
  evaluateRequestSchema
} from "@/lib/types";

export const runtime = "nodejs";

function getBaseUrlHost() {
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

function createRunMetadata(startedAtMs: number, llmLatencyMs?: number, guardrailLatencyMs?: number) {
  const completedAtMs = Date.now();

  return {
    provider: "openai_compatible" as const,
    baseUrlHost: getBaseUrlHost(),
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date(completedAtMs).toISOString(),
    totalLatencyMs: completedAtMs - startedAtMs,
    llmLatencyMs,
    guardrailLatencyMs
  };
}

function noGuardrailResult(mode: "simple" | "enhanced"): EvaluateResponse["guardrailResult"] {
  return {
    provider: "none",
    promptAction: "not_inspected",
    responseAction: "not_inspected",
    threatScores: [],
    detections: []
  };
}

export async function POST(request: Request) {
  const startedAtMs = Date.now();
  const body = await request.json().catch(() => null);
  const parsed = evaluateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid evaluation request.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const auditTrail = ["Resume received", "Job posting loaded"];

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        mode: input.mode,
        finalDecision: {
          scoreTrusted: false,
          finalRecommendation: "manual_review",
          explanation:
            "OPENAI_API_KEY is not configured. Connect an OpenAI-compatible AI API before running this demo."
        },
        guardrailResult: {
          provider: "none",
          promptAction: "not_inspected",
          responseAction: "not_inspected",
          threatScores: [],
          detections: []
        },
        auditTrail: [
          ...auditTrail,
          "Evaluation stopped because no OpenAI-compatible API key is configured"
        ],
        runMetadata: createRunMetadata(startedAtMs),
        raw: {
          promptSentToModel: buildPrompt(input)
        }
      } satisfies EvaluateResponse,
      { status: 400 }
    );
  }

  if (input.mode === "simple" || input.mode === "enhanced") {
    auditTrail.push(
      input.mode === "simple"
        ? "Simple prompt built"
        : "Enhanced prompt built with untrusted-content warning"
    );
    const llmResult = await evaluateResumeWithLLM(input);

    if (!llmResult.modelOutput) {
      return NextResponse.json({
        mode: input.mode,
        finalDecision: {
          scoreTrusted: false,
          finalRecommendation: "manual_review",
          explanation: llmResult.error || "Model evaluation failed."
        },
        guardrailResult: noGuardrailResult(input.mode),
        runMetadata: createRunMetadata(startedAtMs, llmResult.latencyMs),
        auditTrail: [...auditTrail, "LLM evaluation failed", "Final decision set to manual review"],
        raw: {
          promptSentToModel: llmResult.prompt,
          rawModelResponse: llmResult.rawModelResponse
        }
      } satisfies EvaluateResponse);
    }

    auditTrail.push("LLM evaluation completed");
    auditTrail.push(
      input.mode === "simple"
        ? "Model recommendation accepted without runtime guardrail inspection"
        : "No external guardrail inspection performed"
    );
    auditTrail.push(
      input.mode === "simple"
        ? "Final decision generated"
        : "Final decision generated from model output"
    );

    return NextResponse.json({
      mode: input.mode,
      modelOutput: llmResult.modelOutput,
      finalDecision: modelDrivenDecision(llmResult.modelOutput, input.mode),
      guardrailResult: noGuardrailResult(input.mode),
      runMetadata: createRunMetadata(startedAtMs, llmResult.latencyMs),
      auditTrail,
      raw: {
        promptSentToModel: llmResult.prompt,
        rawModelResponse: llmResult.rawModelResponse
      }
    } satisfies EvaluateResponse);
  }

  auditTrail.push("AI Guard prompt built");
  const prompt = buildPrompt(input);
  const provider = getGuardrailProvider();
  const metadata = {
    appName: "AI Resume Screener",
    mode: input.mode,
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    policyId: process.env.AI_GUARD_POLICY_ID
  };

  auditTrail.push("Prompt submitted to guardrail provider");
  const promptGuardStartedAt = Date.now();
  const promptResult = await provider.inspect({
    stage: "prompt",
    content: input.resumeText,
    metadata
  });
  const promptGuardLatencyMs = Date.now() - promptGuardStartedAt;
  auditTrail.push("Prompt injection detection completed");

  if (promptResult.action === "blocked") {
    auditTrail.push("LLM call blocked due to guardrail result");
    auditTrail.push("Final decision set to manual review");

    return NextResponse.json({
      mode: input.mode,
      finalDecision: blockedDecision(promptResult, "prompt"),
      guardrailResult: {
        provider: promptResult.provider,
        promptAction: promptResult.action,
        responseAction: "not_inspected",
        threatScores: promptResult.threatScores,
        detections: promptResult.detections
      },
      runMetadata: createRunMetadata(startedAtMs, undefined, promptGuardLatencyMs),
      auditTrail,
      raw: {
        promptSentToModel: prompt,
        rawGuardrailResponse: promptResult.raw
      }
    } satisfies EvaluateResponse);
  }

  auditTrail.push(
    promptResult.action === "flagged"
      ? "Prompt flagged but evaluation continued"
      : promptResult.action === "not_inspected"
        ? "Prompt inspection skipped because no detectors are enabled for that direction"
        : "Prompt allowed"
  );
  const llmResult = await evaluateResumeWithLLM(input);

  if (!llmResult.modelOutput) {
    return NextResponse.json({
      mode: input.mode,
      finalDecision: {
        scoreTrusted: false,
        finalRecommendation: "manual_review",
        explanation: llmResult.error || "Model evaluation failed."
      },
      guardrailResult: {
        provider: promptResult.provider,
        promptAction: promptResult.action,
        responseAction: "not_inspected",
        threatScores: promptResult.threatScores,
        detections: promptResult.detections
      },
      runMetadata: createRunMetadata(startedAtMs, llmResult.latencyMs, promptGuardLatencyMs),
      auditTrail: [...auditTrail, "LLM evaluation failed", "Final decision set to manual review"],
      raw: {
        promptSentToModel: llmResult.prompt,
        rawModelResponse: llmResult.rawModelResponse,
        rawGuardrailResponse: promptResult.raw
      }
    } satisfies EvaluateResponse);
  }

  auditTrail.push("LLM evaluation completed");
  auditTrail.push("Response submitted to guardrail provider");
  const responseGuardStartedAt = Date.now();
  const responseResult = await provider.inspect({
    stage: "response",
    content: llmResult.rawModelResponse || JSON.stringify(llmResult.modelOutput),
    metadata
  });
  const totalGuardrailLatencyMs = promptGuardLatencyMs + (Date.now() - responseGuardStartedAt);

  if (responseResult.action === "blocked") {
    auditTrail.push("Response blocked");
    auditTrail.push("Final decision set to manual review");
  } else {
    auditTrail.push(
      responseResult.action === "flagged"
        ? "Response flagged"
        : responseResult.action === "not_inspected"
          ? "Response inspection skipped because no detectors are enabled for that direction"
          : "Response allowed"
    );
    auditTrail.push("Final decision generated");
  }

  const finalDecision =
    responseResult.action === "blocked"
      ? blockedDecision(responseResult, "response")
      : guardedDecision(llmResult.modelOutput, promptResult, responseResult);

  return NextResponse.json({
    mode: input.mode,
    modelOutput: llmResult.modelOutput,
    finalDecision,
    guardrailResult: {
      provider: promptResult.provider,
      promptAction: promptResult.action,
      responseAction: responseResult.action,
      threatScores: [...promptResult.threatScores, ...responseResult.threatScores],
      detections: [...promptResult.detections, ...responseResult.detections]
    },
    runMetadata: createRunMetadata(startedAtMs, llmResult.latencyMs, totalGuardrailLatencyMs),
    auditTrail,
    raw: {
      promptSentToModel: llmResult.prompt,
      rawModelResponse: llmResult.rawModelResponse,
      rawGuardrailResponse: {
        prompt: promptResult.raw,
        response: responseResult.raw
      }
    }
  } satisfies EvaluateResponse);
}
