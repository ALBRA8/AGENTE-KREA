/**
 * KREA Commercial — Catalog / Flyer Generator
 *
 * Genera catálogos digitales, flyers, fichas de producto,
 * lookbooks y listas de precios.
 *
 * Inspirado por ecom-magic.ai: Catalogs & Flyers.
 */

import { getProvider } from "@/contracts/provider-registry";
import type { CatalogParams, CatalogResult, CatalogFormat } from "./types";
import { LANG_STRINGS } from "../commercial-creative-engine";

// ─── Catalog Format Descriptors ────────────────────────────────────

const CATALOG_FORMATS: Record<CatalogFormat, { description: string; layout: string }> = {
  "digital-catalog": {
    description: "Multi-page digital product catalog with cover, product grid pages, and back cover.",
    layout: "Cover page with brand and title, then product grid pages with 4-6 products per page, each with image/name/price/description, and back cover with contact info.",
  },
  "single-page-flyer": {
    description: "Single-page promotional flyer with featured products and offer.",
    layout: "Headline and offer at top, product images in grid layout, key benefits, CTA and contact at bottom, vibrant and attention-grabbing.",
  },
  "product-sheet": {
    description: "Single product data sheet with detailed specs and images.",
    layout: "Product hero image at top, name and key specs, features list with icons, pricing table, and QR code or URL at bottom.",
  },
  lookbook: {
    description: "Visual lookbook with editorial-style product photography.",
    layout: "Magazine-style layout, large product images, minimal text, elegant typography, editorial feel, lifestyle context shots.",
  },
  "price-list": {
    description: "Price list with product images and organized pricing.",
    layout: "Organized table/grid with product thumbnail, name, SKU, price, and any discount. Clean, professional, easy to scan.",
  },
};

// ─── Catalog Generation ────────────────────────────────────────────

export async function generateCatalog(params: CatalogParams): Promise<CatalogResult> {
  const {
    products,
    catalogFormat,
    title,
    styleReference,
    brandColors,
    columns = 3,
    language = "es",
  } = params;

  const ls = LANG_STRINGS[language];
  // Fallback to "digital-catalog" when catalogFormat is invalid/unknown
  const formatInfo = CATALOG_FORMATS[catalogFormat] ?? CATALOG_FORMATS["digital-catalog"];

  const promptParts: string[] = [];

  promptParts.push(`Create a professional ${catalogFormat} (${formatInfo.description}).`);
  promptParts.push(`Layout: ${formatInfo.layout}`);
  promptParts.push(`Products per row: ${columns}.`);

  // Build product list — defensive: name/description may be missing at runtime
  const productNames = products
    .map((p, i) => `${i + 1}. ${p?.name ?? "Producto"} (${p?.description ?? "sin descripción"})${p?.price ? ` — ${p.price}` : ""}`)
    .join("\n");
  promptParts.push(`Products:\n${productNames}`);

  if (title) promptParts.push(`Title: "${title}".`);
  if (styleReference) promptParts.push("Match the visual style of the reference image.");
  if (brandColors) promptParts.push(`Brand colors: ${brandColors}.`);

  promptParts.push(ls.langInstruction);
  promptParts.push(
    "High resolution, professional design, print and digital ready, no watermarks, production-quality."
  );

  const prompt = promptParts.join(" ");

  try {
    // Catalogs are typically wider format
    const size = catalogFormat === "single-page-flyer" || catalogFormat === "product-sheet"
      ? "1024x1024"
      : "1792x1024";

    const imageResult = await getProvider("image").generate({ prompt, size });
    const imageData = (imageResult.data as { base64?: string; url?: string }) ?? undefined;

    // Hallazgo 2.1/2.2: sin imagen NO hay éxito — la ruta debe reembolsar.
    if (!imageResult.success || (!imageData?.base64 && !imageData?.url)) {
      return {
        success: false,
        catalogFormat,
        productCount: products.length,
        prompt,
        generatedAt: new Date().toISOString(),
      };
    }

    return {
      success: true,
      imageBase64: imageData?.base64 ?? undefined,
      imageUrl: imageData?.url ?? undefined,
      catalogFormat,
      productCount: products.length,
      prompt,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      success: false,
      catalogFormat,
      productCount: products.length,
      prompt,
      generatedAt: new Date().toISOString(),
    };
  }
}

export { CATALOG_FORMATS };
