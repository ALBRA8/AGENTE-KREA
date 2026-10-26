import { NextResponse } from "next/server";

/**
 * GET /api/commercial
 * List all available commercial creative capabilities,
 * including all AGENTE-KREA capabilities from both
 * the base engine and the extended commercial module.
 */
export async function GET() {
  try {
    // Dynamic import to keep bundle lean
    const { CommercialCreativeEngine } = await import(
      "@/lib/commercial-creative-engine"
    );
    const engine = CommercialCreativeEngine.getInstance();
    const baseCapabilities = engine.getCapabilities();

    // Extended capabilities from the commercial module
    const { KREA_AGENT_IDENTITY, getSupportedPlatforms, getTemplateGallery } = await import(
      "@/lib/commercial"
    );

    return NextResponse.json({
      success: true,
      data: {
        agent: KREA_AGENT_IDENTITY,
        // Base engine
        platforms: baseCapabilities.platforms,
        sectionTypes: baseCapabilities.sectionTypes,
        mockupTypes: baseCapabilities.mockupTypes,
        angles: baseCapabilities.angles,
        pricing: baseCapabilities.pricing,
        // Extended capabilities
        logoStyles: ["wordmark", "iconic", "abstract", "monogram", "emblem", "mascot"],
        logoVariants: ["primary", "icon-only", "horizontal", "stacked", "dark-bg", "light-bg"],
        bannerFormats: [
          "website-hero", "website-strip", "email-header", "social-cover",
          "youtube-banner", "promo-popup", "sidebar", "print-flyer",
        ],
        emailCreativeTypes: [
          "header", "promo-block", "product-showcase",
          "cta-button", "footer", "newsletter-hero",
        ],
        catalogFormats: [
          "digital-catalog", "single-page-flyer", "product-sheet", "lookbook", "price-list",
        ],
        ecommercePlatforms: getSupportedPlatforms(),
        templateCount: getTemplateGallery().length,
        allCapabilities: KREA_AGENT_IDENTITY.capabilities,
        excludedCapabilities: KREA_AGENT_IDENTITY.excludedCapabilities,
      },
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Error retrieving commercial capabilities";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
