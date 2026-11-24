import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";
import { designProductArchitecture } from "@/lib/product-architecture";
import type { FitScore } from "@/lib/product-fit";

// POST /api/product/architect — Design product architecture (1 llamada LLM;
// cobra y reembolsa si el proveedor no contribuyó, evidence NOT_VERIFIED)
export async function POST(req: NextRequest) {
  let charge: ChargeResult | ChargeError | null = null;
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { opportunityId, productType, fitScore, dossierId } = body;

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

    // Design architecture — el cobro va justo antes de la llamada al proveedor
    charge = await chargeForCapability(token ?? "", "product:architect");
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }

    const architecture = await designProductArchitecture(
      type,
      opportunity.title,
      opportunity.description,
      score
    );

    // Degradación honesta: fallback NOT_VERIFIED = proveedor no contribuyó → reembolso
    if (architecture.evidence === "NOT_VERIFIED") {
      await refundCharge(charge.userId, "product:architect");
    }

    // Hallazgo 4.2: la etapa PERSISTE el campo en el dossier y avanza el
    // estado con transición legal (ARCHITECTING → SPECIFYING).
    {
      const dossier = await db.productDossier.findFirst({ where: { id: dossierId, userId: user.id } });
      if (dossier) {
        await db.productDossier.update({
          where: { id: dossier.id },
          data: {
            architecture: JSON.stringify(architecture),
            status: 'ARCHITECTING',
            timeline: JSON.stringify([
              ...(dossier.timeline ? (JSON.parse(dossier.timeline) as unknown[]) : []),
              { step: 'ARCHITECTURE_SAVED', timestamp: new Date().toISOString() },
            ]),
          },
        });
      }
    }

    return NextResponse.json({
      data: architecture,
      credits: charge.ok ? charge.creditsLeft : undefined,
      refunded: architecture.evidence === "NOT_VERIFIED" || undefined,
    });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "product:architect");
    const msg = e instanceof Error ? e.message : "Error al diseñar arquitectura";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
