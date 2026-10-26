import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/commercial/email
 * Generate an email marketing creative.
 *
 * Body: { productInfo, creativeType, headline?, bodyCopy?, cta?, brandColors?, language? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productInfo, creativeType, headline, bodyCopy, cta, brandColors, language } = body;

    if (!productInfo) {
      return NextResponse.json({ error: "Missing required field: productInfo" }, { status: 400 });
    }
    if (!creativeType) {
      return NextResponse.json({ error: "Missing required field: creativeType" }, { status: 400 });
    }

    const { generateEmailCreative } = await import("@/lib/commercial/email-creative");
    const result = await generateEmailCreative({
      productInfo,
      creativeType,
      headline,
      bodyCopy,
      cta,
      brandColors,
      language: language ?? "es",
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error generating email creative";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
