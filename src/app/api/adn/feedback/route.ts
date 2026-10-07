import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { FeedbackManager } from "@/lib/feedback";

const feedbackManager = new FeedbackManager();

/**
 * GET /api/adn/feedback
 * List feedback (no auth required for reading).
 * Query params: type, validationStatus, limit
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const feedbackType = searchParams.get("type") as
      | "SUCCESS" | "PARTIAL_SUCCESS" | "FAILURE" | "TECHNICAL_ERROR"
      | "BAD_DECISION" | "BAD_HYPOTHESIS" | "BAD_TOOL" | "BAD_EXECUTION" | "UNKNOWN"
      | undefined;
    const validationStatus = searchParams.get("validationStatus") as
      | "PENDING" | "VALIDATED" | "INVALIDATED"
      | undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;

    const feedbacks = await feedbackManager.list({
      feedbackType,
      validationStatus,
      limit,
    });

    return NextResponse.json({ feedbacks, total: feedbacks.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error listing feedback";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/adn/feedback
 * Record feedback (auth required).
 * Body: executionId, feedbackType, feedbackText
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { executionId, feedbackType, feedbackText } = body;

    if (!feedbackType || !feedbackText) {
      return NextResponse.json(
        { error: "feedbackType and feedbackText are required" },
        { status: 400 }
      );
    }

    const result = await feedbackManager.record(
      executionId || null,
      feedbackType,
      feedbackText,
      { userId: user.id }
    );

    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error recording feedback";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
