import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { evaluateProductFit } from "@/lib/product-fit";
import type { ProductOpportunityInput } from "@/lib/product-fit";

// POST /api/product/fit — Evaluate product fit
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

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

    // Evaluate fit
    const fitScore = await evaluateProductFit(input);

    // Save fitScore to opportunity
    await db.productOpportunity.update({
      where: { id: opportunityId },
      data: {
        fitScore: JSON.stringify(fitScore),
        status: fitScore.recommendation === "PROCEED" ? "ACCEPTED" : "EVALUATING",
      },
    });

    return NextResponse.json({ data: fitScore });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al evaluar fit";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
