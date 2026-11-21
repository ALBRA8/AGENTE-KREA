import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { designProductArchitecture } from "@/lib/product-architecture";
import type { FitScore } from "@/lib/product-fit";

// POST /api/product/architect — Design product architecture
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { opportunityId, productType, fitScore } = body;

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

    // Resolve fitScore: from body, or from opportunity, or fallback
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

    // Resolve productType: from body or from opportunity domain
    const type = productType || opportunity.domain;

    if (!type) {
      return NextResponse.json(
        { error: "Falta productType. Especifícalo o asegúrate de que la oportunidad tenga domain." },
        { status: 400 }
      );
    }

    // Design architecture
    const architecture = await designProductArchitecture(
      type,
      opportunity.title,
      opportunity.description,
      score
    );

    return NextResponse.json({ data: architecture });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al diseñar arquitectura";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
