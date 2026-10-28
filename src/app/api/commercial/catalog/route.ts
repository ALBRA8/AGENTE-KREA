import { NextRequest, NextResponse } from "next/server";

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

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error generating catalog";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
