/**
 * KREA — Commercial Creative Engine
 *
 * "Fábrica de creativos comerciales" — genera anuncios visuales,
 * secciones de landing pages, mockups y variantes A/B para e-commerce.
 *
 * Basado en principios de direct response marketing:
 *   - AIDA (Attention, Interest, Desire, Action)
 *   - PAS  (Problem, Agitation, Solution)
 *   - Hooks + beneficio principal + CTA urgente
 *
 * Usa el ZAI SDK Bridge para generación de imágenes y copy.
 */

import { zaiSdkBridge } from "./bridges/zai-sdk-bridge";

// ═══════════════════════════════════════════════════════════════════
// TYPES — Self-contained, no external type imports
// ═══════════════════════════════════════════════════════════════════

export type AdPlatform = "meta" | "tiktok" | "google";
export type AdFormat = "feed" | "story" | "carousel" | "banner" | "shopping";
export type LandingSectionType =
  | "hero"
  | "offer"
  | "before-after"
  | "benefits"
  | "comparison"
  | "authority"
  | "testimonials"
  | "how-to-use"
  | "logistics"
  | "faq";
export type MockupType =
  | "phone"
  | "laptop"
  | "billboard"
  | "box"
  | "bottle"
  | "tshirt"
  | "flat-lay";
export type CreativeAngle =
  | "price"
  | "emotion"
  | "social-proof"
  | "scarcity"
  | "authority"
  | "curiosity";
export type Language = "es" | "en" | "pt";

export interface ProductInfo {
  name: string;
  description: string;
  price?: string;
  imageUrl?: string;
  imageBase64?: string;
  category?: string;
  benefits?: string[];
  differentiators?: string[];
}

export interface AdCopy {
  headline: string;
  description: string;
  cta: string;
}

export interface AdGenerationParams {
  productImage?: string; // URL or base64
  platform: AdPlatform;
  adFormat: AdFormat;
  styleReference?: string; // URL or base64 style image
  copy?: Partial<AdCopy>;
  productInfo?: ProductInfo;
  language?: Language;
}

export interface LandingSectionParams {
  sectionType: LandingSectionType;
  productInfo: ProductInfo;
  templateStyle?: string; // "minimal" | "bold" | "elegant" | "playful"
  language?: Language;
  brandColors?: string; // e.g. "#FF6600,#333333"
}

export interface MockupParams {
  productImage: string; // URL or base64
  mockupType: MockupType;
  style?: string; // style descriptor
  productInfo?: ProductInfo;
  language?: Language;
}

export interface VariantParams {
  baseAd: AdGenerationParams;
  angles: CreativeAngle[];
  count: number; // variants per angle (total = angles.length * count)
  language?: Language;
}

export interface LaunchPackageParams {
  productInfo: ProductInfo;
  productImage?: string;
  platforms: AdPlatform[];
  adFormats: AdFormat[];
  sectionTypes: LandingSectionType[];
  mockupTypes: MockupType[];
  language?: Language;
  styleReference?: string;
}

export interface CreativeResult {
  success: boolean;
  imageBase64?: string;
  imageUrl?: string;
  metadata: {
    platform: AdPlatform;
    dimensions: string;
    format: string;
    generatedAt: string;
  };
}

export interface SectionResult {
  success: boolean;
  imageBase64?: string;
  sectionType: LandingSectionType;
  suggestedCopy?: {
    headline?: string;
    body?: string;
    cta?: string;
  };
}

export interface VariantPackResult {
  success: boolean;
  variants: Array<{
    angle: CreativeAngle;
    imageBase64?: string;
    copy: { headline: string; body: string; cta: string };
  }>;
}

export interface LaunchPackageResult {
  success: boolean;
  ads: CreativeResult[];
  sections: SectionResult[];
  mockups: CreativeResult[];
  totalAssets: number;
}

// ═══════════════════════════════════════════════════════════════════
// DIMENSION MAPS — Platform-specific ad sizes
// ═══════════════════════════════════════════════════════════════════

const AD_DIMENSIONS: Record<AdPlatform, Record<AdFormat, string>> = {
  meta: {
    feed: "1080x1080",
    story: "1080x1920",
    carousel: "1080x1080",
    banner: "1200x628",
    shopping: "1080x1080",
  },
  tiktok: {
    feed: "1080x1920",
    story: "1080x1920",
    carousel: "1080x1080",
    banner: "1080x1920",
    shopping: "1080x1080",
  },
  google: {
    feed: "1200x628",
    story: "1080x1920",
    carousel: "1080x1080",
    banner: "300x250",
    shopping: "1200x1200",
  },
};

// ═══════════════════════════════════════════════════════════════════
// LANGUAGE-LOCALIZED STRINGS
// ═══════════════════════════════════════════════════════════════════

const LANG_STRINGS: Record<Language, Record<string, string>> = {
  es: {
    systemRole:
      "Eres un copywriter experto en direct response marketing para e-commerce. Escribes en español. Usas principios AIDA y PAS. Generas headlines pegajosos, descripciones que venden y CTAs urgentes. Siempre incluyes el beneficio principal del producto.",
    ctaBuyNow: "¡Cómpralo ahora!",
    ctaLimited: "¡Oferta limitada — Compra ya!",
    ctaDiscover: "Descúbrelo ahora",
    ctaTryRisk: "Pruébalo sin riesgo",
    currency: "$",
    langInstruction: "Genera todo el copy en español.",
  },
  en: {
    systemRole:
      "You are an expert direct response copywriter for e-commerce. You use AIDA and PAS frameworks. You craft hooky headlines, selling descriptions, and urgent CTAs. You always lead with the main product benefit.",
    ctaBuyNow: "Buy now!",
    ctaLimited: "Limited offer — Buy now!",
    ctaDiscover: "Discover it now",
    ctaTryRisk: "Try risk-free",
    currency: "$",
    langInstruction: "Generate all copy in English.",
  },
  pt: {
    systemRole:
      "Você é um copywriter especialista em direct response marketing para e-commerce. Escreve em português. Usa princípios AIDA e PAS. Cria manchetes colantes, descrições que vendem e CTAs urgentes. Sempre inclui o benefício principal do produto.",
    ctaBuyNow: "Compre agora!",
    ctaLimited: "Oferta limitada — Compre já!",
    ctaDiscover: "Descubra agora",
    ctaTryRisk: "Experimente sem risco",
    currency: "R$",
    langInstruction: "Gere todo o copy em português.",
  },
};

// ═══════════════════════════════════════════════════════════════════
// PROMPT BUILDERS — AI prompt engineering for each creative type
// ═══════════════════════════════════════════════════════════════════

function buildProductContext(productInfo?: ProductInfo): string {
  if (!productInfo) return "";
  const parts: string[] = [];
  parts.push(`Product: ${productInfo.name}`);
  parts.push(`Description: ${productInfo.description}`);
  if (productInfo.price) parts.push(`Price: ${productInfo.price}`);
  if (productInfo.category) parts.push(`Category: ${productInfo.category}`);
  if (productInfo.benefits?.length)
    parts.push(`Benefits: ${productInfo.benefits.join(", ")}`);
  if (productInfo.differentiators?.length)
    parts.push(`Differentiators: ${productInfo.differentiators.join(", ")}`);
  return parts.join(". ");
}

function buildAdImagePrompt(params: AdGenerationParams): string {
  const { platform, adFormat, productInfo, styleReference, copy } = params;
  const lang = params.language ?? "es";
  const ls = LANG_STRINGS[lang];

  const platformNames: Record<AdPlatform, string> = {
    meta: "Facebook/Instagram",
    tiktok: "TikTok",
    google: "Google Ads",
  };
  const formatDescs: Record<AdFormat, string> = {
    feed: "in-feed square or rectangular ad",
    story: "vertical full-screen story ad",
    carousel: "carousel card square ad",
    banner: "display banner ad",
    shopping: "product shopping ad",
  };

  const promptParts: string[] = [];

  // Core instruction
  promptParts.push(
    `Create a professional ${platformNames[platform]} ${formatDescs[adFormat]} creative.`
  );

  // Product context
  if (productInfo) {
    promptParts.push(
      `The product is "${productInfo.name}": ${productInfo.description}.`
    );
    if (productInfo.benefits?.length) {
      promptParts.push(`Key benefits: ${productInfo.benefits.join(", ")}.`);
    }
  }

  // Copy elements to visualize
  if (copy?.headline) {
    promptParts.push(`The headline text on the image is: "${copy.headline}".`);
  }
  if (copy?.cta) {
    promptParts.push(`The CTA button text is: "${copy.cta}".`);
  }

  // Style guidance
  if (styleReference) {
    promptParts.push(
      "Match the visual style of the reference image: clean, modern, high-converting e-commerce aesthetic."
    );
  } else {
    // Default style per platform
    if (platform === "tiktok") {
      promptParts.push(
        "Style: trendy, dynamic, bold colors, TikTok-native feel, UGC-friendly, vibrant gradients or patterns."
      );
    } else if (platform === "meta") {
      promptParts.push(
        "Style: clean, professional, high-contrast, attention-grabbing headline, clear CTA button, premium feel."
      );
    } else {
      promptParts.push(
        "Style: clean, minimal, professional, Google Ads compliant, readable at small sizes, clear value proposition."
      );
    }
  }

  // Format-specific layout guidance
  if (adFormat === "story") {
    promptParts.push(
      "Layout: vertical 9:16, large product image centered or top, headline bold at top or center, CTA button at bottom, use vertical space fully."
    );
  } else if (adFormat === "carousel") {
    promptParts.push(
      "Layout: square 1:1, single product hero shot, clean background, headline and CTA prominent, swipe-worthy visual."
    );
  } else if (adFormat === "banner") {
    promptParts.push(
      "Layout: wide format, product on one side, headline and CTA on the other, balanced composition."
    );
  } else if (adFormat === "shopping") {
    promptParts.push(
      "Layout: product-focused, clean white or light background, minimal text overlay, price prominent if shown."
    );
  } else {
    promptParts.push(
      "Layout: balanced product showcase with headline and CTA, eye-catching, scroll-stopping."
    );
  }

  promptParts.push(ls.langInstruction);
  promptParts.push(
    "High quality, photorealistic product rendering, commercial-grade design, no watermarks."
  );

  return promptParts.join(" ");
}

function buildSectionImagePrompt(params: LandingSectionParams): string {
  const { sectionType, productInfo, templateStyle, brandColors } = params;
  const lang = params.language ?? "es";
  const ls = LANG_STRINGS[lang];

  const sectionVisuals: Record<LandingSectionType, string> = {
    hero:
      "Full-width hero section with large product hero shot, bold headline overlay, gradient background, floating product with shadows, premium feel.",
    offer:
      "Special offer section with discount badge, crossed-out old price, bold new price, urgency timer visual, bright accent colors.",
    "before-after":
      "Before/After comparison split screen — left side shows 'before' problem state, right side shows 'after' result with product, clear divider line.",
    benefits:
      "Benefits grid with icon-style illustrations for each benefit, clean card layout, 3-4 benefit cards, subtle background pattern.",
    comparison:
      "Competitor comparison table — 'Others vs Us' layout, checkmarks for our product, X marks for competitors, green highlight for advantages.",
    authority:
      "Authority/trust section with media logos (as seen on), certification badges, doctor/expert endorsement area, professional background.",
    testimonials:
      "Testimonials section with 3 customer review cards, star ratings, quote marks, customer avatar placeholders, warm background.",
    "how-to-use":
      "Step-by-step usage guide with numbered steps (1, 2, 3), product in use at each step, arrow connectors between steps, instructional feel.",
    logistics:
      "Shipping/returns info section with delivery truck, box, shield icons, 'free shipping', '30-day returns', 'secure payment' badges.",
    faq: "FAQ section with accordion-style question blocks, clean Q&A layout, expand/collapse visual hints, organized and trustworthy.",
  };

  const promptParts: string[] = [];
  promptParts.push(
    `Create a landing page section image: "${sectionType}" section.`
  );
  promptParts.push(sectionVisuals[sectionType]);
  promptParts.push(
    `Product: "${productInfo.name}" — ${productInfo.description}.`
  );
  if (productInfo.benefits?.length) {
    promptParts.push(`Show these benefits: ${productInfo.benefits.join(", ")}.`);
  }
  if (productInfo.price) {
    promptParts.push(`Price: ${productInfo.price}.`);
  }

  // Style
  const styleMap: Record<string, string> = {
    minimal: "Minimalist style: lots of white space, thin fonts, muted palette.",
    bold: "Bold style: large typography, high contrast, vibrant colors.",
    elegant: "Elegant style: serif fonts, gold/navy palette, luxurious feel.",
    playful: "Playful style: rounded elements, bright palette, fun illustrations.",
  };
  if (templateStyle && styleMap[templateStyle]) {
    promptParts.push(styleMap[templateStyle]);
  } else {
    promptParts.push(
      "Clean modern e-commerce style: sans-serif typography, balanced whitespace, conversion-optimized layout."
    );
  }

  if (brandColors) {
    promptParts.push(`Brand colors: ${brandColors}.`);
  }

  promptParts.push(ls.langInstruction);
  promptParts.push(
    "Render as a polished web section image, high resolution, ready for landing page use, no watermarks."
  );

  return promptParts.join(" ");
}

function buildMockupImagePrompt(params: MockupParams): string {
  const { mockupType, style, productInfo } = params;
  const lang = params.language ?? "es";

  const mockupScenes: Record<MockupType, string> = {
    phone:
      "Product displayed on a modern smartphone screen, iPhone-style device, clean hands holding phone or phone on marble desk, lifestyle context.",
    laptop:
      "Product displayed on a MacBook laptop screen, sleek aluminum device, coffee cup and plant beside it, modern workspace.",
    billboard:
      "Product featured on a large outdoor billboard, urban setting, city street or highway, realistic lighting and scale.",
    box:
      "Product packaging box mockup, 3D perspective view, realistic cardboard texture, label with product name, studio lighting.",
    bottle:
      "Product as a bottle label mockup, realistic bottle shape, liquid visible, condensation effect, studio product photography style.",
    tshirt:
      "Product design printed on a premium t-shirt, model wearing it or flat-lay on clean background, fabric texture visible.",
    "flat-lay":
      "Product in a styled flat-lay arrangement, surrounded by complementary props, shot from above, aesthetic composition.",
  };

  const promptParts: string[] = [];
  promptParts.push(
    `Create a professional product mockup: ${mockupType} mockup.`
  );
  promptParts.push(mockupScenes[mockupType]);

  if (productInfo) {
    promptParts.push(
      `The product is "${productInfo.name}": ${productInfo.description}.`
    );
  }

  if (style) {
    promptParts.push(`Style: ${style}.`);
  } else {
    promptParts.push(
      "Style: premium, photorealistic, studio-quality, commercial product photography."
    );
  }

  if (lang !== "en") {
    promptParts.push(LANG_STRINGS[lang].langInstruction);
  }
  promptParts.push(
    "Ultra-realistic, high resolution, professional mockup, no watermarks, production-ready."
  );

  return promptParts.join(" ");
}

function buildCopyPrompt(
  purpose: "ad" | "section" | "variant",
  context: {
    productInfo?: ProductInfo;
    platform?: AdPlatform;
    adFormat?: AdFormat;
    sectionType?: LandingSectionType;
    angle?: CreativeAngle;
    language?: Language;
  }
): Array<{ role: "system" | "user"; content: string }> {
  const lang = context.language ?? "es";
  const ls = LANG_STRINGS[lang];

  const messages: Array<{ role: "system" | "user"; content: string }> = [];

  // System message
  messages.push({
    role: "system",
    content: ls.systemRole,
  });

  // User message with context
  let userContent = "";

  if (purpose === "ad") {
    userContent = `Generate direct response ad copy for:\n${buildProductContext(context.productInfo)}\n\n`;
    if (context.platform) userContent += `Platform: ${context.platform}\n`;
    if (context.adFormat) userContent += `Format: ${context.adFormat}\n`;
    userContent += `\nReturn JSON ONLY:\n{"headline": "...", "description": "...", "cta": "..."}\n\nRules:\n- Headline: max 40 chars, hook + benefit, punchy\n- Description: max 125 chars, expand benefit, create desire\n- CTA: max 25 chars, action verb + urgency\n- Use AIDA framework\n${ls.langInstruction}`;
  } else if (purpose === "section") {
    userContent = `Generate landing page section copy for "${
      context.sectionType
    }" section:\n${buildProductContext(context.productInfo)}\n\n`;
    userContent += `Return JSON ONLY:\n{"headline": "...", "body": "...", "cta": "..."}\n\nRules:\n- Headline: max 60 chars, clear value proposition\n- Body: max 200 chars, elaborate benefit or proof\n- CTA: max 25 chars, action-oriented\n- Match section purpose: ${context.sectionType}\n${ls.langInstruction}`;
  } else if (purpose === "variant") {
    const anglePrompts: Record<CreativeAngle, string> = {
      price:
        "Focus on price/value — emphasize discount, savings, best price guarantee, ROI.",
      emotion:
        "Focus on emotion — the transformation, how life improves, feelings of joy/confidence/relief.",
      "social-proof":
        "Focus on social proof — number of customers, ratings, testimonials, 'as seen on', popularity.",
      scarcity:
        "Focus on scarcity/urgency — limited stock, countdown, 'selling fast', exclusive offer, FOMO.",
      authority:
        "Focus on authority — expert endorsement, scientific backing, certifications, media mentions.",
      curiosity:
        "Focus on curiosity — surprising fact, 'you won't believe', 'secret', 'the trick', open loop.",
    };
    userContent = `Generate ad copy variant with ${context.angle} angle:\n${buildProductContext(
      context.productInfo
    )}\n\nAngle strategy: ${anglePrompts[context.angle!]}\n\nReturn JSON ONLY:\n{"headline": "...", "description": "...", "cta": "..."}\n\nRules:\n- Headline: max 40 chars, ${context.angle}-driven hook\n- Description: max 125 chars, ${context.angle} angle expanded\n- CTA: max 25 chars, matches ${context.angle} urgency level\n${ls.langInstruction}`;
  }

  messages.push({ role: "user", content: userContent });
  return messages;
}

// ═══════════════════════════════════════════════════════════════════
// COPY GENERATION — Uses ZAI SDK chat
// ═══════════════════════════════════════════════════════════════════

async function generateCopy(
  purpose: "ad" | "section" | "variant",
  context: {
    productInfo?: ProductInfo;
    platform?: AdPlatform;
    adFormat?: AdFormat;
    sectionType?: LandingSectionType;
    angle?: CreativeAngle;
    language?: Language;
  }
): Promise<{ headline: string; description: string; cta: string }> {
  const lang = context.language ?? "es";
  const ls = LANG_STRINGS[lang];

  try {
    const messages = buildCopyPrompt(purpose, context);
    const result = await zaiSdkBridge.chat({
      messages,
      temperature: 0.8,
      maxTokens: 500,
    });

    if (!result.success || !result.data?.content) {
      return fallbackCopy(purpose, context, ls);
    }

    // Parse JSON from the response — handle markdown code blocks
    let content = result.data.content.trim();
    // Strip ```json ... ``` wrapping if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      content = jsonMatch[1].trim();
    }
    // Try to find JSON object in the content
    const objMatch = content.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        const parsed = JSON.parse(objMatch[0]);
        return {
          headline: parsed.headline || "",
          description: parsed.description || "",
          cta: parsed.cta || "",
        };
      } catch {
        // JSON parse failed, fall through
      }
    }

    return fallbackCopy(purpose, context, ls);
  } catch (error) {
    console.warn("[CommercialEngine] Copy generation failed:", error);
    return fallbackCopy(purpose, context, ls);
  }
}

function fallbackCopy(
  purpose: "ad" | "section" | "variant",
  context: {
    productInfo?: ProductInfo;
    sectionType?: LandingSectionType;
    angle?: CreativeAngle;
  },
  ls: Record<string, string>
): { headline: string; description: string; cta: string } {
  const name = context.productInfo?.name || "este producto";
  const desc = context.productInfo?.description || "";
  const price = context.productInfo?.price;

  if (purpose === "section") {
    const sectionHeadlines: Record<string, string> = {
      hero: `${name} — Descubre la diferencia`,
      offer: price
        ? `¡Solo ${ls.currency}${price} por ${name}!`
        : `Oferta especial en ${name}`,
      "before-after": `Resultados reales con ${name}`,
      benefits: `Por qué ${name} es tu mejor opción`,
      comparison: `${name} vs. el resto`,
      authority: `Respaldado por expertos`,
      testimonials: `Lo que dicen nuestros clientes`,
      "how-to-use": `Cómo usar ${name} en 3 pasos`,
      logistics: `Envío gratis · Devoluciones fáciles`,
      faq: `Preguntas frecuentes sobre ${name}`,
    };
    return {
      headline:
        sectionHeadlines[context.sectionType ?? "hero"] || `Descubre ${name}`,
      description: desc,
      cta: ls.ctaDiscover,
    };
  }

  // Ad / variant fallback
  const angleHeadlines: Record<CreativeAngle, string> = {
    price: price
      ? `¡${ls.currency}${price} — Oferta increíble!`
      : `El mejor precio para ${name}`,
    emotion: `Transforma tu vida con ${name}`,
    "social-proof": `+10,000 clientes eligen ${name}`,
    scarcity: `¡Últimas unidades de ${name}!`,
    authority: `#1 Recomendado por expertos`,
    curiosity: `El secreto detrás de ${name}`,
  };

  return {
    headline:
      (context.angle && angleHeadlines[context.angle]) ||
      `Descubre ${name}`,
    description: desc || `${name} — calidad premium, resultados garantizados.`,
    cta: context.angle === "scarcity" ? ls.ctaLimited : ls.ctaBuyNow,
  };
}

// ═══════════════════════════════════════════════════════════════════
// IMAGE GENERATION — Uses ZAI SDK with fallback
// ═══════════════════════════════════════════════════════════════════

async function generateCreativeImage(
  prompt: string,
  size: string
): Promise<{ base64: string; url?: string } | null> {
  try {
    const result = await zaiSdkBridge.generateImage({
      prompt,
      size,
      model: "flux-krea-v2",
    });

    if (result.success && result.data) {
      return {
        base64: result.data.base64,
        url: result.data.url,
      };
    }

    console.warn(
      "[CommercialEngine] Image generation returned no data:",
      result.error
    );
    return null;
  } catch (error) {
    console.warn("[CommercialEngine] Image generation failed:", error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ENGINE — Public API
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a single ad creative for a specific platform + format.
 *
 * Combines AI-generated copy + AI-generated image into a single creative.
 * If copy is provided in params, it's used directly; otherwise it's generated.
 */
export async function generateAd(
  params: AdGenerationParams
): Promise<CreativeResult> {
  const { platform, adFormat, productInfo } = params;
  const lang = params.language ?? "es";
  const dimensions = AD_DIMENSIONS[platform][adFormat];

  // Step 1: Generate or use provided copy
  let headline = params.copy?.headline ?? "";
  let description = params.copy?.description ?? "";
  let cta = params.copy?.cta ?? "";

  if (!headline || !description || !cta) {
    const generatedCopy = await generateCopy("ad", {
      productInfo,
      platform,
      adFormat,
      language: lang,
    });
    headline = headline || generatedCopy.headline;
    description = description || generatedCopy.description;
    cta = cta || generatedCopy.cta;
  }

  // Step 2: Build the image prompt with copy baked in
  const imagePrompt = buildAdImagePrompt({
    ...params,
    copy: { headline, description, cta },
  });

  // Step 3: Generate the image
  const imageResult = await generateCreativeImage(imagePrompt, dimensions);

  return {
    success: imageResult !== null,
    imageBase64: imageResult?.base64,
    imageUrl: imageResult?.url,
    metadata: {
      platform,
      dimensions,
      format: adFormat,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Generate a landing page section as a visual image.
 *
 * Each section type has specific layout and copy strategies.
 * Returns the section image + suggested copy text.
 */
export async function generateLandingSection(
  params: LandingSectionParams
): Promise<SectionResult> {
  const { sectionType, productInfo } = params;
  const lang = params.language ?? "es";

  // Step 1: Generate section-specific copy
  const copy = await generateCopy("section", {
    productInfo,
    sectionType,
    language: lang,
  });

  // Step 2: Build image prompt
  const imagePrompt = buildSectionImagePrompt(params);

  // Step 3: Determine dimensions (sections are wide format)
  const sectionDimensions = "1200x800";

  // Step 4: Generate the image
  const imageResult = await generateCreativeImage(
    imagePrompt,
    sectionDimensions
  );

  return {
    success: imageResult !== null,
    imageBase64: imageResult?.base64,
    sectionType,
    suggestedCopy: {
      headline: copy.headline,
      body: copy.description,
      cta: copy.cta,
    },
  };
}

/**
 * Generate a product mockup in a device/lifestyle context.
 *
 * Places the product image in a realistic scene (phone, laptop, billboard, etc.)
 */
export async function generateMockup(
  params: MockupParams
): Promise<CreativeResult> {
  const { mockupType, productInfo } = params;
  const lang = params.language ?? "es";

  // Step 1: Build mockup prompt
  const imagePrompt = buildMockupImagePrompt(params);

  // Step 2: Determine dimensions based on mockup type
  const mockupDimensions: Record<MockupType, string> = {
    phone: "1080x1920",
    laptop: "1920x1080",
    billboard: "1920x1080",
    box: "1080x1080",
    bottle: "1080x1440",
    tshirt: "1080x1350",
    "flat-lay": "1080x1080",
  };
  const dimensions = mockupDimensions[mockupType];

  // Step 3: Generate the image
  const imageResult = await generateCreativeImage(imagePrompt, dimensions);

  // Map mockupType to a pseudo-platform for metadata consistency
  const mockupPlatform: AdPlatform = "meta";

  return {
    success: imageResult !== null,
    imageBase64: imageResult?.base64,
    imageUrl: imageResult?.url,
    metadata: {
      platform: mockupPlatform,
      dimensions,
      format: `mockup-${mockupType}`,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Generate A/B testing variant packs.
 *
 * For each creative angle, generates N variants with different hooks/copy.
 * Returns an array of { angle, image, copy } for each variant.
 */
export async function generateVariantPack(
  params: VariantParams
): Promise<VariantPackResult> {
  const { baseAd, angles, count, language } = params;
  const lang = language ?? "es";
  const variants: VariantPackResult["variants"] = [];

  // Process each angle
  for (const angle of angles) {
    // Generate copy for this angle
    const angleCopy = await generateCopy("variant", {
      productInfo: baseAd.productInfo,
      platform: baseAd.platform,
      adFormat: baseAd.adFormat,
      angle,
      language: lang,
    });

    // Generate `count` image variants for this angle
    for (let i = 0; i < count; i++) {
      const dimensions = AD_DIMENSIONS[baseAd.platform][baseAd.adFormat];

      // Vary the prompt slightly for each variant
      const variationSuffix =
        i === 0
          ? ""
          : ` Variation ${i + 1}: slightly different composition, angle, or color scheme.`;

      const imagePrompt =
        buildAdImagePrompt({
          ...baseAd,
          copy: {
            headline: angleCopy.headline,
            description: angleCopy.description,
            cta: angleCopy.cta,
          },
        }) + variationSuffix;

      const imageResult = await generateCreativeImage(imagePrompt, dimensions);

      variants.push({
        angle,
        imageBase64: imageResult?.base64,
        copy: {
          headline: angleCopy.headline,
          body: angleCopy.description,
          cta: angleCopy.cta,
        },
      });
    }
  }

  return {
    success: variants.length > 0,
    variants,
  };
}

/**
 * Generate a complete launch package — the whole creative arsenal.
 *
 * Produces:
 *   - Ads: for each (platform × adFormat) combination
 *   - Landing sections: for each requested section type
 *   - Mockups: for each requested mockup type
 *
 * Total assets = ads.length + sections.length + mockups.length
 */
export async function generateLaunchPackage(
  params: LaunchPackageParams
): Promise<LaunchPackageResult> {
  const {
    productInfo,
    productImage,
    platforms,
    adFormats,
    sectionTypes,
    mockupTypes,
    language,
    styleReference,
  } = params;
  const lang = language ?? "es";

  const ads: CreativeResult[] = [];
  const sections: SectionResult[] = [];
  const mockups: CreativeResult[] = [];

  // Generate all ad combinations (platform × format)
  const adPromises: Promise<CreativeResult>[] = [];
  for (const platform of platforms) {
    for (const adFormat of adFormats) {
      adPromises.push(
        generateAd({
          productImage,
          platform,
          adFormat,
          styleReference,
          productInfo,
          language: lang,
        })
      );
    }
  }

  // Generate all sections
  const sectionPromises: Promise<SectionResult>[] = [];
  for (const sectionType of sectionTypes) {
    sectionPromises.push(
      generateLandingSection({
        sectionType,
        productInfo,
        language: lang,
      })
    );
  }

  // Generate all mockups
  const mockupPromises: Promise<CreativeResult>[] = [];
  for (const mockupType of mockupTypes) {
    mockupPromises.push(
      generateMockup({
        productImage: productImage ?? "",
        mockupType,
        productInfo,
        language: lang,
      })
    );
  }

  // Execute all in parallel for speed
  const [adResults, sectionResults, mockupResults] = await Promise.all([
    Promise.all(adPromises),
    Promise.all(sectionPromises),
    Promise.all(mockupPromises),
  ]);

  ads.push(...adResults);
  sections.push(...sectionResults);
  mockups.push(...mockupResults);

  const totalAssets = ads.length + sections.length + mockups.length;

  return {
    success: totalAssets > 0,
    ads,
    sections,
    mockups,
    totalAssets,
  };
}

// ═══════════════════════════════════════════════════════════════════
// DEFAULT LAUNCH PACKAGE — Pre-configured for quick start
// ═══════════════════════════════════════════════════════════════════

/**
 * Quick-start: generate a standard launch package with recommended defaults.
 *
 * 3 ad formats × 2 platforms + 5 landing sections + 2 mockups
 */
export async function generateDefaultLaunchPackage(params: {
  productInfo: ProductInfo;
  productImage?: string;
  language?: Language;
  styleReference?: string;
}): Promise<LaunchPackageResult> {
  return generateLaunchPackage({
    productInfo: params.productInfo,
    productImage: params.productImage,
    platforms: ["meta", "tiktok"],
    adFormats: ["feed", "story", "carousel"],
    sectionTypes: ["hero", "offer", "benefits", "testimonials", "how-to-use"],
    mockupTypes: ["phone", "flat-lay"],
    language: params.language ?? "es",
    styleReference: params.styleReference,
  });
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY — Quick single-shot helpers
// ═══════════════════════════════════════════════════════════════════

/**
 * Quick Meta ad generation (most common use case).
 */
export async function generateMetaAd(params: {
  productInfo: ProductInfo;
  productImage?: string;
  adFormat?: AdFormat;
  language?: Language;
}): Promise<CreativeResult> {
  return generateAd({
    productImage: params.productImage,
    platform: "meta",
    adFormat: params.adFormat ?? "feed",
    productInfo: params.productInfo,
    language: params.language ?? "es",
  });
}

/**
 * Quick TikTok ad generation.
 */
export async function generateTikTokAd(params: {
  productInfo: ProductInfo;
  productImage?: string;
  adFormat?: AdFormat;
  language?: Language;
}): Promise<CreativeResult> {
  return generateAd({
    productImage: params.productImage,
    platform: "tiktok",
    adFormat: params.adFormat ?? "feed",
    productInfo: params.productInfo,
    language: params.language ?? "es",
  });
}

/**
 * Quick Google ad generation.
 */
export async function generateGoogleAd(params: {
  productInfo: ProductInfo;
  productImage?: string;
  adFormat?: AdFormat;
  language?: Language;
}): Promise<CreativeResult> {
  return generateAd({
    productImage: params.productImage,
    platform: "google",
    adFormat: params.adFormat ?? "banner",
    productInfo: params.productInfo,
    language: params.language ?? "es",
  });
}

// ═══════════════════════════════════════════════════════════════════
// COMMERCIAL CREATIVE ENGINE CLASS — Singleton for API routes
// ═══════════════════════════════════════════════════════════════════

/**
 * Facade class providing the commercial creative engine API.
 *
 * Used by API routes via `CommercialCreativeEngine.getInstance()`.
 * Delegates to the standalone functions above.
 */
export class CommercialCreativeEngine {
  private static instance: CommercialCreativeEngine | null = null;

  /** Get the singleton instance */
  static getInstance(): CommercialCreativeEngine {
    if (!CommercialCreativeEngine.instance) {
      CommercialCreativeEngine.instance = new CommercialCreativeEngine();
    }
    return CommercialCreativeEngine.instance;
  }

  /** Reset singleton (for testing) */
  static resetInstance(): void {
    CommercialCreativeEngine.instance = null;
  }

  // Private constructor enforces singleton
  private constructor() {}

  /**
   * Return the list of capabilities this engine supports.
   * Used by GET /api/commercial to advertise available options.
   */
  getCapabilities(): {
    platforms: AdPlatform[];
    sectionTypes: LandingSectionType[];
    mockupTypes: MockupType[];
    angles: CreativeAngle[];
    pricing: Record<string, string>;
  } {
    return {
      platforms: ["meta", "tiktok", "google"],
      sectionTypes: [
        "hero",
        "offer",
        "before-after",
        "benefits",
        "comparison",
        "authority",
        "testimonials",
        "how-to-use",
        "logistics",
        "faq",
      ],
      mockupTypes: ["phone", "laptop", "billboard", "box", "bottle", "tshirt", "flat-lay"],
      angles: ["price", "emotion", "social-proof", "scarcity", "authority", "curiosity"],
      pricing: {
        ad: "1 credit per ad creative",
        section: "1 credit per landing section",
        mockup: "1 credit per mockup",
        variantPack: "N credits (1 per variant)",
        launchPackage: "Sum of all included assets",
      },
    };
  }

  /**
   * Generate a single ad creative.
   *
   * Accepts `format` or `adFormat` for flexibility with API routes.
   */
  async generateAd(params: {
    platform: AdPlatform;
    format?: AdFormat;
    adFormat?: AdFormat;
    productInfo?: ProductInfo;
    productImage?: string;
    styleReference?: string;
    copy?: Partial<AdCopy>;
    language?: Language;
  }): Promise<CreativeResult> {
    return generateAd({
      platform: params.platform,
      adFormat: params.adFormat ?? params.format ?? "feed",
      productInfo: params.productInfo,
      productImage: params.productImage,
      styleReference: params.styleReference,
      copy: params.copy,
      language: params.language,
    });
  }

  /**
   * Generate a landing page section.
   */
  async generateLandingSection(params: {
    sectionType: LandingSectionType;
    productInfo: ProductInfo;
    templateStyle?: string;
    language?: Language;
    brandColors?: string;
  }): Promise<SectionResult> {
    return generateLandingSection({
      sectionType: params.sectionType,
      productInfo: params.productInfo,
      templateStyle: params.templateStyle,
      language: params.language,
      brandColors: params.brandColors,
    });
  }

  /**
   * Generate a product mockup.
   */
  async generateMockup(params: {
    productImage: string;
    mockupType: MockupType;
    style?: string;
    productInfo?: ProductInfo;
    language?: Language;
  }): Promise<CreativeResult> {
    return generateMockup({
      productImage: params.productImage,
      mockupType: params.mockupType,
      style: params.style,
      productInfo: params.productInfo,
      language: params.language,
    });
  }

  /**
   * Generate an A/B testing variant pack.
   */
  async generateVariantPack(params: {
    baseAd: AdGenerationParams;
    angles: CreativeAngle[];
    count?: number;
    language?: Language;
  }): Promise<VariantPackResult> {
    return generateVariantPack({
      baseAd: params.baseAd,
      angles: params.angles,
      count: params.count ?? 1,
      language: params.language,
    });
  }

  /**
   * Generate a complete launch package.
   *
   * Accepts `sections` or `sectionTypes` for flexibility with API routes.
   */
  async generateLaunchPackage(params: {
    productInfo: ProductInfo;
    productImage?: string;
    platforms: AdPlatform[];
    adFormats?: AdFormat[];
    sections?: LandingSectionType[];
    sectionTypes?: LandingSectionType[];
    mockupTypes: MockupType[];
    language?: Language;
    styleReference?: string;
  }): Promise<LaunchPackageResult> {
    return generateLaunchPackage({
      productInfo: params.productInfo,
      productImage: params.productImage,
      platforms: params.platforms,
      adFormats: params.adFormats ?? ["feed", "story", "carousel"],
      sectionTypes: params.sectionTypes ?? params.sections ?? ["hero", "offer", "benefits"],
      mockupTypes: params.mockupTypes,
      language: params.language,
      styleReference: params.styleReference,
    });
  }

  /**
   * Quick-start default launch package.
   */
  async generateDefaultLaunchPackage(params: {
    productInfo: ProductInfo;
    productImage?: string;
    language?: Language;
    styleReference?: string;
  }): Promise<LaunchPackageResult> {
    return generateDefaultLaunchPackage(params);
  }
}
