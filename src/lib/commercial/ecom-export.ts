/**
 * KREA Commercial — Ecommerce Platform Export
 *
 * Exporta creativos generados a plataformas de e-commerce:
 * Shopify, WooCommerce, TiendaNube, Funnelish.
 *
 * Inspirado por ecom-magic.ai: Integración con tiendas online.
 */

import type { EcomPlatform, EcomExportParams, EcomExportResult } from "./types";

// ─── Platform Config ────────────────────────────────────────────────

interface PlatformConfig {
  name: string;
  maxImageSize: number;   // in bytes
  acceptedFormats: string[];
  productImageEndpoint: string;
}

const PLATFORM_CONFIGS: Record<EcomPlatform, PlatformConfig> = {
  shopify: {
    name: "Shopify",
    maxImageSize: 20 * 1024 * 1024,  // 20MB
    acceptedFormats: ["jpg", "jpeg", "png", "gif", "webp"],
    productImageEndpoint: "/admin/api/2024-01/products/{id}/images.json",
  },
  woocommerce: {
    name: "WooCommerce",
    maxImageSize: 10 * 1024 * 1024,  // 10MB
    acceptedFormats: ["jpg", "jpeg", "png", "gif", "webp"],
    productImageEndpoint: "/wp-json/wc/v3/products/{id}/images",
  },
  tiendanube: {
    name: "TiendaNube",
    maxImageSize: 10 * 1024 * 1024,
    acceptedFormats: ["jpg", "jpeg", "png", "gif"],
    productImageEndpoint: "/api/v1/products/{id}/images",
  },
  funnelish: {
    name: "Funnelish",
    maxImageSize: 5 * 1024 * 1024,
    acceptedFormats: ["jpg", "jpeg", "png", "webp"],
    productImageEndpoint: "/api/v1/products/{id}/images",
  },
};

// ─── Export Validation ──────────────────────────────────────────────

function validateExport(params: EcomExportParams): string[] {
  const errors: string[] = [];
  const config = PLATFORM_CONFIGS[params.platform];

  if (!config) {
    errors.push(`Unsupported platform: ${params.platform}`);
    return errors;
  }

  if (!params.productId) {
    errors.push("Missing productId");
  }

  if (!params.assets || params.assets.length === 0) {
    errors.push("No assets to export");
  }

  for (const asset of params.assets) {
    if (!asset.url) {
      errors.push(`Asset missing URL: ${asset.type}`);
    }
  }

  return errors;
}

// ─── Ecommerce Export ───────────────────────────────────────────────

/**
 * Export creative assets to an ecommerce platform.
 *
 * This prepares the export payload and returns instructions
 * for completing the upload. In production, this would use
 * the platform's API with OAuth credentials.
 */
export async function exportToEcom(params: EcomExportParams): Promise<EcomExportResult> {
  const validationErrors = validateExport(params);
  if (validationErrors.length > 0) {
    return {
      success: false,
      platform: params.platform,
      exportedAssets: 0,
      errors: validationErrors,
    };
  }

  const config = PLATFORM_CONFIGS[params.platform];

  // Build the export payload for the target platform
  const exportPayload = buildPlatformPayload(params.platform, params);

  // In a real implementation, this would make API calls with OAuth tokens
  // For now, we return the prepared payload and a mock success
  const exportUrl = `${config.productImageEndpoint.replace("{id}", params.productId)}?prepared=true`;

  return {
    success: true,
    platform: params.platform,
    exportedAssets: params.assets.length,
    exportUrl,
  };
}

// ─── Platform-Specific Payload Builders ─────────────────────────────

function buildPlatformPayload(platform: EcomPlatform, params: EcomExportParams): Record<string, unknown> {
  switch (platform) {
    case "shopify":
      return {
        product_id: params.productId,
        images: params.assets.map((asset, i) => ({
          src: asset.url,
          alt: asset.alt || `Product image ${i + 1}`,
          position: i + 1,
        })),
        metafields: Object.entries(params.metadata || {}).map(([key, value]) => ({
          namespace: "krea",
          key,
          value,
          type: "single_line_text_field",
        })),
      };

    case "woocommerce":
      return {
        product_id: params.productId,
        images: params.assets.map((asset, i) => ({
          src: asset.url,
          alt: asset.alt || `Product image ${i + 1}`,
          position: i + 1,
        })),
        meta_data: Object.entries(params.metadata || {}).map(([key, value]) => ({
          key: `krea_${key}`,
          value,
        })),
      };

    case "tiendanube":
      return {
        product_id: params.productId,
        images: params.assets.map((asset) => ({
          src: asset.url,
          alt: asset.alt || "",
        })),
      };

    case "funnelish":
      return {
        productId: params.productId,
        assets: params.assets.map((asset) => ({
          url: asset.url,
          type: asset.type,
          alt: asset.alt || "",
        })),
        metadata: params.metadata || {},
      };
  }
}

// ─── Platform Info ──────────────────────────────────────────────────

export function getPlatformInfo(platform: EcomPlatform): PlatformConfig {
  return PLATFORM_CONFIGS[platform];
}

export function getSupportedPlatforms(): Array<{ id: EcomPlatform; name: string }> {
  return Object.entries(PLATFORM_CONFIGS).map(([id, config]) => ({
    id: id as EcomPlatform,
    name: config.name,
  }));
}
