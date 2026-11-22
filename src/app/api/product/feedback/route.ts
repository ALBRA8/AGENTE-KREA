import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/feedback
 * List commercial feedback for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");
    const feedbackType = url.searchParams.get("feedbackType");

    const where: Record<string, unknown> = { userId: user.id };
    if (productId) where.productId = productId;
    if (feedbackType) where.feedbackType = feedbackType;

    const feedbacks = await db.commercialFeedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ feedbacks });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error obteniendo feedback";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/product/feedback
 * Create commercial feedback.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { productId, version, feedbackType, category, content, source } = body;

    if (!productId || !feedbackType || !category || !content) {
      return NextResponse.json(
        { error: "productId, feedbackType, category y content son obligatorios" },
        { status: 400 }
      );
    }

    const feedback = await db.commercialFeedback.create({
      data: {
        userId: user.id,
        productId,
        version: version || "1.0.0",
        feedbackType,
        category,
        content,
        source: source || "user",
      },
    });

    return NextResponse.json(feedback, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error creando feedback";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
