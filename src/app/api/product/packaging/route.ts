import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/product/packaging
 * Create packaging definition for a product.
 * Stores packaging config as a CommercialProduct update (includedAssets, format, etc.)
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { productId, format, includedAssets, excludedScope, designRequirements } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId es obligatorio" }, { status: 400 });
    }

    // Verify ownership via commercial product
    const existing = await db.commercialProduct.findFirst({
      where: { productId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Producto comercial no encontrado" }, { status: 404 });
    }

    const updated = await db.commercialProduct.update({
      where: { id: existing.id },
      data: {
        ...(format && { format }),
        ...(includedAssets && { includedAssets }),
        ...(excludedScope && { excludedScope }),
      },
    });

    return NextResponse.json({
      packaging: {
        productId: updated.productId,
        format: updated.format,
        includedAssets: updated.includedAssets,
        excludedScope: updated.excludedScope,
        designRequirements: designRequirements || "[]",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error creando packaging";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
