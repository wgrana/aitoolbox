import type { GuardrailInspectionResult, GuardrailProvider } from "@/lib/guardrails/types";
import { getGuardrailProvider } from "@/lib/guardrails";
import { chatWithSupportLLM } from "@/lib/llm";
import { buildChasmBankSupportPrompt } from "@/lib/prompts/chasmBankSupportPrompt";
import type { SupportChatRequest, SupportChatResponse } from "@/lib/supportTypes";

type CompleteChat = typeof chatWithSupportLLM;

type SupportChatDeps = {
  guardrailProvider?: GuardrailProvider;
  completeChat?: CompleteChat;
};

function getBaseUrlHost() {
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

function createRunMetadata(startedAtMs: number, llmLatencyMs?: number, guardrailLatencyMs?: number): SupportChatResponse["runMetadata"] {
  const completedAtMs = Date.now();

  return {
    provider: "openai_compatible",
    baseUrlHost: getBaseUrlHost(),
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date(completedAtMs).toISOString(),
    totalLatencyMs: completedAtMs - startedAtMs,
    llmLatencyMs,
    guardrailLatencyMs
  };
}

function offGuardrailResult(): SupportChatResponse["guardrailResult"] {
  return {
    provider: "none",
    promptAction: "off",
    responseAction: "off",
    threatScores: [],
    detections: []
  };
}

function blockedAssistantMessage(stage: "prompt" | "response") {
  return stage === "prompt"
    ? "I can’t continue with that request. I’m routing this conversation to a human Chasm Bank specialist for review."
    : "I can’t share that response. I’m routing this conversation to a human Chasm Bank specialist for review.";
}

function mergeGuardrailResult(
  promptResult: GuardrailInspectionResult,
  responseResult?: GuardrailInspectionResult
): SupportChatResponse["guardrailResult"] {
  return {
    provider: promptResult.provider,
    promptAction: promptResult.action,
    responseAction: responseResult?.action ?? "not_inspected",
    threatScores: [...promptResult.threatScores, ...(responseResult?.threatScores ?? [])],
    detections: [...promptResult.detections, ...(responseResult?.detections ?? [])]
  };
}

export async function handleSupportChat(
  input: SupportChatRequest,
  deps: SupportChatDeps = {}
): Promise<SupportChatResponse> {
  const startedAtMs = Date.now();
  const promptBundle = buildChasmBankSupportPrompt(input.messages);
  const latestUserMessage = [...input.messages].reverse().find((message) => message.role === "user");

  if (!process.env.OPENAI_API_KEY) {
    return {
      blocked: true,
      guardrailResult: input.guardrailsEnabled
        ? {
            provider: "zscaler_ai_guard",
            promptAction: "not_inspected",
            responseAction: "not_inspected",
            threatScores: [],
            detections: []
          }
        : offGuardrailResult(),
      runMetadata: createRunMetadata(startedAtMs),
      raw: {
        promptSentToModel: promptBundle.promptForDisplay
      },
      error: "OPENAI_API_KEY is not configured. Connect an OpenAI-compatible AI API before running this demo."
    };
  }

  let guardrailLatencyMs = 0;
  let promptResult: GuardrailInspectionResult | undefined;
  const provider = deps.guardrailProvider ?? getGuardrailProvider();
  const completeChat = deps.completeChat ?? chatWithSupportLLM;

  if (input.guardrailsEnabled) {
    const promptGuardStartedAt = Date.now();
    promptResult = await provider.inspect({
      stage: "prompt",
      content: latestUserMessage?.content ?? promptBundle.promptForDisplay,
      metadata: {
        appName: "Public Support Bot",
        mode: "support_chat",
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        policyId: process.env.AI_GUARD_POLICY_ID
      }
    });
    guardrailLatencyMs += Date.now() - promptGuardStartedAt;

    if (promptResult.action === "blocked") {
      return {
        assistantMessage: blockedAssistantMessage("prompt"),
        blocked: true,
        guardrailResult: mergeGuardrailResult(promptResult),
        runMetadata: createRunMetadata(startedAtMs, undefined, guardrailLatencyMs),
        raw: {
          promptSentToModel: promptBundle.promptForDisplay,
          rawGuardrailResponse: promptResult.raw
        }
      };
    }
  }

  const llmResult = await completeChat(input.messages);

  if (!llmResult.assistantMessage) {
    return {
      blocked: true,
      guardrailResult: promptResult ? mergeGuardrailResult(promptResult) : offGuardrailResult(),
      runMetadata: createRunMetadata(startedAtMs, llmResult.latencyMs, guardrailLatencyMs || undefined),
      raw: {
        promptSentToModel: llmResult.prompt,
        rawModelResponse: llmResult.rawModelResponse,
        rawGuardrailResponse: promptResult?.raw
      },
      error: llmResult.error || "Support chat failed."
    };
  }

  if (input.guardrailsEnabled && promptResult) {
    const responseGuardStartedAt = Date.now();
    const responseResult = await provider.inspect({
      stage: "response",
      content: llmResult.rawModelResponse || llmResult.assistantMessage,
      metadata: {
        appName: "Public Support Bot",
        mode: "support_chat",
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        policyId: process.env.AI_GUARD_POLICY_ID
      }
    });
    guardrailLatencyMs += Date.now() - responseGuardStartedAt;

    if (responseResult.action === "blocked") {
      return {
        assistantMessage: blockedAssistantMessage("response"),
        blocked: true,
        guardrailResult: mergeGuardrailResult(promptResult, responseResult),
        runMetadata: createRunMetadata(startedAtMs, llmResult.latencyMs, guardrailLatencyMs),
        raw: {
          promptSentToModel: llmResult.prompt,
          rawModelResponse: llmResult.rawModelResponse,
          rawGuardrailResponse: {
            prompt: promptResult.raw,
            response: responseResult.raw
          }
        }
      };
    }

    return {
      assistantMessage: llmResult.assistantMessage,
      blocked: false,
      guardrailResult: mergeGuardrailResult(promptResult, responseResult),
      runMetadata: createRunMetadata(startedAtMs, llmResult.latencyMs, guardrailLatencyMs),
      raw: {
        promptSentToModel: llmResult.prompt,
        rawModelResponse: llmResult.rawModelResponse,
        rawGuardrailResponse: {
          prompt: promptResult.raw,
          response: responseResult.raw
        }
      }
    };
  }

  return {
    assistantMessage: llmResult.assistantMessage,
    blocked: false,
    guardrailResult: offGuardrailResult(),
    runMetadata: createRunMetadata(startedAtMs, llmResult.latencyMs),
    raw: {
      promptSentToModel: llmResult.prompt,
      rawModelResponse: llmResult.rawModelResponse
    }
  };
}
