import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/commercial/mockup
 * Generate a product mockup image.
 *
 * Body: { productImage, mockupType, style? }
 */
export async function POST(req: NextRequest) {
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

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Error generating mockup";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
