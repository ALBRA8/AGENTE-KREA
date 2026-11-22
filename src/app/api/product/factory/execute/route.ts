import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";

/**
 * POST /api/product/factory/execute
 * Execute a factory for a product.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { productId, factoryType, contract } = body;

    if (!productId || !factoryType) {
      return NextResponse.json(
        { error: "productId y factoryType son obligatorios" },
        { status: 400 }
      );
    }

    // Verify dossier ownership
    const dossier = await db.productDossier.findFirst({
      where: { id: productId, userId: user.id },
    });
    if (!dossier) {
      return NextResponse.json({ error: "Dossier no encontrado o sin permisos" }, { status: 404 });
    }

    const execution = await db.factoryExecution.create({
      data: {
        userId: user.id,
        executionId: createId(),
        productId,
        factoryType,
        contract: contract || "{}",
        status: "CREATED",
        startedAt: new Date(),
      },
    });

    return NextResponse.json(execution, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error ejecutando factory";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
