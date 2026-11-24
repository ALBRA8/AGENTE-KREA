import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";
import { createProductSpecification } from "@/lib/product-specification";
import type { ProductArchitecture } from "@/lib/product-architecture";

// POST /api/product/specify — Create product specification (1 llamada LLM;
// cobra y reembolsa si el proveedor no contribuyó, evidence NOT_VERIFIED)
export async function POST(req: NextRequest) {
  let charge: ChargeResult | ChargeError | null = null;
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { architecture, dossierId } = body;

    if (!architecture) {
      return NextResponse.json(
        { error: "Falta campo requerido: architecture" },
        { status: 400 }
      );
    }

    // Create specification — el cobro va justo antes de la llamada al proveedor
    charge = await chargeForCapability(token ?? "", "product:specify");
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }

    const specification = await createProductSpecification(
      architecture as ProductArchitecture
    );

    // Degradación honesta: fallback NOT_VERIFIED = proveedor no contribuyó → reembolso
    if (specification.evidence === "NOT_VERIFIED") {
      await refundCharge(charge.userId, "product:specify");
    }

    // Hallazgo 4.2: la etapa PERSISTE el campo en el dossier y avanza el
    // estado con transición legal (SPECIFYING → SPECIFYING).
    {
      const dossier = await db.productDossier.findFirst({ where: { id: dossierId, userId: user.id } });
      if (dossier) {
        await db.productDossier.update({
          where: { id: dossier.id },
          data: {
            specification: JSON.stringify(specification),
            status: 'SPECIFYING',
            timeline: JSON.stringify([
              ...(dossier.timeline ? (JSON.parse(dossier.timeline) as unknown[]) : []),
              { step: 'SPECIFICATION_SAVED', timestamp: new Date().toISOString() },
            ]),
          },
        });
      }
    }

    return NextResponse.json({
      data: specification,
      credits: charge.ok ? charge.creditsLeft : undefined,
      refunded: specification.evidence === "NOT_VERIFIED" || undefined,
    });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "product:specify");
    const msg = e instanceof Error ? e.message : "Error al crear especificación";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
