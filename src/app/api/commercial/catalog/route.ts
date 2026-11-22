import { NextRequest, NextResponse } from "next/server";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";

/** Valid catalog formats (must match CatalogFormat in lib/commercial/types.ts) */
const VALID_CATALOG_FORMATS = [
  "digital-catalog", "single-page-flyer", "product-sheet", "lookbook", "price-list",
] as const;

/**
 * POST /api/commercial/catalog
 * Generate a product catalog, flyer, or lookbook.
 *
 * Body: { products, catalogFormat, title?, styleReference?, brandColors?, columns?, language? }
 */
export async function POST(req: NextRequest) {
  let charge: ChargeResult | ChargeError | null = null;
  try {
    const body = await req.json();
    const { products, catalogFormat, title, styleReference, brandColors, columns, language } = body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: "Missing or invalid: products (must be a non-empty array)" }, { status: 400 });
    }
    if (!catalogFormat) {
      return NextResponse.json({ error: "Missing required field: catalogFormat" }, { status: 400 });
    }
    if (!VALID_CATALOG_FORMATS.includes(catalogFormat)) {
      return NextResponse.json(
        { error: `Invalid catalogFormat: "${catalogFormat}". Valid values: ${VALID_CATALOG_FORMATS.join(", ")}` },
        { status: 400 }
      );
    }

    // Cobro atómico único (reembolso en caso de fallo)
    charge = await chargeForCapability(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
      "commercial:catalog"
    );
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }

    const { generateCatalog } = await import("@/lib/commercial/catalog-generator");
    const result = await generateCatalog({
      products,
      catalogFormat,
      title,
      styleReference,
      brandColors,
      columns,
      language: language ?? "es",
    });

    return NextResponse.json({ success: true, data: result, credits: charge.ok ? charge.creditsLeft : undefined });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "commercial:catalog");
    const message = e instanceof Error ? e.message : "Error generating catalog";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
