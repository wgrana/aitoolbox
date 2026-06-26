import { NextResponse } from "next/server";
import { handleSupportChat } from "@/lib/supportChat";
import { supportChatRequestSchema } from "@/lib/supportTypes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = supportChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid support chat request.", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await handleSupportChat(parsed.data);
    const status = result.error ? 400 : 200;

    return NextResponse.json(result, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown support chat error.";

    return NextResponse.json(
      {
        blocked: true,
        error: message,
        guardrailResult: {
          provider: "none",
          promptAction: "not_inspected",
          responseAction: "not_inspected",
          threatScores: [],
          detections: []
        }
      },
      { status: 500 }
    );
  }
}
