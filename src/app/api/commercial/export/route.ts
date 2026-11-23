import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";

/**
 * POST /api/commercial/export
 * Exporta creativos a una plataforma ecommerce
 * (shopify / woocommerce / tiendanube / funnelish).
 *
 * Con credenciales reales (env vars por plataforma — ver CREDENTIAL_ENV_VARS en
 * ecom-export.ts) hace el envío HTTP real a la API documentada de la plataforma.
 * Sin credenciales prepara el payload y devuelve el endpoint destino con la
 * lista exacta de env vars faltantes (honesty.realHttpSend: NOT_VERIFIED_NO_CREDENTIALS).
 * Funnelish no tiene API pública REST de imágenes de producto — honesty:
 * NOT_SUPPORTED_NO_PUBLIC_API.
 *
 * Body: { platform, productData, creatives? }
 */
export async function POST(req: NextRequest) {
  // Gate de auth ANTES de leer/validar el body (auditoría FASE 3: sin token → 401)
  const sessionUser = await getSessionUser(req.headers.get("authorization")?.replace("Bearer ", "") || "");
  if (!sessionUser) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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
    // Map the loose API body to the EcomExportParams contract: the route
    // accepts { platform, productData, creatives } and derives productId,
    // assets and metadata (before this fix, missing assets crashed
    // validateExport with "undefined is not iterable" — smoke evidence P2).
    const creativeAssets = Array.isArray(creatives) ? creatives : [];
    const productDataObj = (productData ?? {}) as Record<string, unknown>;
    const result = await exportToEcom({
      platform,
      productId:
        (typeof productDataObj.id === "string" && productDataObj.id) ||
        (typeof productDataObj.productId === "string" && productDataObj.productId) ||
        `prepared-${Date.now()}`,
      assets: creativeAssets.map(
        (c: { url?: string; type?: string; alt?: string; format?: string; sizeBytes?: number }) => ({
          url: c?.url ?? "",
          type: c?.type ?? "image",
          alt: c?.alt,
          // Pasar format/sizeBytes al contrato para que la validación contra
          // los límites reales de la plataforma los vea (smoke export-ruta, P4)
          format: typeof c?.format === "string" ? c.format : undefined,
          sizeBytes: typeof c?.sizeBytes === "number" ? c.sizeBytes : undefined,
        })
      ),
      metadata: {
        name: typeof productDataObj.name === "string" ? productDataObj.name : "",
        description:
          typeof productDataObj.description === "string" ? productDataObj.description : "",
        price:
          productDataObj.price !== undefined && productDataObj.price !== null
            ? String(productDataObj.price)
            : "",
      },
    } as Parameters<typeof exportToEcom>[0]);
    const platformInfo = getPlatformInfo(platform);

    // Honestidad espejada del resultado real de la librería
    const send = (result as { send?: { attempted?: boolean; ok?: boolean }; credentials?: { present?: boolean; missingEnvVars?: string[] } }).send;
    const credentials = (result as { credentials?: { present?: boolean; missingEnvVars?: string[] } }).credentials;
    let realHttpSend = "NOT_VERIFIED_NO_CREDENTIALS";
    let reason = "Sin credenciales de la plataforma — se prepara el payload y el endpoint destino";
    if (send?.attempted) {
      realHttpSend = send.ok ? "SENT_OK" : "SENT_FAILED";
      reason = send.ok
        ? "Envío HTTP real ejecutado a la API de la plataforma"
        : "Envío HTTP real intentado y rechazado por la plataforma (ver data.send)";
    } else if (platform === "funnelish") {
      realHttpSend = "NOT_SUPPORTED_NO_PUBLIC_API";
      reason = "Funnelish no tiene API pública REST de imágenes de producto (solo webhooks) — payload preparado";
    } else if (credentials?.missingEnvVars?.length) {
      reason = `Faltan env vars de credenciales: ${credentials.missingEnvVars.join(", ")}`;
    }

    return NextResponse.json({
      success: (result as { success?: boolean }).success ?? true,
      data: result,
      platformInfo,
      honesty: {
        realHttpSend,
        reason,
      },
      credits: charge.ok ? charge.creditsLeft : undefined,
    });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "commercial:export");
    const message = e instanceof Error ? e.message : "Error exporting to ecommerce platform";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
