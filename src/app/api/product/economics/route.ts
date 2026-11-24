import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";
import { analyzeProductEconomics } from "@/lib/product-economics";
import type { ProductArchitecture } from "@/lib/product-architecture";

// POST /api/product/economics — Analyze economics (1 llamada LLM; cobra y
// reembolsa si el motor cae al heurístico sin LLM, evidence ESTIMATED-heurístico)
export async function POST(req: NextRequest) {
  let charge: ChargeResult | ChargeError | null = null;
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { productId, architecture, dossierId } = body;

    if (!productId || !architecture) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: productId, architecture" },
        { status: 400 }
      );
    }

    // Analyze economics — el cobro va justo antes de la llamada al proveedor
    charge = await chargeForCapability(token ?? "", "product:economics");
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }

    const economics = await analyzeProductEconomics(
      productId,
      architecture as ProductArchitecture
    );

    // Degradación honesta: el camino LLM marca evidence INFERRED; el heurístico
    // (proveedor caído o parse fallido) marca ESTIMATED → reembolso
    if (economics.evidence !== "INFERRED") {
      await refundCharge(charge.userId, "product:economics");
    }

    // Hallazgo 4.2: la etapa PERSISTE el campo en el dossier y avanza el
    // estado con transición legal (ECONOMICS → READY_FOR_PRODUCING).
    {
      const dossier = await db.productDossier.findFirst({ where: { id: dossierId, userId: user.id } });
      if (dossier) {
        await db.productDossier.update({
          where: { id: dossier.id },
          data: {
            economics: JSON.stringify(economics),
            status: 'ECONOMICS',
            timeline: JSON.stringify([
              ...(dossier.timeline ? (JSON.parse(dossier.timeline) as unknown[]) : []),
              { step: 'ECONOMICS_SAVED', timestamp: new Date().toISOString() },
            ]),
          },
        });
      }
    }

    return NextResponse.json({
      data: economics,
      credits: charge.ok ? charge.creditsLeft : undefined,
      refunded: economics.evidence !== "INFERRED" || undefined,
    });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "product:economics");
    const msg = e instanceof Error ? e.message : "Error al analizar economía";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
