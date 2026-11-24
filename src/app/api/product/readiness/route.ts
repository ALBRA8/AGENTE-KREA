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

    const dossier = await db.productDossier.findFirst({
      where: { id: productId, userId: user.id },
    });
    if (!dossier) {
      return NextResponse.json({ error: "Dossier no encontrado" }, { status: 404 });
    }

    // Hallazgo 3.3: la ruta usa la LIBRERÍA (una sola implementación):
    // evaluateReadiness con el QA real de la ejecución y los artefactos.
    // Fail-closed: sin QA ejecutado, el QAReport sintético NO pasa.
    const latestExec = await db.factoryExecution.findFirst({
      where: { productId, userId: user.id },
      orderBy: { startedAt: "desc" },
    });

    const artifactRefs: Array<{ type: string; path?: string; name?: string }> = latestExec?.artifacts
      ? (JSON.parse(latestExec.artifacts) as Array<{ type: string; path?: string; name?: string }>)
      : [];
    const hasPdf = artifactRefs.some((a) => a.type === "pdf");

    const { evaluateReadiness } = await import("@/lib/commercial-readiness");

    // QA real si existe en la ejecución; si no, reporte fail-closed.
    let qaReport;
    if (latestExec?.qaReport) {
      qaReport = JSON.parse(latestExec.qaReport);
    } else {
      qaReport = {
        reportId: `no-qa-${productId}`,
        productId,
        version: product.productVersion || "1.0.0",
        overallPassed: false,
        artifactQA: { category: "artifact", passed: false, score: 0, checks: [], issues: [] },
        contentQA: { category: "content", passed: false, score: 0, checks: [], issues: [] },
        structureQA: { category: "structure", passed: false, score: 0, checks: [], issues: [] },
        visualQA: { category: "visual", passed: false, score: 0, checks: [], issues: [] },
        commercialQA: { category: "commercial", passed: false, score: 0, checks: [], issues: [] },
        deliveryQA: { category: "delivery", passed: false, score: 0, checks: [], issues: [] },
        overallScore: 0,
        criticalIssues: [{ id: "no-qa", severity: "CRITICAL", category: "qa", description: "QA no ejecutado para este producto", repairable: true, repairAction: "run_qa" }],
        warnings: [],
        evidence: "NOT_VERIFIED",
        inspectedAt: new Date(),
      };
    }

    // Shape CommercialProduct (product-qa) desde la BD — flags honestos.
    const commercial = {
      hasPricing: product.priceStrategy !== "{}" && Boolean(product.priceStrategy),
      hasTargetCustomer: product.targetCustomer !== "{}" && Boolean(product.targetCustomer),
      hasValueProposition: Boolean(product.valueProposition),
      hasProblemStatement: Boolean(product.problem),
      hasDifferentiation: Boolean(product.differentiation),
      testimonials: JSON.parse(product.proofRequirements || "[]").filter((p: { kind?: string }) => p?.kind === "testimonial"),
      claims: JSON.parse(product.keyBenefits || "[]"),
    };
    const assetsInfo = {
      artifactCount: artifactRefs.length,
      hasBlueprint: Boolean(dossier.architecture),
      hasSpecification: Boolean(dossier.specification),
      hasEconomics: Boolean(dossier.economics),
      hasArchitecture: Boolean(dossier.architecture),
    };
    const readiness = evaluateReadiness(
      productId,
      product.productVersion || "1.0.0",
      qaReport,
      commercial,
      undefined,
      assetsInfo
    );

    // Persistir el readiness REAL del modelo en commercialProduct
    await db.commercialProduct.update({
      where: { id: product.id },
      data: { commercialReadiness: JSON.stringify(readiness) },
    });

    return NextResponse.json({
      productId,
      readiness,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error evaluando readiness";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
