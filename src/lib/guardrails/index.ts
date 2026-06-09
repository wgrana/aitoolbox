import type { GuardrailProvider } from "@/lib/guardrails/types";
import { MockAiGuardProvider } from "@/lib/guardrails/mockAiGuard";
import { ZscalerAiGuardProvider } from "@/lib/guardrails/zscalerAiGuard";

export function getGuardrailProvider(): GuardrailProvider {
  return process.env.AI_GUARD_MODE === "api"
    ? new ZscalerAiGuardProvider()
    : new MockAiGuardProvider();
}
