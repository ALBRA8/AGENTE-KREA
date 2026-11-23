import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";

/** Valid email creative types (must match EmailCreativeType in lib/commercial/types.ts) */
const VALID_CREATIVE_TYPES = [
  "header", "promo-block", "product-showcase", "cta-button", "footer", "newsletter-hero",
] as const;

/**
 * POST /api/commercial/email
 * Generate an email marketing creative.
 *
 * Body: { productInfo, creativeType, headline?, bodyCopy?, cta?, brandColors?, language? }
 */
export async function POST(req: NextRequest) {
  // Gate de auth ANTES de leer/validar el body (auditoría FASE 3: sin token → 401)
  const sessionUser = await getSessionUser(req.headers.get("authorization")?.replace("Bearer ", "") || "");
  if (!sessionUser) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  let charge: ChargeResult | ChargeError | null = null;
  try {
    const body = await req.json();
    const { productInfo, creativeType, headline, bodyCopy, cta, brandColors, language } = body;

    if (!productInfo) {
      return NextResponse.json({ error: "Missing required field: productInfo" }, { status: 400 });
    }
    if (!creativeType) {
      return NextResponse.json({ error: "Missing required field: creativeType" }, { status: 400 });
    }
    if (!VALID_CREATIVE_TYPES.includes(creativeType)) {
      return NextResponse.json(
        { error: `Invalid creativeType: "${creativeType}". Valid values: ${VALID_CREATIVE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Cobro atómico único (reembolso en caso de fallo)
    charge = await chargeForCapability(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
      "commercial:email"
    );
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }

    const { generateEmailCreative } = await import("@/lib/commercial/email-creative");
    const result = await generateEmailCreative({
      productInfo,
      creativeType,
      headline,
      bodyCopy,
      cta,
      brandColors,
      language: language ?? "es",
    });

    return NextResponse.json({ success: true, data: result, credits: charge.ok ? charge.creditsLeft : undefined });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "commercial:email");
    const message = e instanceof Error ? e.message : "Error generating email creative";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
