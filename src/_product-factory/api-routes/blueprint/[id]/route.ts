import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/blueprint/[id]
 * Get a blueprint by ID (ownership enforced).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { id } = await params;
    const blueprint = await db.productBlueprint.findFirst({
      where: { id, userId: user.id },
      include: { dossier: true },
    });

    if (!blueprint) {
      return NextResponse.json({ error: "Blueprint no encontrado" }, { status: 404 });
    }

    return NextResponse.json(blueprint);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error obteniendo blueprint";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
