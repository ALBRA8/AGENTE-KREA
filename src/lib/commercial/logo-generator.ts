/**
 * KREA Commercial — Logo Generator
 *
 * Genera logos profesionales para marcas y productos usando
 * el ZAI SDK Bridge para generación de imágenes.
 *
 * Inspirado por ecom-magic.ai: Logo Generator (1 crédito cada uno).
 * KREA absorbe solo la capacidad de producción, no la investigación.
 */

import { getProvider } from "@/contracts/provider-registry";
import type {
  LogoParams,
  LogoResult,
  LogoStyle,
  LogoVariant,
  Language,
} from "./types";

import { LANG_STRINGS } from "../commercial-creative-engine";

// ─── Logo Style Descriptors ────────────────────────────────────────

const LOGO_STYLE_PROMPTS: Record<LogoStyle, string> = {
  wordmark:
    "Wordmark logo: stylized typography, custom lettering, no icon, focus on the brand name with unique font treatment, clean and memorable.",
  iconic:
    "Iconic logo: recognizable symbol/icon paired with the brand name text, balanced composition, the icon works standalone as an app icon.",
  abstract:
    "Abstract mark logo: geometric or organic abstract shape, no literal representation, modern and artistic, works at all sizes.",
  monogram:
    "Monogram logo: single letter or initials stylized into a cohesive mark, elegant, works well as avatar/icon, premium feel.",
  emblem:
    "Emblem logo: badge or seal style, text enclosed within a shape, classic and authoritative, like a coat of arms or stamp.",
  mascot:
    "Mascot logo: character or figure representing the brand, friendly and approachable, illustrated style, memorable and distinctive.",
};

const LOGO_VARIANT_INSTRUCTIONS: Record<LogoVariant, string> = {
  primary: "Primary logo: full color, standard version, the main brand mark.",
  "icon-only": "Icon-only version: just the symbol/mark without text, for app icons and favicons.",
  horizontal: "Horizontal layout: icon on left, text on right, for headers and wide spaces.",
  stacked: "Stacked layout: icon on top, text below, for narrow spaces and social profiles.",
  "dark-bg": "Dark background version: white or light colors on dark background, for dark themes.",
  "light-bg": "Light background version: dark colors on white/light background, for light themes.",
};

const INDUSTRY_MOOD_MAP: Record<string, string> = {
  beauty: "Elegant, refined, soft curves, premium palette (gold, rose, cream).",
  fitness: "Bold, dynamic, strong lines, energetic palette (red, black, orange).",
  tech: "Clean, modern, geometric, tech palette (blue, gradient, dark).",
  food: "Warm, appetizing, organic shapes, food palette (green, orange, brown).",
  fashion: "Chic, minimal, sophisticated typography, fashion palette (black, gold, white).",
  supplements: "Scientific, clean, trustworthy, health palette (green, blue, white).",
  education: "Friendly, approachable, clean, educational palette (blue, yellow, white).",
  finance: "Professional, stable, authoritative, finance palette (navy, gold, gray).",
  home: "Cozy, inviting, natural textures, home palette (earth tones, green, cream).",
};

// ─── Logo Generation ───────────────────────────────────────────────

export async function generateLogo(params: LogoParams): Promise<LogoResult> {
  const {
    brandName,
    tagline,
    industry,
    style = "iconic",
    brandColors,
    mood,
    variants = ["primary", "icon-only", "horizontal"],
    language = "es",
  } = params;

  const ls = LANG_STRINGS[language];
  const generatedVariants: LogoResult["variants"] = [];

  // Defensive normalization of `variants`:
  //  - number N  → first N default variants (ecom-magic style count)
  //  - array     → keep only valid LogoVariant values
  //  - anything else / empty → full default set
  const DEFAULT_VARIANTS: LogoVariant[] = ["primary", "icon-only", "horizontal"];
  const VALID_VARIANTS: LogoVariant[] = [
    "primary", "icon-only", "horizontal", "stacked", "dark-bg", "light-bg",
  ];
  let variantList: LogoVariant[];
  if (typeof variants === "number" && Number.isFinite(variants) && variants > 0) {
    variantList = DEFAULT_VARIANTS.slice(0, Math.min(variants, DEFAULT_VARIANTS.length));
  } else if (Array.isArray(variants)) {
    variantList = variants.filter((v): v is LogoVariant => VALID_VARIANTS.includes(v));
    if (variantList.length === 0) variantList = DEFAULT_VARIANTS;
  } else {
    variantList = DEFAULT_VARIANTS;
  }

  for (const variant of variantList) {
    // Build the prompt
    const promptParts: string[] = [];

    promptParts.push(`Create a professional ${style} logo for the brand "${brandName}".`);
    if (tagline) promptParts.push(`Tagline: "${tagline}".`);
    promptParts.push(LOGO_STYLE_PROMPTS[style] ?? LOGO_STYLE_PROMPTS["iconic"]);
    promptParts.push(LOGO_VARIANT_INSTRUCTIONS[variant] ?? LOGO_VARIANT_INSTRUCTIONS["primary"]);

    if (industry && INDUSTRY_MOOD_MAP[industry]) {
      promptParts.push(`Industry context: ${INDUSTRY_MOOD_MAP[industry]}`);
    }

    if (mood) {
      promptParts.push(`Mood/feel: ${mood}.`);
    }

    if (brandColors) {
      promptParts.push(`Use these brand colors: ${brandColors}.`);
    }

    promptParts.push(ls.langInstruction);
    promptParts.push(
      "Vector-quality, crisp edges, scalable design, transparent background, professional logo, no watermarks, production-ready."
    );

    const prompt = promptParts.join(" ");

    try {
      const imageResult = await getProvider("image").generate({
        prompt,
        size: "1024x1024",
      });

      const imageData = (imageResult.data as { base64?: string; url?: string }) ?? undefined;
      generatedVariants.push({
        variant,
        imageBase64: imageData?.base64 ?? undefined,
        imageUrl: imageData?.url ?? undefined,
        prompt,
      });
    } catch {
      generatedVariants.push({
        variant,
        prompt,
      });
    }
  }

  return {
    success: generatedVariants.some((v) => v.imageBase64 || v.imageUrl),
    variants: generatedVariants,
    brandName,
    generatedAt: new Date().toISOString(),
  };
}
