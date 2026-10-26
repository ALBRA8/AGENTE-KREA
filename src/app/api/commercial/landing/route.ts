import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/commercial/landing
 * Generate a landing page section for a product.
 *
 * Body: { sectionType, productInfo, templateStyle?, language? }
 */
export async function POST(req: NextRequest) {
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

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Error generating landing section";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
