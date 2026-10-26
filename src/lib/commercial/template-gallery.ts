/**
 * KREA Commercial — Template Gallery
 *
 * Sistema de galería de plantillas organizadas por categoría,
 * tipo y plataforma. Provee referencias visuales para acelerar
 * la generación de creativos.
 *
 * Inspirado por ecom-magic.ai: Reference ad template system
 * (elige estilo de galería o sube tu propia referencia).
 */

import type {
  TemplateEntry,
  TemplateCategory,
  TemplateType,
  AdPlatform,
} from "./types";

// ─── Built-in Template Gallery ─────────────────────────────────────

/**
 * These are prompt-based templates that guide AI generation.
 * Each template encodes a visual style + composition strategy
 * that produces consistent, high-quality results.
 */
const BUILTIN_TEMPLATES: TemplateEntry[] = [
  // ─── Beauty ────────────────────────────
  {
    id: "beauty-ad-clean",
    name: "Clean Beauty Ad",
    category: "beauty",
    type: "ad",
    platform: "meta",
    format: "feed",
    thumbnailUrl: "",
    description: "Clean pastel background, product centered, minimal text, premium feel",
    tags: ["clean", "pastel", "premium", "skincare", "beauty"],
  },
  {
    id: "beauty-ad-before-after",
    name: "Before/After Beauty",
    category: "beauty",
    type: "ad",
    platform: "meta",
    format: "carousel",
    thumbnailUrl: "",
    description: "Split before/after with results headline, trust-building",
    tags: ["before-after", "results", "transformation", "skincare"],
  },
  {
    id: "beauty-landing-hero",
    name: "Beauty Hero Glow",
    category: "beauty",
    type: "landing",
    format: "hero",
    thumbnailUrl: "",
    description: "Glowing product with soft lighting, elegant headline, premium gradient bg",
    tags: ["glow", "elegant", "hero", "premium"],
  },

  // ─── Fitness ───────────────────────────
  {
    id: "fitness-ad-bold",
    name: "Bold Fitness Ad",
    category: "fitness",
    type: "ad",
    platform: "meta",
    format: "feed",
    thumbnailUrl: "",
    description: "Dark bg, bold yellow/red accent, strong typography, athlete product shot",
    tags: ["bold", "dark", "energetic", "supplement", "gym"],
  },
  {
    id: "fitness-ad-transformation",
    name: "Transformation Story",
    category: "fitness",
    type: "ad",
    platform: "tiktok",
    format: "story",
    thumbnailUrl: "",
    description: "Full-screen vertical, transformation narrative, UGC feel, swipe CTA",
    tags: ["transformation", "vertical", "tiktok", "story"],
  },

  // ─── Food ──────────────────────────────
  {
    id: "food-ad-appetizing",
    name: "Appetizing Food Shot",
    category: "food",
    type: "ad",
    platform: "meta",
    format: "feed",
    thumbnailUrl: "",
    description: "Close-up food photography, steam/motion, warm lighting, irresistible",
    tags: ["appetizing", "close-up", "warm", "food", "restaurant"],
  },
  {
    id: "food-landing-offer",
    name: "Food Special Offer",
    category: "food",
    type: "landing",
    format: "offer",
    thumbnailUrl: "",
    description: "Discount badge, crossed old price, urgency timer, food hero shot",
    tags: ["offer", "discount", "urgency", "delivery"],
  },

  // ─── Tech ──────────────────────────────
  {
    id: "tech-ad-minimal",
    name: "Minimal Tech Ad",
    category: "tech",
    type: "ad",
    platform: "google",
    format: "banner",
    thumbnailUrl: "",
    description: "Clean white bg, product floating, minimal text, Google-compliant",
    tags: ["minimal", "clean", "white", "google", "gadget"],
  },
  {
    id: "tech-ad-gradient",
    name: "Gradient Tech Ad",
    category: "tech",
    type: "ad",
    platform: "meta",
    format: "feed",
    thumbnailUrl: "",
    description: "Vibrant gradient bg, 3D product render, futuristic feel, tech headline",
    tags: ["gradient", "3d", "futuristic", "tech", "software"],
  },

  // ─── Fashion ───────────────────────────
  {
    id: "fashion-ad-editorial",
    name: "Editorial Fashion",
    category: "fashion",
    type: "ad",
    platform: "meta",
    format: "feed",
    thumbnailUrl: "",
    description: "Magazine-style layout, model + product, editorial typography, luxury",
    tags: ["editorial", "luxury", "model", "magazine"],
  },
  {
    id: "fashion-mockup-tshirt",
    name: "T-Shirt Mockup",
    category: "fashion",
    type: "mockup",
    format: "tshirt",
    thumbnailUrl: "",
    description: "Premium t-shirt on model, urban backdrop, lifestyle context",
    tags: ["tshirt", "apparel", "model", "lifestyle"],
  },

  // ─── Supplements ───────────────────────
  {
    id: "supp-ad-trust",
    name: "Trust-Based Supplement",
    category: "supplements",
    type: "ad",
    platform: "meta",
    format: "feed",
    thumbnailUrl: "",
    description: "Clinical look, certification badges, doctor endorsement, clean bg",
    tags: ["trust", "clinical", "certified", "health", "supplement"],
  },

  // ─── General ───────────────────────────
  {
    id: "general-ad-benefit",
    name: "Benefit-Driven Ad",
    category: "general",
    type: "ad",
    platform: "meta",
    format: "feed",
    thumbnailUrl: "",
    description: "Benefit headline top, product center, CTA bottom, clean e-commerce style",
    tags: ["benefit", "clean", "versatile", "ecommerce"],
  },
  {
    id: "general-ad-ugc",
    name: "UGC-Style Ad",
    category: "general",
    type: "ad",
    platform: "tiktok",
    format: "feed",
    thumbnailUrl: "",
    description: "User-generated content feel, phone-in-hand, casual text overlay, native",
    tags: ["ugc", "native", "tiktok", "casual", "authentic"],
  },
  {
    id: "general-landing-faq",
    name: "FAQ Section",
    category: "general",
    type: "landing",
    format: "faq",
    thumbnailUrl: "",
    description: "Accordion FAQ, clean Q&A layout, trust-building, objection handling",
    tags: ["faq", "trust", "objection", "clean"],
  },
  {
    id: "general-logo-iconic",
    name: "Iconic Logo",
    category: "general",
    type: "logo",
    thumbnailUrl: "",
    description: "Icon + wordmark, versatile, works at all sizes, professional",
    tags: ["iconic", "versatile", "professional", "brand"],
  },
  {
    id: "general-banner-hero",
    name: "Website Hero Banner",
    category: "general",
    type: "banner",
    format: "website-hero",
    thumbnailUrl: "",
    description: "Full-width hero, gradient bg, product floating, headline + CTA",
    tags: ["hero", "website", "gradient", "banner"],
  },
];

// ─── Gallery API ───────────────────────────────────────────────────

export function getTemplateGallery(): TemplateEntry[] {
  return [...BUILTIN_TEMPLATES];
}

export function getTemplatesByCategory(category: TemplateCategory): TemplateEntry[] {
  return BUILTIN_TEMPLATES.filter((t) => t.category === category);
}

export function getTemplatesByType(type: TemplateType): TemplateEntry[] {
  return BUILTIN_TEMPLATES.filter((t) => t.type === type);
}

export function getTemplatesByPlatform(platform: AdPlatform): TemplateEntry[] {
  return BUILTIN_TEMPLATES.filter((t) => t.platform === platform);
}

export function getTemplateById(id: string): TemplateEntry | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}

export function searchTemplates(query: string): TemplateEntry[] {
  const lower = query.toLowerCase();
  return BUILTIN_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lower) ||
      t.description.toLowerCase().includes(lower) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lower))
  );
}

/**
 * Get the prompt modifier for a template.
 * Returns a string that can be appended to any generation prompt
 * to apply this template's visual style.
 */
export function getTemplatePromptModifier(templateId: string): string {
  const template = getTemplateById(templateId);
  if (!template) return "";
  return `Use the "${template.name}" style: ${template.description}.`;
}
