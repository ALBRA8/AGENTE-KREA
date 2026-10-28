/**
 * KREA Commercial — Email Creative Generator
 *
 * Genera creativos visuales para email marketing:
 * headers, bloques promo, showcases, CTAs, footers, newsletter heroes.
 *
 * Inspirado por ecom-magic.ai: Email marketing graphics.
 */

import { zaiSdkBridge } from "../bridges/zai-sdk-bridge";
import type { EmailCreativeParams, EmailCreativeResult, EmailCreativeType } from "./types";
import { LANG_STRINGS } from "../commercial-creative-engine";

// ─── Email Creative Layouts ────────────────────────────────────────

const EMAIL_LAYOUTS: Record<EmailCreativeType, { dimensions: string; description: string }> = {
  header: {
    dimensions: "600x200",
    description:
      "Email header image with brand logo area, headline text, and decorative background. Professional, clean, works in all email clients.",
  },
  "promo-block": {
    dimensions: "600x400",
    description:
      "Promotional content block with product image, offer text, discount badge, and CTA area. Eye-catching, conversion-focused.",
  },
  "product-showcase": {
    dimensions: "600x500",
    description:
      "Product grid showcase with 2-3 products displayed, each with image, name, price, and mini CTA. Clean grid layout.",
  },
  "cta-button": {
    dimensions: "600x120",
    description:
      "CTA button as a styled image, rounded corners, contrasting color, action text centered, hover-state suggestion.",
  },
  footer: {
    dimensions: "600x150",
    description:
      "Branded email footer with company logo, social media icons area, unsubscribe link area, and legal text space.",
  },
  "newsletter-hero": {
    dimensions: "600x300",
    description:
      "Newsletter hero image with featured content preview, engaging visual, headline text overlay, editorial feel.",
  },
};

// ─── Email Creative Generation ─────────────────────────────────────

export async function generateEmailCreative(params: EmailCreativeParams): Promise<EmailCreativeResult> {
  const {
    productInfo,
    creativeType,
    headline,
    bodyCopy,
    cta,
    brandColors,
    language = "es",
  } = params;

  const ls = LANG_STRINGS[language];
  // Fallback to "header" layout when creativeType is invalid/unknown
  const layout = EMAIL_LAYOUTS[creativeType] ?? EMAIL_LAYOUTS["header"];
  const effectiveType: EmailCreativeType = EMAIL_LAYOUTS[creativeType] ? creativeType : "header";

  const promptParts: string[] = [];

  promptParts.push(`Create an email marketing creative: ${effectiveType} (${layout.dimensions}).`);
  promptParts.push(layout.description);
  promptParts.push(`Product: "${productInfo.name}" — ${productInfo.description}.`);

  if (productInfo.price) promptParts.push(`Price: ${productInfo.price}.`);
  if (headline) promptParts.push(`Headline: "${headline}".`);
  if (bodyCopy) promptParts.push(`Body copy: "${bodyCopy}".`);
  if (cta) promptParts.push(`CTA text: "${cta}".`);
  if (brandColors) promptParts.push(`Brand colors: ${brandColors}.`);

  promptParts.push(ls.langInstruction);
  promptParts.push(
    "Email-safe design, renders in Gmail/Outlook/Apple Mail, high resolution, professional, no watermarks."
  );

  const prompt = promptParts.join(" ");

  try {
    const size = layout.dimensions.startsWith("600x2") || layout.dimensions.startsWith("600x1")
      ? "1024x576"
      : "1024x1024";

    const imageResult = await zaiSdkBridge.generateImage({ prompt, size });
    const imageData = (imageResult as any)?.data;

    return {
      success: true,
      imageBase64: imageData?.base64 ?? undefined,
      imageUrl: imageData?.url ?? undefined,
      creativeType: effectiveType,
      dimensions: layout.dimensions,
      prompt,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      success: false,
      creativeType: effectiveType,
      dimensions: layout.dimensions,
      prompt,
      generatedAt: new Date().toISOString(),
    };
  }
}

export { EMAIL_LAYOUTS };
