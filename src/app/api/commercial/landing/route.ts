import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";

/**
 * POST /api/commercial/landing
 * Generate a landing page section for a product.
 *
 * Body: { sectionType, productInfo, templateStyle?, language? }
 */
export async function POST(req: NextRequest) {
  // Gate de auth ANTES de leer/validar el body (auditoría FASE 3: sin token → 401)
  const sessionUser = await getSessionUser(req.headers.get("authorization")?.replace("Bearer ", "") || "");
  if (!sessionUser) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  let charge: ChargeResult | ChargeError | null = null;
  try {
    const body = await req.json();
    const { sectionType, productInfo, templateStyle, language } = body;

    // Validate required fields
    if (!sectionType) {
      return NextResponse.json(
        { error: "Missing required field: sectionType" },
        { status: 400 }
      );
    }
    if (!productInfo) {
      return NextResponse.json(
        { error: "Missing required field: productInfo" },
        { status: 400 }
      );
    }

    // Cobro atómico único (reembolso en caso de fallo)
    charge = await chargeForCapability(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
      "commercial:landing"
    );
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }

    // Dynamic import to keep bundle lean
    const { CommercialCreativeEngine } = await import(
      "@/lib/commercial-creative-engine"
    );
    const engine = CommercialCreativeEngine.getInstance();

    const result = await engine.generateLandingSection({
      sectionType,
      productInfo,
      templateStyle,
      language,
    });

    return NextResponse.json({ success: (result as { success?: boolean }).success ?? true, data: result, credits: charge.ok ? charge.creditsLeft : undefined });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "commercial:landing");
    const message =
      e instanceof Error ? e.message : "Error generating landing section";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
