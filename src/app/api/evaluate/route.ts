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

function noGuardrailResult(mode: "simple" | "enhanced"): EvaluateResponse["guardrailResult"] {
  return {
    provider: "none",
    promptAction: "not_inspected",
    responseAction: "not_inspected",
    detections: []
  };
}

export async function POST(request: Request) {
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
  const promptResult = await provider.inspect({
    stage: "prompt",
    content: `${prompt}\n\nRAW RESUME CONTENT:\n${input.resumeText}`,
    metadata
  });
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
        detections: promptResult.detections
      },
      auditTrail,
      raw: {
        promptSentToModel: prompt,
        rawGuardrailResponse: promptResult.raw
      }
    } satisfies EvaluateResponse);
  }

  auditTrail.push(promptResult.action === "flagged" ? "Prompt flagged but evaluation continued" : "Prompt allowed");
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
        detections: promptResult.detections
      },
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
  const responseResult = await provider.inspect({
    stage: "response",
    content: llmResult.rawModelResponse || JSON.stringify(llmResult.modelOutput),
    metadata
  });

  if (responseResult.action === "blocked") {
    auditTrail.push("Response blocked");
    auditTrail.push("Final decision set to manual review");
  } else {
    auditTrail.push(responseResult.action === "flagged" ? "Response flagged" : "Response allowed");
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
      detections: [...promptResult.detections, ...responseResult.detections]
    },
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
