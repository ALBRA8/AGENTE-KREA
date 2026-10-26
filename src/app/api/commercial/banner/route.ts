import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/commercial/banner
 * Generate a banner for web, email, social media, or print.
 *
 * Body: { productInfo, bannerFormat, headline?, subheadline?, cta?, styleReference?, brandColors?, language? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productInfo, bannerFormat, headline, subheadline, cta, styleReference, brandColors, language } = body;

    if (!productInfo) {
      return NextResponse.json({ error: "Missing required field: productInfo" }, { status: 400 });
    }
    if (!bannerFormat) {
      return NextResponse.json({ error: "Missing required field: bannerFormat" }, { status: 400 });
    }

    const { generateBanner } = await import("@/lib/commercial/banner-generator");
    const result = await generateBanner({
      productInfo,
      bannerFormat,
      headline,
      subheadline,
      cta,
      styleReference,
      brandColors,
      language: language ?? "es",
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error generating banner";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
