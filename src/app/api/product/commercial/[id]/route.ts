import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/commercial/[id]
 * Get a commercial product by ID (ownership enforced).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { id } = await params;
    const commercial = await db.commercialProduct.findFirst({
      where: { id, userId: user.id },
      include: { dossier: true },
    });

    if (!commercial) {
      return NextResponse.json({ error: "Producto comercial no encontrado" }, { status: 404 });
    }

    return NextResponse.json(commercial);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error obteniendo producto comercial";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
