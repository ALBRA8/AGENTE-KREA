import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/factory/[executionId]
 * Get factory execution status (ownership enforced).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ executionId: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { executionId } = await params;
    const execution = await db.factoryExecution.findFirst({
      where: { executionId, userId: user.id },
    });

    if (!execution) {
      return NextResponse.json({ error: "Ejecución no encontrada" }, { status: 404 });
    }

    return NextResponse.json(execution);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error obteniendo ejecución";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
