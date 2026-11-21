import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { makeProductDecision } from "@/lib/product-decision";
import type { FitScore } from "@/lib/product-fit";

// POST /api/product/decide — Make product decision
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { opportunityId, fitScore } = body;

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

    // Use provided fitScore or load from opportunity
    let score: FitScore;
    if (fitScore) {
      score = fitScore;
    } else if (opportunity.fitScore) {
      score = JSON.parse(opportunity.fitScore);
    } else {
      return NextResponse.json(
        { error: "No hay fitScore disponible. Evalúa el fit primero." },
        { status: 400 }
      );
    }

    // Make decision
    const decision = makeProductDecision(score);

    // Save decision to opportunity
    await db.productOpportunity.update({
      where: { id: opportunityId },
      data: {
        decision: JSON.stringify(decision),
        status: decision.decision === "GO" ? "ACCEPTED" : decision.decision === "CONDITIONAL_GO" ? "EVALUATING" : "REJECTED",
      },
    });

    return NextResponse.json({ data: decision });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al tomar decisión";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
