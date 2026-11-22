import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/product/commercial
 * Create a commercial product definition from a dossier.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      productId, productName, productType, targetCustomer, problem,
      jobToBeDone, desiredOutcome, valueProposition, differentiation,
      format, includedAssets, excludedScope, priceStrategy, priceRange,
      monetizationModel, distributionStrategy, positioning, keyBenefits,
      objections, proofRequirements, commercialReadiness,
      launchRequirements, assumptions, risks,
    } = body;

    if (!productId || !productName || !productType) {
      return NextResponse.json(
        { error: "productId, productName y productType son obligatorios" },
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

    const commercial = await db.commercialProduct.create({
      data: {
        userId: user.id,
        productId,
        productName,
        productType,
        targetCustomer: targetCustomer || "{}",
        problem: problem || "",
        jobToBeDone: jobToBeDone || "",
        desiredOutcome: desiredOutcome || "",
        valueProposition: valueProposition || "",
        differentiation: differentiation || "",
        format: format || "",
        includedAssets: includedAssets || "[]",
        excludedScope: excludedScope || "[]",
        priceStrategy: priceStrategy || "{}",
        priceRange: priceRange || "{}",
        monetizationModel: monetizationModel || "",
        distributionStrategy: distributionStrategy || "",
        positioning: positioning || "",
        keyBenefits: keyBenefits || "[]",
        objections: objections || "[]",
        proofRequirements: proofRequirements || "[]",
        commercialReadiness: commercialReadiness || null,
        launchRequirements: launchRequirements || "[]",
        assumptions: assumptions || "[]",
        risks: risks || "[]",
      },
    });

    return NextResponse.json(commercial, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error creando producto comercial";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
