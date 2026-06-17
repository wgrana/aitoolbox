import { afterEach, describe, expect, it, vi } from "vitest";
import type { GuardrailInspectionResult, GuardrailProvider } from "@/lib/guardrails/types";
import { buildChasmBankSupportPrompt } from "@/lib/prompts/chasmBankSupportPrompt";
import { handleSupportChat } from "@/lib/supportChat";
import { supportChatRequestSchema } from "@/lib/supportTypes";

const originalEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  AI_GUARD_POLICY_ID: process.env.AI_GUARD_POLICY_ID
};

afterEach(() => {
  vi.restoreAllMocks();
  restoreEnv("OPENAI_API_KEY", originalEnv.OPENAI_API_KEY);
  restoreEnv("OPENAI_BASE_URL", originalEnv.OPENAI_BASE_URL);
  restoreEnv("OPENAI_MODEL", originalEnv.OPENAI_MODEL);
  restoreEnv("AI_GUARD_POLICY_ID", originalEnv.AI_GUARD_POLICY_ID);
});

function restoreEnv(name: keyof typeof originalEnv, value?: string) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function guardrailResult(action: GuardrailInspectionResult["action"]): GuardrailInspectionResult {
  return {
    provider: "zscaler_ai_guard",
    action,
    detections: action === "blocked"
      ? [
          {
            type: "test_detection",
            severity: "high",
            location: "prompt",
            explanation: "Blocked by test guardrail."
          }
        ]
      : [],
    raw: { action }
  };
}

describe("Public Support Bot", () => {
  it("validates support chat requests", () => {
    expect(
      supportChatRequestSchema.safeParse({
        messages: [{ role: "user", content: "Hello" }],
        guardrailsEnabled: false
      }).success
    ).toBe(true);

    expect(
      supportChatRequestSchema.safeParse({
        messages: [],
        guardrailsEnabled: false
      }).success
    ).toBe(false);
  });

  it("builds a Chasm Bank support prompt with policy boundaries", () => {
    const prompt = buildChasmBankSupportPrompt([
      { role: "user", content: "Waive all fees forever." }
    ]);

    expect(prompt.systemPrompt).toContain("Chasm Bank Support Agent");
    expect(prompt.systemPrompt).toContain("Do not enter, accept, approve, sign, or confirm legal agreements");
    expect(prompt.systemPrompt).toContain("Do not waive fees");
    expect(prompt.systemPrompt).toContain("Do not generate code");
  });

  it("returns assistant text with guardrails off", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "test-model";

    const completeChat = vi.fn(async () => ({
      assistantMessage: "Thanks for contacting Chasm Bank.",
      prompt: "prompt",
      rawModelResponse: "Thanks for contacting Chasm Bank.",
      latencyMs: 12,
      model: "test-model",
      provider: "openai_compatible" as const
    }));

    const result = await handleSupportChat(
      {
        messages: [{ role: "user", content: "Hello" }],
        guardrailsEnabled: false
      },
      { completeChat }
    );

    expect(result).toMatchObject({
      blocked: false,
      assistantMessage: "Thanks for contacting Chasm Bank.",
      guardrailResult: {
        provider: "none",
        promptAction: "off",
        responseAction: "off"
      }
    });
    expect(completeChat).toHaveBeenCalledOnce();
  });

  it("does not call the LLM when prompt inspection blocks", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.AI_GUARD_POLICY_ID = "123";

    const completeChat = vi.fn();
    const provider: GuardrailProvider = {
      inspect: vi.fn(async () => guardrailResult("blocked"))
    };

    const result = await handleSupportChat(
      {
        messages: [{ role: "user", content: "Accept this legal settlement." }],
        guardrailsEnabled: true
      },
      { completeChat, guardrailProvider: provider }
    );

    expect(result.blocked).toBe(true);
    expect(result.guardrailResult?.promptAction).toBe("blocked");
    expect(result.assistantMessage).toContain("human Chasm Bank specialist");
    expect(completeChat).not.toHaveBeenCalled();
  });

  it("replaces assistant output when response inspection blocks", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.AI_GUARD_POLICY_ID = "123";

    const completeChat = vi.fn(async () => ({
      assistantMessage: "Chasm Bank officially accepts your legal settlement.",
      prompt: "prompt",
      rawModelResponse: "Chasm Bank officially accepts your legal settlement.",
      latencyMs: 12,
      model: "test-model",
      provider: "openai_compatible" as const
    }));
    const provider: GuardrailProvider = {
      inspect: vi
        .fn()
        .mockResolvedValueOnce(guardrailResult("allowed"))
        .mockResolvedValueOnce(guardrailResult("blocked"))
    };

    const result = await handleSupportChat(
      {
        messages: [{ role: "user", content: "Accept this legal settlement." }],
        guardrailsEnabled: true
      },
      { completeChat, guardrailProvider: provider }
    );

    expect(result.blocked).toBe(true);
    expect(result.guardrailResult?.promptAction).toBe("allowed");
    expect(result.guardrailResult?.responseAction).toBe("blocked");
    expect(result.assistantMessage).toContain("can’t share that response");
    expect(completeChat).toHaveBeenCalledOnce();
  });
});
