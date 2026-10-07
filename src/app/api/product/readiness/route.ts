import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/product/readiness
 * Evaluate commercial readiness for a product.
 * Computes a readiness score and stores it on CommercialProduct.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId es obligatorio" }, { status: 400 });
    }

    const product = await db.commercialProduct.findFirst({
      where: { productId, userId: user.id },
    });
    if (!product) {
      return NextResponse.json({ error: "Producto comercial no encontrado" }, { status: 404 });
    }

    // Compute readiness score from existing data
    const keyBenefits = JSON.parse(product.keyBenefits || "[]");
    const objections = JSON.parse(product.objections || "[]");
    const proofReqs = JSON.parse(product.proofRequirements || "[]");
    const launchReqs = JSON.parse(product.launchRequirements || "[]");
    const risks = JSON.parse(product.risks || "[]");

    const scores: Record<string, number> = {};
    scores.valueProposition = product.valueProposition ? 0.8 : 0.2;
    scores.market = product.targetCustomer !== "{}" ? 0.7 : 0.2;
    scores.pricing = product.priceStrategy !== "{}" ? 0.7 : 0.2;
    scores.benefits = Math.min(1, keyBenefits.length * 0.2);
    scores.objections = objections.length > 0 ? 0.7 : 0.3;
    scores.proof = Math.min(1, proofReqs.length * 0.15);
    scores.launch = Math.min(1, launchReqs.length * 0.2);
    scores.risk = risks.length === 0 ? 0.8 : Math.max(0.2, 0.8 - risks.length * 0.1);

    const overall = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
    const level = overall >= 0.7 ? "READY" : overall >= 0.4 ? "CONDITIONAL" : "NOT_READY";

    const readiness = { overall: Math.round(overall * 100) / 100, level, scores };

    const updated = await db.commercialProduct.update({
      where: { id: product.id },
      data: { commercialReadiness: JSON.stringify(readiness) },
    });

    return NextResponse.json({
      productId: updated.productId,
      readiness,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error evaluando readiness";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
