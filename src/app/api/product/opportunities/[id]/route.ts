import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/product/opportunities/[id] — Get single opportunity (with ownership check)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { id } = await params;
    const opportunity = await db.productOpportunity.findUnique({
      where: { id },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    if (opportunity.userId !== user.id) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    return NextResponse.json({ data: opportunity });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener oportunidad";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
