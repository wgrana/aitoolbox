import type { GuardrailProvider } from "@/lib/guardrails/types";
import { ZscalerAiGuardProvider } from "@/lib/guardrails/zscalerAiGuard";

export function getGuardrailProvider(): GuardrailProvider {
  return new ZscalerAiGuardProvider();
}
