/**
 * KREA Commercial — Batch Pipeline
 *
 * Genera múltiples creativos en paralelo con seguimiento
 * de progreso. Ideal para paquetes de lanzamiento completos.
 *
 * Inspirado por ecom-magic.ai: One-click multi-creative generation.
 */

import type {
  BatchItem,
  BatchProgress,
  BatchResult,
  BatchItemType,
} from "./types";
import { CommercialCreativeEngine } from "../commercial-creative-engine";
import { generateLogo } from "./logo-generator";
import { generateBanner } from "./banner-generator";
import { generateEmailCreative } from "./email-creative";
import { generateCatalog } from "./catalog-generator";

// ─── Batch Execution ────────────────────────────────────────────────

/**
 * Execute a batch of creative generation jobs in parallel (with concurrency limit).
 *
 * @param items - Array of batch items to generate
 * @param concurrency - Max parallel jobs (default: 3 to avoid rate limits)
 */
export async function executeBatch(
  items: BatchItem[],
  concurrency: number = 3
): Promise<BatchResult> {
  const progress: BatchProgress = {
    total: items.length,
    completed: 0,
    failed: 0,
    items: items.map((item, index) => ({
      index,
      type: item.type,
      status: "pending" as const,
    })),
  };

  // Process in chunks of `concurrency`
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (item, chunkIndex) => {
      const globalIndex = i + chunkIndex;
      progress.items[globalIndex].status = "running";

      try {
        const result = await executeSingleItem(item.type, item.params);
        // Honest status: a generator that returned success:false is a FAILED
        // item even if it didn't throw (smoke evidence P2 — a 200 with a
        // success:false payload must not be counted as done).
        const innerFailed =
          !!result &&
          typeof result === "object" &&
          (result as { success?: boolean }).success === false;
        if (innerFailed) {
          progress.items[globalIndex].status = "error";
          progress.items[globalIndex].error = "generation returned success:false";
          progress.items[globalIndex].result = result;
          progress.failed++;
        } else {
          progress.items[globalIndex].status = "done";
          progress.items[globalIndex].result = result;
          progress.completed++;
        }
      } catch (e: unknown) {
        progress.items[globalIndex].status = "error";
        progress.items[globalIndex].error = e instanceof Error ? e.message : "Unknown error";
        progress.failed++;
      }
    });

    await Promise.all(chunkPromises);
  }

  const successfulAssets = progress.items.filter((i) => i.status === "done").length;

  return {
    success: progress.failed === 0,
    progress,
    totalAssets: successfulAssets,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Single Item Dispatcher ────────────────────────────────────────

async function executeSingleItem(
  type: BatchItemType,
  params: Record<string, unknown>
): Promise<unknown> {
  const engine = CommercialCreativeEngine.getInstance();

  switch (type) {
    case "ad":
      return engine.generateAd(params as any);

    case "landing":
      return engine.generateLandingSection(params as any);

    case "mockup":
      return engine.generateMockup(params as any);

    case "logo":
      return generateLogo(params as any);

    case "banner":
      return generateBanner(params as any);

    case "email":
      return generateEmailCreative(params as any);

    case "catalog":
      return generateCatalog(params as any);

    default:
      throw new Error(`Unknown batch item type: ${type}`);
  }
}

// ─── Batch Builder Helpers ─────────────────────────────────────────

/**
 * Build a standard launch batch for a product:
 * - 1 ad per platform per format
 * - 1 of each landing section type
 * - 1 of each mockup type
 * - Logo + banner
 */
export function buildLaunchBatch(params: {
  productInfo: Record<string, unknown>;
  platforms: string[];
  sections: string[];
  mockupTypes: string[];
  adFormats: string[];
}): BatchItem[] {
  const items: BatchItem[] = [];

  // Ads for each platform × format combination
  for (const platform of params.platforms) {
    for (const format of params.adFormats) {
      items.push({
        type: "ad",
        params: {
          ...params.productInfo,
          productInfo: params.productInfo,
          platform,
          adFormat: format,
        },
      });
    }
  }

  // Landing sections
  for (const section of params.sections) {
    items.push({
      type: "landing",
      params: {
        ...params.productInfo,
        productInfo: params.productInfo,
        sectionType: section,
      },
    });
  }

  // Mockups
  for (const mockupType of params.mockupTypes) {
    items.push({
      type: "mockup",
      params: {
        ...params.productInfo,
        productInfo: params.productInfo,
        mockupType,
      },
    });
  }

  // Logo
  items.push({
    type: "logo",
    params: {
      brandName: (params.productInfo as any).name || "Brand",
      industry: (params.productInfo as any).category,
    },
  });

  // Banner
  items.push({
    type: "banner",
    params: {
      ...params.productInfo,
      productInfo: params.productInfo,
      bannerFormat: "website-hero",
    },
  });

  return items;
}
