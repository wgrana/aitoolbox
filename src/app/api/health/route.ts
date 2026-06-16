import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    openAiBaseUrlConfigured: Boolean(process.env.OPENAI_BASE_URL),
    aiGuardMode: "api_required",
    aiGuardConfigured: Boolean(
      process.env.AI_GUARD_API_BASE_URL &&
      process.env.AI_GUARD_API_KEY &&
      process.env.AI_GUARD_POLICY_ID
    )
  });
}
