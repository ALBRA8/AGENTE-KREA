import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/commercial/logo
 * Generate a professional logo for a brand/product.
 *
 * Body: { brandName, tagline?, industry?, style?, brandColors?, mood?, variants?, language? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brandName, tagline, industry, style, brandColors, mood, variants, language } = body;

    if (!brandName) {
      return NextResponse.json(
        { error: "Missing required field: brandName" },
        { status: 400 }
      );
    }

    const { generateLogo } = await import("@/lib/commercial/logo-generator");
    const result = await generateLogo({
      brandName,
      tagline,
      industry,
      style,
      brandColors,
      mood,
      variants,
      language: language ?? "es",
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error generating logo";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
