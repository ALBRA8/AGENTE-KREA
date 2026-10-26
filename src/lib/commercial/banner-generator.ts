/**
 * KREA Commercial — Banner Generator
 *
 * Genera banners para web, email, redes sociales y print.
 *
 * Inspirado por ecom-magic.ai: Banner Generator (1 crédito cada uno).
 */

import { zaiSdkBridge } from "../bridges/zai-sdk-bridge";
import type { BannerParams, BannerResult, BannerFormat } from "./types";
import { LANG_STRINGS } from "../commercial-creative-engine";

// ─── Banner Dimension Map ──────────────────────────────────────────

const BANNER_DIMENSIONS: Record<BannerFormat, string> = {
  "website-hero": "1920x600",
  "website-strip": "1920x200",
  "email-header": "600x200",
  "social-cover": "1640x856",
  "youtube-banner": "2560x1440",
  "promo-popup": "800x600",
  sidebar: "300x250",
  "print-flyer": "2480x3508",
};

const BANNER_LAYOUT_HINTS: Record<BannerFormat, string> = {
  "website-hero":
    "Full-width hero banner, large product image, bold headline overlay, gradient background, CTA button, premium feel.",
  "website-strip":
    "Announcement strip, compact, single-line headline with CTA, colored background, attention-grabbing.",
  "email-header":
    "Email header banner, brand logo area, headline, clean and professional, works in email clients.",
  "social-cover":
    "Social media cover photo, brand visual identity, balanced composition, works at cover photo dimensions.",
  "youtube-banner":
    "YouTube channel banner, brand identity, safe area for text, works across desktop and mobile.",
  "promo-popup":
    "Promotional popup, centered layout, discount/offer text, close button area, eye-catching design.",
  sidebar:
    "Sidebar ad, compact, product image and headline, CTA button, readable at small size.",
  "print-flyer":
    "A4 print flyer, multiple products or single product showcase, QR code space, print-optimized, 300 DPI quality.",
};

// ─── Banner Generation ─────────────────────────────────────────────

export async function generateBanner(params: BannerParams): Promise<BannerResult> {
  const {
    productInfo,
    bannerFormat,
    headline,
    subheadline,
    cta,
    styleReference,
    brandColors,
    language = "es",
  } = params;

  const ls = LANG_STRINGS[language];
  const dimensions = BANNER_DIMENSIONS[bannerFormat];

  const promptParts: string[] = [];

  promptParts.push(`Create a professional ${bannerFormat} banner (${dimensions}).`);
  promptParts.push(BANNER_LAYOUT_HINTS[bannerFormat]);
  promptParts.push(`Product: "${productInfo.name}" — ${productInfo.description}.`);

  if (productInfo.price) promptParts.push(`Price: ${productInfo.price}.`);
  if (productInfo.benefits?.length) {
    promptParts.push(`Key benefits: ${productInfo.benefits.join(", ")}.`);
  }

  if (headline) promptParts.push(`Headline text: "${headline}".`);
  if (subheadline) promptParts.push(`Subheadline: "${subheadline}".`);
  if (cta) promptParts.push(`CTA button: "${cta}".`);

  if (styleReference) {
    promptParts.push("Match the visual style of the reference image.");
  }

  if (brandColors) promptParts.push(`Brand colors: ${brandColors}.`);

  promptParts.push(ls.langInstruction);
  promptParts.push(
    "High resolution, professional design, production-ready, no watermarks."
  );

  const prompt = promptParts.join(" ");

  try {
    // Determine size closest to the banner dimensions
    const size = dimensions.startsWith("1920") || dimensions.startsWith("2560") || dimensions.startsWith("2480")
      ? "1792x1024"
      : dimensions.startsWith("1640") || dimensions.startsWith("800")
      ? "1024x1024"
      : "1024x576";

    const imageResult = await zaiSdkBridge.generateImage({ prompt, size });
    const imageData = (imageResult as any)?.data;

    return {
      success: true,
      imageBase64: imageData?.base64 ?? undefined,
      imageUrl: imageData?.url ?? undefined,
      bannerFormat,
      dimensions,
      prompt,
      generatedAt: new Date().toISOString(),
    };
  } catch (e: unknown) {
    return {
      success: false,
      bannerFormat,
      dimensions,
      prompt,
      generatedAt: new Date().toISOString(),
    };
  }
}

export { BANNER_DIMENSIONS };
