import { NextRequest, NextResponse } from "next/server";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";

/**
 * POST /api/commercial/mockup
 * Generate a product mockup image.
 *
 * Body: { productImage, mockupType, style? }
 */
export async function POST(req: NextRequest) {
  let charge: ChargeResult | ChargeError | null = null;
  try {
    const body = await req.json();
    const { productImage, mockupType, style } = body;

    // Validate required fields
    if (!productImage) {
      return NextResponse.json(
        { error: "Missing required field: productImage" },
        { status: 400 }
      );
    }
    if (!mockupType) {
      return NextResponse.json(
        { error: "Missing required field: mockupType" },
        { status: 400 }
      );
    }

    // Cobro atómico único (reembolso en caso de fallo)
    charge = await chargeForCapability(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
      "commercial:mockup"
    );
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }

    // Dynamic import to keep bundle lean
    const { CommercialCreativeEngine } = await import(
      "@/lib/commercial-creative-engine"
    );
    const engine = CommercialCreativeEngine.getInstance();

    const result = await engine.generateMockup({
      productImage,
      mockupType,
      style,
    });

    return NextResponse.json({ success: (result as { success?: boolean }).success ?? true, data: result, credits: charge.ok ? charge.creditsLeft : undefined });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "commercial:mockup");
    const message =
      e instanceof Error ? e.message : "Error generating mockup";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
