import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/commercial/ad
 * Generate a commercial ad creative for a given platform and format.
 *
 * Body: { platform, format, productInfo, styleReference?, copy? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, format, productInfo, styleReference, copy } = body;

    // Validate required fields
    if (!platform) {
      return NextResponse.json(
        { error: "Missing required field: platform" },
        { status: 400 }
      );
    }
    if (!format) {
      return NextResponse.json(
        { error: "Missing required field: format" },
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

    const result = await engine.generateAd({
      platform,
      format,
      productInfo,
      styleReference,
      copy,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error generating ad";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
