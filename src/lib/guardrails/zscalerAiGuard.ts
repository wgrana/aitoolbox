import type {
  GuardrailInspectionInput,
  GuardrailInspectionResult,
  GuardrailProvider
} from "@/lib/guardrails/types";

type ZscalerConfig = {
  baseUrl?: string;
  apiKey?: string;
  policyId?: string;
};

function readConfig(): ZscalerConfig {
  return {
    baseUrl: process.env.AI_GUARD_API_BASE_URL,
    apiKey: process.env.AI_GUARD_API_KEY,
    policyId: process.env.AI_GUARD_POLICY_ID
  };
}

function missingConfig(config: ZscalerConfig) {
  return [
    ["AI_GUARD_API_BASE_URL", config.baseUrl],
    ["AI_GUARD_API_KEY", config.apiKey],
    ["AI_GUARD_POLICY_ID", config.policyId]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

export function normalizeZscalerResponse(raw: unknown): GuardrailInspectionResult {
  // TODO: Map the real Zscaler AI Guard response contract once the target API/proxy/DAS integration is selected.
  return {
    provider: "zscaler_ai_guard",
    action: "allowed",
    detections: [],
    raw
  };
}

export class ZscalerAiGuardProvider implements GuardrailProvider {
  async inspect(input: GuardrailInspectionInput): Promise<GuardrailInspectionResult> {
    const config = readConfig();
    const missing = missingConfig(config);

    if (missing.length > 0) {
      return {
        provider: "zscaler_ai_guard",
        action: "flagged",
        detections: [
          {
            type: "guardrail_configuration_error",
            severity: "high",
            location: input.stage,
            explanation: `AI_GUARD_MODE=api requires these env vars: ${missing.join(", ")}.`
          }
        ],
        raw: { missingEnv: missing }
      };
    }

    return input.stage === "prompt"
      ? this.inspectPrompt(input)
      : this.inspectResponse(input);
  }

  async inspectPrompt(input: GuardrailInspectionInput): Promise<GuardrailInspectionResult> {
    // TODO: Send prompt inspection request to the selected Zscaler AI Guard endpoint.
    return normalizeZscalerResponse({
      TODO: "Map prompt inspection request/response for Zscaler AI Guard.",
      policyId: input.metadata?.policyId
    });
  }

  async inspectResponse(input: GuardrailInspectionInput): Promise<GuardrailInspectionResult> {
    // TODO: Send response inspection request to the selected Zscaler AI Guard endpoint.
    return normalizeZscalerResponse({
      TODO: "Map response inspection request/response for Zscaler AI Guard.",
      policyId: input.metadata?.policyId
    });
  }
}
