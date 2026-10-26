import { NextResponse } from "next/server";

/**
 * GET /api/commercial
 * List all available commercial creative capabilities,
 * including supported platforms, section types, mockup types,
 * creative angles, and pricing information.
 */
export async function GET() {
  try {
    // Dynamic import to keep bundle lean
    const { CommercialCreativeEngine } = await import(
      "@/lib/commercial-creative-engine"
    );
    const engine = CommercialCreativeEngine.getInstance();

    const capabilities = engine.getCapabilities();

    return NextResponse.json({
      success: true,
      data: {
        platforms: capabilities.platforms,
        sectionTypes: capabilities.sectionTypes,
        mockupTypes: capabilities.mockupTypes,
        angles: capabilities.angles,
        pricing: capabilities.pricing,
      },
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Error retrieving commercial capabilities";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
