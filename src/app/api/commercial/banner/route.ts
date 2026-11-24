import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";

/**
 * POST /api/commercial/banner
 * Generate a banner for web, email, social media, or print.
 *
 * Body: { productInfo, bannerFormat, headline?, subheadline?, cta?, styleReference?, brandColors?, language? }
 */
export async function POST(req: NextRequest) {
  // Gate de auth ANTES de leer/validar el body (auditoría FASE 3: sin token → 401)
  const sessionUser = await getSessionUser(req.headers.get("authorization")?.replace("Bearer ", "") || "");
  if (!sessionUser) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  let charge: ChargeResult | ChargeError | null = null;
  try {
    const body = await req.json();
    const { productInfo, bannerFormat, headline, subheadline, cta, styleReference, brandColors, language } = body;

    if (!productInfo) {
      return NextResponse.json({ error: "Missing required field: productInfo" }, { status: 400 });
    }
    if (!bannerFormat) {
      return NextResponse.json({ error: "Missing required field: bannerFormat" }, { status: 400 });
    }

    // Cobro atómico único (reembolso en caso de fallo)
    charge = await chargeForCapability(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
      "commercial:banner"
    );
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }

    const { generateBanner } = await import("@/lib/commercial/banner-generator");
    const result = await generateBanner({
      productInfo,
      bannerFormat,
      headline,
      subheadline,
      cta,
      styleReference,
      brandColors,
      language: language ?? "es",
    });

    // Hallazgo 2.1: el generador convierte el fallo en resultado sin activos —
    // si no hay entregable NO se cobra: reembolso + 502 (R2/R4).
    if (!result.success) {
      if (charge?.ok) await refundCharge(charge.userId, "commercial:banner");
      return NextResponse.json(
        { success: false, error: "La generación no produjo ningún activo — créditos reembolsados", refunded: true, data: result },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data: result, credits: charge.ok ? charge.creditsLeft : undefined });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "commercial:banner");
    const message = e instanceof Error ? e.message : "Error generating banner";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
