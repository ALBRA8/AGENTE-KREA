import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/dossiers
 * List all dossiers for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const dossiers = await db.productDossier.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { opportunity: true, handoff: true },
    });

    return NextResponse.json({ dossiers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error loading dossiers";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/product/dossiers
 * Create a new dossier (typically from an evaluated opportunity).
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { opportunityId, productName, productType } = body;

    if (!productName) {
      return NextResponse.json({ error: "productName is required" }, { status: 400 });
    }

    const dossier = await db.productDossier.create({
      data: {
        userId: user.id,
        opportunityId: opportunityId || null,
        title: productName,
        description: "",
        domain: productType || "ebook",
        status: "IDEA",
      },
    });

    return NextResponse.json(dossier, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error creating dossier";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
