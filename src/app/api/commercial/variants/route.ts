import { NextRequest, NextResponse } from "next/server";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";

/**
 * POST /api/commercial/variants
 * Generate a pack of creative variants from a base ad, varying by angle.
 *
 * Body: { baseAd, angles, count? }
 */
export async function POST(req: NextRequest) {
  let charge: ChargeResult | ChargeError | null = null;
  try {
    const body = await req.json();
    const { baseAd, angles, count } = body;

    // Validate required fields
    if (!baseAd) {
      return NextResponse.json(
        { error: "Missing required field: baseAd" },
        { status: 400 }
      );
    }
    if (!angles || !Array.isArray(angles) || angles.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid required field: angles (must be a non-empty array)" },
        { status: 400 }
      );
    }

    // Cobro atómico único (reembolso en caso de fallo)
    charge = await chargeForCapability(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
      "commercial:variants"
    );
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }

    // Dynamic import to keep bundle lean
    const { CommercialCreativeEngine } = await import(
      "@/lib/commercial-creative-engine"
    );
    const engine = CommercialCreativeEngine.getInstance();

    const result = await engine.generateVariantPack({
      baseAd,
      angles,
      count,
    });

    return NextResponse.json({ success: true, data: result, credits: charge.ok ? charge.creditsLeft : undefined });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "commercial:variants");
    const message =
      e instanceof Error ? e.message : "Error generating variants";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
