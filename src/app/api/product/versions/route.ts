import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/versions
 * List all version records for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");

    const where: Record<string, unknown> = { userId: user.id };
    if (productId) where.productId = productId;

    const versions = await db.productVersionRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ versions });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error obteniendo versiones";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/product/versions
 * Create a new version record.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { productId, version, blueprintId, dossierId, executionId, assets, changes, parentId, status } = body;

    if (!productId || !version) {
      return NextResponse.json(
        { error: "productId y version son obligatorios" },
        { status: 400 }
      );
    }

    const record = await db.productVersionRecord.create({
      data: {
        userId: user.id,
        productId,
        version,
        blueprintId: blueprintId || null,
        dossierId: dossierId || null,
        executionId: executionId || null,
        assets: assets || "[]",
        changes: changes || "",
        parentId: parentId || null,
        status: status || "DRAFT",
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error creando versión";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
