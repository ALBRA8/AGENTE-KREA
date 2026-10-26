import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/commercial/launch-pack
 * Generate a complete launch package: ads across platforms, landing sections,
 * and product mockups — all in a single coordinated call.
 *
 * Body: { productInfo, platforms, sections, mockupTypes, language? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productInfo, platforms, sections, mockupTypes, language } = body;

    // Validate required fields
    if (!productInfo) {
      return NextResponse.json(
        { error: "Missing required field: productInfo" },
        { status: 400 }
      );
    }
    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid required field: platforms (must be a non-empty array)" },
        { status: 400 }
      );
    }
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid required field: sections (must be a non-empty array)" },
        { status: 400 }
      );
    }
    if (!mockupTypes || !Array.isArray(mockupTypes) || mockupTypes.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid required field: mockupTypes (must be a non-empty array)" },
        { status: 400 }
      );
    }

    // Dynamic import to keep bundle lean
    const { CommercialCreativeEngine } = await import(
      "@/lib/commercial-creative-engine"
    );
    const engine = CommercialCreativeEngine.getInstance();

    const result = await engine.generateLaunchPackage({
      productInfo,
      platforms,
      sections,
      mockupTypes,
      language,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Error generating launch package";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
