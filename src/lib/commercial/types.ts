/**
 * KREA Commercial Module — Shared Types
 *
 * Tipos compartidos para todas las capacidades comerciales adicionales
 * que KREA absorbe de ecom-magic.ai (solo producción, NO investigación).
 */

import type {
  AdPlatform,
  AdFormat,
  LandingSectionType,
  MockupType,
  CreativeAngle,
  Language,
  ProductInfo,
} from "../commercial-creative-engine";

// Re-export base types for convenience
export type {
  AdPlatform,
  AdFormat,
  LandingSectionType,
  MockupType,
  CreativeAngle,
  Language,
  ProductInfo,
};

// ─── Logo Generation ───────────────────────────────────────────────

export type LogoStyle =
  | "wordmark"      // Text-only, stylized typography
  | "iconic"        // Symbol/icon + text
  | "abstract"      // Abstract shape mark
  | "monogram"      // Single-letter or initials
  | "emblem"        // Badge/seal style
  | "mascot";       // Character-based

export type LogoVariant = "primary" | "icon-only" | "horizontal" | "stacked" | "dark-bg" | "light-bg";

export interface LogoParams {
  brandName: string;
  tagline?: string;
  industry?: string;          // e.g. "beauty", "fitness", "tech", "food"
  style?: LogoStyle;
  brandColors?: string;       // e.g. "#FF6600,#333333"
  mood?: string;              // e.g. "premium", "playful", "minimal", "bold"
  variants?: LogoVariant[];   // which versions to generate
  language?: Language;
}

export interface LogoResult {
  success: boolean;
  variants: Array<{
    variant: LogoVariant;
    imageBase64?: string;
    imageUrl?: string;
    prompt: string;           // the prompt used (for audit/reproducibility)
  }>;
  brandName: string;
  generatedAt: string;
}

// ─── Banner Generation ─────────────────────────────────────────────

export type BannerFormat =
  | "website-hero"     // 1920x600 — website hero banner
  | "website-strip"    // 1920x200 — announcement strip
  | "email-header"     // 600x200 — email header
  | "social-cover"     // 1640x856 — Facebook/LinkedIn cover
  | "youtube-banner"   // 2560x1440 — YouTube channel art
  | "promo-popup"      // 800x600 — promotional popup
  | "sidebar"          // 300x250 — sidebar ad
  | "print-flyer";     // 2480x3508 — A4 print flyer

export interface BannerParams {
  productInfo: ProductInfo;
  bannerFormat: BannerFormat;
  headline?: string;
  subheadline?: string;
  cta?: string;
  styleReference?: string;
  brandColors?: string;
  language?: Language;
}

export interface BannerResult {
  success: boolean;
  imageBase64?: string;
  imageUrl?: string;
  bannerFormat: BannerFormat;
  dimensions: string;
  prompt: string;
  generatedAt: string;
}

// ─── Email Creative ────────────────────────────────────────────────

export type EmailCreativeType =
  | "header"           // Email header image
  | "promo-block"      // Promotional content block
  | "product-showcase" // Product grid showcase
  | "cta-button"       // CTA button as image
  | "footer"           // Branded email footer
  | "newsletter-hero"; // Newsletter hero image

export interface EmailCreativeParams {
  productInfo: ProductInfo;
  creativeType: EmailCreativeType;
  headline?: string;
  bodyCopy?: string;
  cta?: string;
  brandColors?: string;
  language?: Language;
}

export interface EmailCreativeResult {
  success: boolean;
  imageBase64?: string;
  imageUrl?: string;
  creativeType: EmailCreativeType;
  dimensions: string;
  prompt: string;
  generatedAt: string;
}

// ─── Catalog / Flyer ───────────────────────────────────────────────

export type CatalogFormat =
  | "digital-catalog"    // Multi-page digital catalog
  | "single-page-flyer"  // Single page promo flyer
  | "product-sheet"      // Single product data sheet
  | "lookbook"           // Visual lookbook/editorial
  | "price-list";        // Price list with images

export interface CatalogParams {
  products: ProductInfo[];        // Multiple products for catalog
  catalogFormat: CatalogFormat;
  title?: string;
  styleReference?: string;
  brandColors?: string;
  columns?: number;               // Products per row (2, 3, or 4)
  language?: Language;
}

export interface CatalogResult {
  success: boolean;
  imageBase64?: string;
  imageUrl?: string;
  catalogFormat: CatalogFormat;
  productCount: number;
  prompt: string;
  generatedAt: string;
}

// ─── Natural Language Editing ──────────────────────────────────────

export interface NLEditParams {
  /** The original creative image (base64 or URL) */
  originalImage: string;
  /** Natural language description of desired changes */
  editInstruction: string;
  /** Language of the edit instruction */
  language?: Language;
}

export interface NLEditResult {
  success: boolean;
  imageBase64?: string;
  imageUrl?: string;
  editInstruction: string;
  prompt: string;
  generatedAt: string;
}

// ─── Template Gallery ──────────────────────────────────────────────

export type TemplateCategory =
  | "beauty"       | "fitness"     | "fashion"
  | "food"         | "tech"        | "home"
  | "supplements"  | "education"   | "finance"
  | "general";

export type TemplateType = "ad" | "landing" | "mockup" | "logo" | "banner" | "email";

export interface TemplateEntry {
  id: string;
  name: string;
  category: TemplateCategory;
  type: TemplateType;
  platform?: AdPlatform;
  format?: string;
  thumbnailUrl: string;
  description: string;
  tags: string[];
}

// ─── Batch Pipeline ────────────────────────────────────────────────

export type BatchItemType =
  | "ad"
  | "landing"
  | "mockup"
  | "logo"
  | "banner"
  | "email"
  | "catalog";

export interface BatchItem {
  type: BatchItemType;
  params: Record<string, unknown>;  // params for the specific generator
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  items: Array<{
    index: number;
    type: BatchItemType;
    status: "pending" | "running" | "done" | "error";
    result?: unknown;
    error?: string;
  }>;
}

export interface BatchResult {
  success: boolean;
  progress: BatchProgress;
  totalAssets: number;
  generatedAt: string;
}

// ─── Ecommerce Export ──────────────────────────────────────────────

export type EcomPlatform = "shopify" | "woocommerce" | "tiendanube" | "funnelish";

export interface EcomExportParams {
  platform: EcomPlatform;
  productId: string;
  assets: Array<{
    type: string;
    url: string;
    alt?: string;
  }>;
  metadata?: Record<string, string>;
}

export interface EcomExportResult {
  success: boolean;
  platform: EcomPlatform;
  exportedAssets: number;
  exportUrl?: string;    // URL to the exported product on the platform
  errors?: string[];
}

// ─── Product Organization ──────────────────────────────────────────

export interface ProductCreativeFolder {
  productId: string;
  productName: string;
  ads: Array<{ platform: AdPlatform; format: AdFormat; url: string; createdAt: string }>;
  landingSections: Array<{ sectionType: LandingSectionType; url: string; createdAt: string }>;
  mockups: Array<{ mockupType: MockupType; url: string; createdAt: string }>;
  logos: Array<{ variant: LogoVariant; url: string; createdAt: string }>;
  banners: Array<{ format: BannerFormat; url: string; createdAt: string }>;
  emailCreatives: Array<{ type: EmailCreativeType; url: string; createdAt: string }>;
  totalAssets: number;
}
