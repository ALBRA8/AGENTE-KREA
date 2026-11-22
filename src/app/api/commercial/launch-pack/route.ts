import { NextRequest, NextResponse } from "next/server";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";

/**
 * POST /api/commercial/launch-pack
 * Generate a complete launch package via the CANONICAL batch pipeline
 * (fusión aprobada en FASE A: launch-pack es un preset de executeBatch).
 *
 * Genera: ads (plataformas × formatos), landing sections, mockups, logo y banner.
 *
 * Body: { productInfo, platforms, sections, mockupTypes, adFormats?, concurrency? }
 */
export async function POST(req: NextRequest) {
  let charge: ChargeResult | ChargeError | null = null;
  try {
    const body = await req.json();
    const { productInfo, platforms, sections, mockupTypes, adFormats, concurrency } = body;

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

    // Cobro atómico único (reembolso en caso de fallo)
    charge = await chargeForCapability(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
      "commercial:batch"
    );
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }

    // Vía canónica única: buildLaunchBatch + executeBatch
    const { buildLaunchBatch, executeBatch } = await import(
      "@/lib/commercial/batch-pipeline"
    );
    const items = buildLaunchBatch({
      productInfo,
      platforms,
      sections,
      mockupTypes,
      adFormats: Array.isArray(adFormats) && adFormats.length > 0
        ? adFormats
        : ["feed", "story", "carousel"],
    });
    const result = await executeBatch(items, concurrency ?? 3);

    return NextResponse.json({ success: (result as { success?: boolean }).success ?? true, data: result, credits: charge.ok ? charge.creditsLeft : undefined });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "commercial:batch");
    const message =
      e instanceof Error ? e.message : "Error generating launch package";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
