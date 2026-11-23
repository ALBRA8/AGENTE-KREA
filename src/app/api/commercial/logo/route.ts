import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";

/**
 * POST /api/commercial/logo
 * Generate a professional logo for a brand/product.
 *
 * Body: { brandName, tagline?, industry?, style?, brandColors?, mood?, variants?, language? }
 */
export async function POST(req: NextRequest) {
  // Gate de auth ANTES de leer/validar el body (auditoría FASE 3: sin token → 401)
  const sessionUser = await getSessionUser(req.headers.get("authorization")?.replace("Bearer ", "") || "");
  if (!sessionUser) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  let charge: ChargeResult | ChargeError | null = null;
  try {
    const body = await req.json();
    const { brandName, tagline, industry, style, brandColors, mood, variants, language } = body;

    if (!brandName) {
      return NextResponse.json(
        { error: "Missing required field: brandName" },
        { status: 400 }
      );
    }

    // Cobro atómico único (reembolso en caso de fallo)
    charge = await chargeForCapability(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
      "commercial:logo"
    );
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }

    const { generateLogo } = await import("@/lib/commercial/logo-generator");
    const result = await generateLogo({
      brandName,
      tagline,
      industry,
      style,
      brandColors,
      mood,
      variants,
      language: language ?? "es",
    });

    return NextResponse.json({ success: true, data: result, credits: charge.ok ? charge.creditsLeft : undefined });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "commercial:logo");
    const message = e instanceof Error ? e.message : "Error generating logo";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
