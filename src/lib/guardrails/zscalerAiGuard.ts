import type {
  GuardrailInspectionInput,
  GuardrailInspectionResult,
  GuardrailThreatScore,
  GuardrailProvider
} from "@/lib/guardrails/types";

type ZscalerConfig = {
  baseUrl?: string;
  apiKey?: string;
  policyId?: string;
  promptDirection?: "IN" | "OUT";
  responseDirection?: "IN" | "OUT";
};

const DEFAULT_BASE_URL = "https://api.zseclipse.net";

function readConfig(): ZscalerConfig {
  return {
    baseUrl: process.env.AI_GUARD_API_BASE_URL,
    apiKey: process.env.AI_GUARD_API_KEY,
    policyId: process.env.AI_GUARD_POLICY_ID,
    promptDirection: readDirection(process.env.AI_GUARD_PROMPT_DIRECTION) || "IN",
    responseDirection: readDirection(process.env.AI_GUARD_RESPONSE_DIRECTION) || "OUT"
  };
}

function readDirection(value?: string) {
  const normalized = value?.toUpperCase();
  return normalized === "IN" || normalized === "OUT" ? normalized : undefined;
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

function buildExecutePolicyUrl(baseUrl: string) {
  const trimmedBaseUrl = baseUrl.replace(/\/$/, "");

  if (/\/execute-policy$/i.test(trimmedBaseUrl) || /\/resolve-and-execute-policy$/i.test(trimmedBaseUrl)) {
    return trimmedBaseUrl;
  }

  return `${trimmedBaseUrl}/v1/detection/execute-policy`;
}

export function normalizeZscalerResponse(raw: unknown): GuardrailInspectionResult {
  const rawRecord = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const lowerRaw = JSON.stringify(rawRecord).toLowerCase();
  const statusCode = readNumber(rawRecord, ["statusCode", "status_code", "code"]);
  const errorMessage = readString(rawRecord, ["errorMsg", "error", "message"]);
  const explicitAction = readString(rawRecord, ["action", "verdict", "decision", "result", "status"]);
  const allowed = readBoolean(rawRecord, ["allowed", "isAllowed", "pass", "passed"]);
  const apiError = typeof statusCode === "number" && statusCode >= 400;
  const noDetectors = isNoEnabledDetectorsMessage(errorMessage);
  const blocked =
    (apiError && !noDetectors) ||
    (explicitAction ? /block|deny|reject|quarantine/.test(explicitAction.toLowerCase()) :
    allowed === false || lowerRaw.includes('"blocked"') || lowerRaw.includes('"block"'));
  const flagged =
    !blocked && (
      explicitAction ? /flag|warn|review|detect|alert/.test(explicitAction.toLowerCase()) :
      lowerRaw.includes("violation") || lowerRaw.includes("detection") || lowerRaw.includes("risk")
    );
  const detections = extractDetections(rawRecord);

  return {
    provider: "zscaler_ai_guard",
    action: noDetectors ? "not_inspected" : blocked ? "blocked" : flagged ? "flagged" : "allowed",
    threatScores: noDetectors ? [] : extractThreatScores(rawRecord),
    detections: apiError && !noDetectors
      ? [
          {
            type: "ai_guard_policy_error",
            severity: "high",
            location: "prompt",
            explanation: errorMessage || `AI Guard policy returned statusCode ${statusCode}.`
          }
        ]
      : detections,
    raw
  };
}

function isNoEnabledDetectorsMessage(message?: string) {
  return Boolean(
    message &&
      (
        /does not have any enabled detectors/i.test(message) ||
        /all detectors are either not found or had execution errors/i.test(message)
      )
  );
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
  }

  return undefined;
}

function readBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }

  return undefined;
}

function readNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") return value;
  }

  return undefined;
}

function readOptionalNumber(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return undefined;
  return readNumber(record, keys);
}

function extractThreatScores(record: Record<string, unknown>): GuardrailThreatScore[] {
  const detectorScores = extractDetectorResponseScores(record);
  if (detectorScores.length) return detectorScores;

  const candidates = [
    record.threatScores,
    record.detectorScores,
    record.riskScores,
    record.scores
  ].find(Array.isArray) as Array<Record<string, unknown>> | undefined;

  if (!candidates) return [];

  return candidates.map((candidate, index) => {
    const name = String(candidate.name || candidate.detector || candidate.type || candidate.category || `Detector ${index + 1}`);
    const score = readNumber(candidate, ["score", "topScore", "threatScore", "riskScore", "confidence"]);
    const threshold = readNumber(candidate, ["threshold", "blockThreshold", "warnThreshold"]);
    const action = readString(candidate, ["action", "verdict", "decision", "result"]);

    return {
      name,
      score,
      threshold,
      action,
      triggered: typeof candidate.triggered === "boolean" ? candidate.triggered : undefined,
      severity: normalizeSeverity(candidate.severity),
      location: normalizeLocation(candidate.location),
      explanation: String(candidate.explanation || candidate.message || candidate.description || "")
    };
  });
}

function extractDetectorResponseScores(record: Record<string, unknown>): GuardrailThreatScore[] {
  const detectorResponses =
    record.detectorResponses && typeof record.detectorResponses === "object"
      ? record.detectorResponses as Record<string, unknown>
      : undefined;

  if (!detectorResponses) return [];

  return Object.entries(detectorResponses)
    .filter(([, detector]) => detector && typeof detector === "object")
    .map(([name, detector]) => {
      const detectorRecord = detector as Record<string, unknown>;
      const details = detectorRecord.details && typeof detectorRecord.details === "object"
        ? detectorRecord.details as Record<string, unknown>
        : undefined;
      const score =
        readOptionalNumber(details, ["topScore", "score", "threatScore", "riskScore", "confidence"]) ??
        readNumber(detectorRecord, ["topScore", "score", "threatScore", "riskScore", "confidence"]);
      const threshold =
        readOptionalNumber(details, ["threshold", "blockThreshold", "warnThreshold"]) ??
        readNumber(detectorRecord, ["threshold", "blockThreshold", "warnThreshold"]);
      const action = readString(detectorRecord, ["action", "verdict", "decision", "result"]);
      const triggered = typeof detectorRecord.triggered === "boolean" ? detectorRecord.triggered : undefined;

      return {
        name,
        score,
        threshold,
        action,
        triggered,
        severity: normalizeSeverity(detectorRecord.severity),
        location: normalizeLocation(detectorRecord.location),
        explanation: score === undefined
          ? "AI Guard returned this detector without a numeric score."
          : "AI Guard returned a detector threat score for this content."
      };
    });
}

function extractDetections(record: Record<string, unknown>): GuardrailInspectionResult["detections"] {
  const candidates = [
    record.detections,
    record.violations,
    record.threats,
    record.findings,
    record.matches
  ].find(Array.isArray) as Array<Record<string, unknown>> | undefined;

  if (!candidates) {
    return extractDetectorResponses(record);
  }

  return candidates.map((candidate) => ({
    type: String(candidate.type || candidate.name || candidate.category || "ai_guard_detection"),
    severity: normalizeSeverity(candidate.severity),
    location: normalizeLocation(candidate.location),
    explanation: String(candidate.explanation || candidate.message || candidate.description || "AI Guard reported a detection.")
  }));
}

function extractDetectorResponses(record: Record<string, unknown>): GuardrailInspectionResult["detections"] {
  const detectorResponses =
    record.detectorResponses && typeof record.detectorResponses === "object"
      ? record.detectorResponses as Record<string, Record<string, unknown>>
      : undefined;

  if (!detectorResponses) return [];

  return Object.entries(detectorResponses)
    .filter(([, detector]) => {
      const action = readString(detector, ["action", "verdict", "decision"]);
      return detector.triggered === true || Boolean(action && /block|flag|warn|review|detect|alert/.test(action.toLowerCase()));
    })
    .map(([name, detector]) => {
      const action = readString(detector, ["action", "verdict", "decision"]) || "DETECTED";
      const details = detector.details && typeof detector.details === "object"
        ? detector.details as Record<string, unknown>
        : {};
      const topScore = typeof details.topScore === "number" ? ` Score: ${details.topScore.toFixed(2)}.` : "";

      return {
        type: name,
        severity: normalizeSeverity(detector.severity),
        location: "prompt",
        explanation: `Zscaler AI Guard detector ${action.toLowerCase()} this content.${topScore}`
      };
    });
}

function normalizeSeverity(value: unknown): GuardrailInspectionResult["detections"][number]["severity"] {
  const severity = String(value || "medium").toLowerCase();
  if (["info", "low", "medium", "high", "critical"].includes(severity)) {
    return severity as GuardrailInspectionResult["detections"][number]["severity"];
  }

  return "medium";
}

function normalizeLocation(value: unknown): GuardrailInspectionResult["detections"][number]["location"] {
  const location = String(value || "").toLowerCase();
  if (location === "prompt" || location === "response" || location === "resume") return location;
  return "prompt";
}

export class ZscalerAiGuardProvider implements GuardrailProvider {
  async inspect(input: GuardrailInspectionInput): Promise<GuardrailInspectionResult> {
    const config = readConfig();
    const missing = missingConfig(config);

    if (missing.length > 0) {
      return {
        provider: "zscaler_ai_guard",
        action: "blocked",
        threatScores: [],
        detections: [
          {
            type: "guardrail_configuration_error",
            severity: "high",
            location: input.stage,
            explanation: `AI Guard Mode requires these env vars before it can run: ${missing.join(", ")}.`
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
    return this.executePolicy(input, readConfig().promptDirection || "IN");
  }

  async inspectResponse(input: GuardrailInspectionInput): Promise<GuardrailInspectionResult> {
    return this.executePolicy(input, readConfig().responseDirection || "OUT");
  }

  private async executePolicy(
    input: GuardrailInspectionInput,
    direction: "OUT" | "IN"
  ): Promise<GuardrailInspectionResult> {
    const config = readConfig();
    const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
    const response = await fetch(buildExecutePolicyUrl(baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        policyId: Number(config.policyId) || config.policyId,
        direction,
        content: input.content || ""
      }),
      signal: AbortSignal.timeout(30000)
    });

    const text = await response.text();
    const raw = parseJsonOrText(text);

    if (!response.ok) {
      const rawRecord = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      const errorMessage = readString(rawRecord, ["errorMsg", "error", "message"]);

      if (isNoEnabledDetectorsMessage(errorMessage)) {
        return {
          provider: "zscaler_ai_guard",
          action: "not_inspected",
          threatScores: [],
          detections: [],
          raw
        };
      }

      return {
        provider: "zscaler_ai_guard",
        action: "blocked",
        threatScores: [],
        detections: [
          {
            type: "ai_guard_api_error",
            severity: "high",
            location: input.stage,
            explanation: `AI Guard API returned HTTP ${response.status}.`
          }
        ],
        raw
      };
    }

    const normalized = normalizeZscalerResponse(raw);
    return {
      ...normalized,
      threatScores: normalized.threatScores.map((score) => ({
        ...score,
        location: input.stage
      })),
      detections: normalized.detections.map((detection) => ({
        ...detection,
        location: input.stage
      }))
    };
  }
}

function parseJsonOrText(text: string) {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { body: text };
  }
}
