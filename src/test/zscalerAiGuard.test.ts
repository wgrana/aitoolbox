import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeZscalerResponse, ZscalerAiGuardProvider } from "@/lib/guardrails/zscalerAiGuard";

const originalFetch = global.fetch;
const originalEnv = {
  AI_GUARD_API_BASE_URL: process.env.AI_GUARD_API_BASE_URL,
  AI_GUARD_API_KEY: process.env.AI_GUARD_API_KEY,
  AI_GUARD_POLICY_ID: process.env.AI_GUARD_POLICY_ID,
  AI_GUARD_PROMPT_DIRECTION: process.env.AI_GUARD_PROMPT_DIRECTION,
  AI_GUARD_RESPONSE_DIRECTION: process.env.AI_GUARD_RESPONSE_DIRECTION
};

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
  restoreEnv("AI_GUARD_API_BASE_URL", originalEnv.AI_GUARD_API_BASE_URL);
  restoreEnv("AI_GUARD_API_KEY", originalEnv.AI_GUARD_API_KEY);
  restoreEnv("AI_GUARD_POLICY_ID", originalEnv.AI_GUARD_POLICY_ID);
  restoreEnv("AI_GUARD_PROMPT_DIRECTION", originalEnv.AI_GUARD_PROMPT_DIRECTION);
  restoreEnv("AI_GUARD_RESPONSE_DIRECTION", originalEnv.AI_GUARD_RESPONSE_DIRECTION);
});

function restoreEnv(name: keyof typeof originalEnv, value?: string) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("Zscaler AI Guard adapter", () => {
  it("blocks when required external AI Guard env vars are missing", async () => {
    const originalBaseUrl = process.env.AI_GUARD_API_BASE_URL;
    const originalApiKey = process.env.AI_GUARD_API_KEY;
    const originalPolicyId = process.env.AI_GUARD_POLICY_ID;

    delete process.env.AI_GUARD_API_BASE_URL;
    delete process.env.AI_GUARD_API_KEY;
    delete process.env.AI_GUARD_POLICY_ID;

    const result = await new ZscalerAiGuardProvider().inspect({
      stage: "prompt",
      content: "test"
    });

    if (originalBaseUrl === undefined) {
      delete process.env.AI_GUARD_API_BASE_URL;
    } else {
      process.env.AI_GUARD_API_BASE_URL = originalBaseUrl;
    }

    if (originalApiKey === undefined) {
      delete process.env.AI_GUARD_API_KEY;
    } else {
      process.env.AI_GUARD_API_KEY = originalApiKey;
    }

    if (originalPolicyId === undefined) {
      delete process.env.AI_GUARD_POLICY_ID;
    } else {
      process.env.AI_GUARD_POLICY_ID = originalPolicyId;
    }

    expect(result).toMatchObject({
      provider: "zscaler_ai_guard",
      action: "blocked"
    });
    expect(result.detections[0].type).toBe("guardrail_configuration_error");
  });

  it("uses IN for prompt inspection and OUT for response inspection by default", async () => {
    process.env.AI_GUARD_API_BASE_URL = "https://api.zseclipse.net";
    process.env.AI_GUARD_API_KEY = "test-key";
    process.env.AI_GUARD_POLICY_ID = "123";
    delete process.env.AI_GUARD_PROMPT_DIRECTION;
    delete process.env.AI_GUARD_RESPONSE_DIRECTION;

    const bodies: unknown[] = [];
    global.fetch = vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ statusCode: 200, action: "ALLOW" }), { status: 200 });
    }) as typeof fetch;

    const provider = new ZscalerAiGuardProvider();
    await provider.inspect({ stage: "prompt", content: "prompt content" });
    await provider.inspect({ stage: "response", content: "response content" });

    expect(bodies).toMatchObject([
      { policyId: 123, direction: "IN", content: "prompt content" },
      { policyId: 123, direction: "OUT", content: "response content" }
    ]);
  });

  it("allows direction mapping overrides for tenants with different policy wiring", async () => {
    process.env.AI_GUARD_API_BASE_URL = "https://api.zseclipse.net";
    process.env.AI_GUARD_API_KEY = "test-key";
    process.env.AI_GUARD_POLICY_ID = "123";
    process.env.AI_GUARD_PROMPT_DIRECTION = "OUT";
    process.env.AI_GUARD_RESPONSE_DIRECTION = "IN";

    const bodies: unknown[] = [];
    global.fetch = vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ statusCode: 200, action: "ALLOW" }), { status: 200 });
    }) as typeof fetch;

    const provider = new ZscalerAiGuardProvider();
    await provider.inspect({ stage: "prompt", content: "prompt content" });
    await provider.inspect({ stage: "response", content: "response content" });

    expect(bodies).toMatchObject([
      { direction: "OUT", content: "prompt content" },
      { direction: "IN", content: "response content" }
    ]);
  });

  it("treats a missing detector direction as not inspected", () => {
    const result = normalizeZscalerResponse({
      statusCode: 400,
      errorMsg: "Policy does not have any enabled detectors in IN direction",
      direction: "IN"
    });

    expect(result).toMatchObject({
      provider: "zscaler_ai_guard",
      action: "not_inspected",
      detections: []
    });
  });

  it("extracts detector threat scores even when the policy allows content", () => {
    const result = normalizeZscalerResponse({
      statusCode: 200,
      action: "ALLOW",
      detectorResponses: {
        prompt_injection: {
          action: "ALLOW",
          triggered: false,
          severity: "low",
          details: {
            topScore: 0.12,
            threshold: 0.75
          }
        }
      }
    });

    expect(result).toMatchObject({
      provider: "zscaler_ai_guard",
      action: "allowed",
      threatScores: [
        {
          name: "prompt_injection",
          score: 0.12,
          threshold: 0.75,
          triggered: false,
          location: "prompt"
        }
      ]
    });
    expect(result.detections).toEqual([]);
  });
});
