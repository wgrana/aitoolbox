import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    appMode: process.env.APP_MODE || "local",
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    openAiBaseUrlConfigured: Boolean(process.env.OPENAI_BASE_URL),
    aiGuardMode: process.env.AI_GUARD_MODE || "mock"
  });
}
