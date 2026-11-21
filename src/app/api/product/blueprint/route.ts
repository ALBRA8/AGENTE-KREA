import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";

/**
 * POST /api/product/blueprint
 * Create a product blueprint.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      productId, type, customer, problem, jobToBeDone, desiredOutcome,
      valueProposition, format, structure, contentRequirements,
      designRequirements, assetRequirements, commercialRequirements,
      qualityRequirements, deliveryRequirements, successCriteria,
      assumptions, risks,
    } = body;

    if (!productId || !type) {
      return NextResponse.json(
        { error: "productId y type son obligatorios" },
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

    const blueprint = await db.productBlueprint.create({
      data: {
        userId: user.id,
        blueprintId: createId(),
        productId,
        type,
        customer: customer || "{}",
        problem: problem || "",
        jobToBeDone: jobToBeDone || "",
        desiredOutcome: desiredOutcome || "",
        valueProposition: valueProposition || "",
        format: format || "",
        structure: structure || "{}",
        contentRequirements: contentRequirements || "[]",
        designRequirements: designRequirements || "[]",
        assetRequirements: assetRequirements || "[]",
        commercialRequirements: commercialRequirements || "[]",
        qualityRequirements: qualityRequirements || "[]",
        deliveryRequirements: deliveryRequirements || "[]",
        successCriteria: successCriteria || "[]",
        assumptions: assumptions || "[]",
        risks: risks || "[]",
      },
    });

    return NextResponse.json(blueprint, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error creando blueprint";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
