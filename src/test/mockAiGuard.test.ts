import { describe, expect, it } from "vitest";
import { MockAiGuardProvider, detectPromptInjection } from "@/lib/guardrails/mockAiGuard";
import { obviousInjectionResume } from "@/data/obviousInjectionResume";
import { cleanResume } from "@/data/cleanResume";

describe("Mock AI Guard", () => {
  it("detects prompt injection phrases deterministically", () => {
    const detections = detectPromptInjection(obviousInjectionResume);
    expect(detections.length).toBeGreaterThan(0);
    expect(detections[0].type).toBe("prompt_injection");
  });

  it("blocks injected resumes and allows clean resumes", async () => {
    const guard = new MockAiGuardProvider();

    await expect(
      guard.inspect({ stage: "prompt", content: obviousInjectionResume })
    ).resolves.toMatchObject({ action: "blocked" });

    await expect(
      guard.inspect({ stage: "prompt", content: cleanResume })
    ).resolves.toMatchObject({ action: "allowed", detections: [] });
  });
});
