import { NextRequest, NextResponse } from "next/server";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";

/**
 * POST /api/commercial/export
 * Prepara el payload de exportación para una plataforma ecommerce
 * (shopify / woocommerce / tiendanube / funnelish).
 *
 * NOTA HONESTA: la implementación prepara el payload y devuelve el endpoint
 * destino; NO realiza la llamada HTTP real (requiere credenciales OAuth de la
 * plataforma). Estado de la capacidad: PARTIAL / NOT_VERIFIED para envío real.
 *
 * Body: { platform, productData, creatives? }
 */
export async function POST(req: NextRequest) {
  let charge: ChargeResult | ChargeError | null = null;
  try {
    const body = await req.json();
    const { platform, productData, creatives } = body;

    if (!platform) {
      return NextResponse.json({ error: "Missing required field: platform" }, { status: 400 });
    }
    if (!productData) {
      return NextResponse.json({ error: "Missing required field: productData" }, { status: 400 });
    }

    // Cobro atómico único (reembolso en caso de fallo)
    charge = await chargeForCapability(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
      "commercial:export"
    );
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }

    const { exportToEcom, getPlatformInfo } = await import("@/lib/commercial/ecom-export");
    const result = await exportToEcom({
      platform,
      productData,
      creatives,
    } as any);
    const platformInfo = getPlatformInfo(platform);

    return NextResponse.json({
      success: true,
      data: result,
      platformInfo,
      honesty: {
        realHttpSend: "NOT_VERIFIED",
        reason: "Requiere credenciales OAuth de la plataforma — se prepara el payload y el endpoint destino",
      },
      credits: charge.ok ? charge.creditsLeft : undefined,
    });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "commercial:export");
    const message = e instanceof Error ? e.message : "Error exporting to ecommerce platform";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
