import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";

/**
 * POST /api/product/launch-package
 * Generate a launch package for a product.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      productId, version, product, offer, positioning, targetCustomer,
      corePromise, benefits, included, bonuses, price, delivery,
      faq, objections, cta, assets, proofStatus, disclaimers,
    } = body;

    if (!productId || !corePromise || !cta) {
      return NextResponse.json(
        { error: "productId, corePromise y cta son obligatorios" },
        { status: 400 }
      );
    }

    // Verify ownership via dossier
    const dossier = await db.productDossier.findFirst({
      where: { id: productId, userId: user.id },
    });
    if (!dossier) {
      return NextResponse.json({ error: "Dossier no encontrado o sin permisos" }, { status: 404 });
    }

    const launchPackage = await db.launchPackage.create({
      data: {
        userId: user.id,
        packageId: createId(),
        productId,
        version: version || "1.0.0",
        product: product || "{}",
        offer: offer || "{}",
        positioning: positioning || "",
        targetCustomer: targetCustomer || "{}",
        corePromise,
        benefits: benefits || "[]",
        included: included || "[]",
        bonuses: bonuses || "[]",
        price: price || "{}",
        delivery: delivery || "{}",
        faq: faq || "[]",
        objections: objections || "[]",
        cta,
        assets: assets || "[]",
        proofStatus: proofStatus || "[]",
        disclaimers: disclaimers || "[]",
      },
    });

    return NextResponse.json(launchPackage, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error creando launch package";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
