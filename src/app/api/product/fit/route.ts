import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";
import { evaluateProductFit } from "@/lib/product-fit";
import type { ProductOpportunityInput } from "@/lib/product-fit";

// POST /api/product/fit — Evaluate product fit (1 llamada LLM; cobra y
// reembolsa si el proveedor no contribuyó, evidence NOT_VERIFIED)
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let charge: ChargeResult | ChargeError | null = null;
  try {
    const body = await req.json();
    const { opportunityId } = body;

    if (!opportunityId) {
      return NextResponse.json(
        { error: "Falta campo requerido: opportunityId" },
        { status: 400 }
      );
    }

    // Load opportunity with ownership check
    const opportunity = await db.productOpportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Oportunidad no encontrada" }, { status: 404 });
    }

    if (opportunity.userId !== user.id) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    // Build input for evaluateProductFit
    const input: ProductOpportunityInput = {
      title: opportunity.title,
      description: opportunity.description,
      targetAudience: opportunity.audience,
      domain: opportunity.domain,
      problemStatement: opportunity.problem,
      existingAlternatives: opportunity.alternatives
        ? JSON.parse(opportunity.alternatives)
        : undefined,
    };

    // Evaluar fit — el cobro va justo antes de la llamada al proveedor
    charge = await chargeForCapability(token ?? "", "product:fit");
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }

    const fitScore = await evaluateProductFit(input);

    // Degradación honesta: fallback NOT_VERIFIED = el proveedor no respondió
    // (o el parse falló) → reembolso. Resultado INFERRED = LLM real → se mantiene.
    if (fitScore.evidence === "NOT_VERIFIED") {
      await refundCharge(charge.userId, "product:fit");
    }

    // Save fitScore to opportunity
    await db.productOpportunity.update({
      where: { id: opportunityId },
      data: {
        fitScore: JSON.stringify(fitScore),
        status: fitScore.recommendation === "PROCEED" ? "ACCEPTED" : "EVALUATING",
      },
    });

    return NextResponse.json({
      data: fitScore,
      credits: charge.ok ? charge.creditsLeft : undefined,
      refunded: fitScore.evidence === "NOT_VERIFIED" || undefined,
    });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "product:fit");
    const msg = e instanceof Error ? e.message : "Error al evaluar fit";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
