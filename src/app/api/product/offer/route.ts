import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/product/offer
 * Create offer architecture for a product.
 * Updates CommercialProduct price/positioning fields.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      productId, priceStrategy, priceRange, monetizationModel,
      positioning, keyBenefits, objections, proofRequirements,
    } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId es obligatorio" }, { status: 400 });
    }

    const existing = await db.commercialProduct.findFirst({
      where: { productId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Producto comercial no encontrado" }, { status: 404 });
    }

    const updated = await db.commercialProduct.update({
      where: { id: existing.id },
      data: {
        ...(priceStrategy && { priceStrategy }),
        ...(priceRange && { priceRange }),
        ...(monetizationModel && { monetizationModel }),
        ...(positioning && { positioning }),
        ...(keyBenefits && { keyBenefits }),
        ...(objections && { objections }),
        ...(proofRequirements && { proofRequirements }),
      },
    });

    return NextResponse.json({
      offer: {
        productId: updated.productId,
        priceStrategy: updated.priceStrategy,
        priceRange: updated.priceRange,
        monetizationModel: updated.monetizationModel,
        positioning: updated.positioning,
        keyBenefits: updated.keyBenefits,
        objections: updated.objections,
        proofRequirements: updated.proofRequirements,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error creando oferta";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
