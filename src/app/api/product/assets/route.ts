import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/assets
 * List all assets for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");
    const type = url.searchParams.get("type");

    const where: Record<string, unknown> = { userId: user.id, status: "ACTIVE" };
    if (productId) where.productId = productId;
    if (type) where.type = type;

    const assets = await db.productAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ assets });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error obteniendo assets";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
