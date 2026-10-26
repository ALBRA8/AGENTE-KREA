/**
 * KREA Commercial Module — Unified Barrel Export
 *
 * Punto de entrada único para todas las capacidades
 * comerciales de KREA (AGENTE-KREA).
 *
 * Uso:
 *   import { KreaAdapter, generateLogo, ... } from "@/lib/commercial";
 */

// ─── Types ──────────────────────────────────────────────────────────
export type {
  LogoStyle,
  LogoVariant,
  LogoParams,
  LogoResult,
  BannerFormat,
  BannerParams,
  BannerResult,
  EmailCreativeType,
  EmailCreativeParams,
  EmailCreativeResult,
  CatalogFormat,
  CatalogParams,
  CatalogResult,
  NLEditParams,
  NLEditResult,
  TemplateCategory,
  TemplateType,
  TemplateEntry,
  BatchItemType,
  BatchItem,
  BatchProgress,
  BatchResult,
  EcomPlatform,
  EcomExportParams,
  EcomExportResult,
  ProductCreativeFolder,
  AdPlatform,
  AdFormat,
  LandingSectionType,
  MockupType,
  CreativeAngle,
  Language,
  ProductInfo,
} from "./types";

// ─── AGENTE-KREA ────────────────────────────────────────────────────
export {
  KreaAdapter,
  KREA_AGENT_IDENTITY,
  getKreaAdapter,
  resetKreaAdapter,
} from "./krea-agent";
export type { AgentAdapter as AgentAdapterType } from "../agent-adapter";

// ─── Generators ─────────────────────────────────────────────────────
export { generateLogo } from "./logo-generator";
export { generateBanner, BANNER_DIMENSIONS } from "./banner-generator";
export { generateEmailCreative, EMAIL_LAYOUTS } from "./email-creative";
export { generateCatalog, CATALOG_FORMATS } from "./catalog-generator";
export { editCreativeWithNL } from "./nl-editor";
export {
  getTemplateGallery,
  getTemplatesByCategory,
  getTemplatesByType,
  getTemplatesByPlatform as getTemplatesByPlatformFn,
  getTemplateById,
  searchTemplates,
  getTemplatePromptModifier,
} from "./template-gallery";
export { executeBatch, buildLaunchBatch } from "./batch-pipeline";
export {
  exportToEcom,
  getPlatformInfo,
  getSupportedPlatforms,
} from "./ecom-export";
