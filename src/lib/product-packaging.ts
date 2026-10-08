/**
 * Product Packaging Engine — KREA V2.1
 *
 * How the product becomes a buyable offer.
 * Takes a CommercialProduct and available assets, and produces
 * a ProductPackaging that defines:
 * - Core product: the main deliverable
 * - Bonuses: supplementary materials that add real value
 * - Versions: only if they add real value (don't invent tiers)
 * - Scope: what's included and excluded
 * - Delivery: how the customer receives the product
 * - Usage: how to get value from the product
 * - Expected outcomes: with honest evidence tags
 *
 * CRITICAL RULES:
 * - Don't invent tiers/versions that don't add real value
 * - Expected outcomes must have honest evidence tags
 * - Disclaimers required when evidence is insufficient
 * - Bonuses must genuinely add value (not filler)
 * - Never present estimated outcomes as guaranteed
 */

import type { EvidenceTag } from "@/lib/product-fit";
import type {
  CommercialProduct,
  ProductType,
} from "@/lib/commercial-product";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoreProduct {
  description: string;
  included: string[];
  format: string;
}

export interface Bonus {
  name: string;
  description: string;
  included: boolean;
  value: string;
}

export interface PackageVersion {
  name: string;
  included: string[];
  price: number;
  currency: string;
}

export interface PackageScope {
  included: string[];
  excluded: string[];
  boundaries: string;
}

export interface DeliveryInfo {
  method: string;
  format: string[];
  access: string;
  requirements: string[];
}

export interface UsageGuide {
  steps: string[];
  prerequisites: string[];
  timeToValue: string;
}

export interface ExpectedOutcome {
  description: string;
  evidence: EvidenceTag;
  disclaimers: string[];
}

export interface ProductPackaging {
  packagingId: string;
  productId: string;
  coreProduct: CoreProduct;
  bonuses: Bonus[];
  versions: PackageVersion[];
  scope: PackageScope;
  delivery: DeliveryInfo;
  usage: UsageGuide;
  expectedOutcome: ExpectedOutcome;
  evidence: EvidenceTag;
}

// ─── Asset Input Type ─────────────────────────────────────────────────────────

export interface AvailableAsset {
  id: string;
  type: string;
  name: string;
  description: string;
  verified: boolean;
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Create Product Packaging from a Commercial Product and available assets.
 *
 * Core product = main deliverable
 * Bonuses = supplementary materials that genuinely add value
 * Versions = only if they add real value (don't invent tiers)
 * Expected outcomes with honest evidence tags
 * Disclaimers when evidence is insufficient
 */
export function createProductPackaging(
  commercialProduct: CommercialProduct,
  assets?: AvailableAsset[]
): ProductPackaging {
  const packagingId = generateId("pkg");

  // Core product definition
  const coreProduct = defineCoreProduct(commercialProduct, assets);

  // Bonuses — only materials that genuinely add value
  const bonuses = defineBonuses(commercialProduct, assets);

  // Versions — only if they represent real value differentiation
  const versions = defineVersions(commercialProduct, assets);

  // Scope — what's included and excluded
  const scope = defineScope(commercialProduct);

  // Delivery — how the customer receives the product
  const delivery = defineDelivery(commercialProduct);

  // Usage guide — how to get value from the product
  const usage = defineUsageGuide(commercialProduct);

  // Expected outcomes — with honest evidence
  const expectedOutcome = defineExpectedOutcome(commercialProduct);

  return {
    packagingId,
    productId: commercialProduct.productId,
    coreProduct,
    bonuses,
    versions,
    scope,
    delivery,
    usage,
    expectedOutcome,
    evidence: commercialProduct.evidence,
  };
}

// ─── Definition Functions ─────────────────────────────────────────────────────

function defineCoreProduct(
  commercialProduct: CommercialProduct,
  assets?: AvailableAsset[]
): CoreProduct {
  const included: string[] = [];

  // Primary deliverable
  included.push(`Main product: ${commercialProduct.productName}`);

  // Core assets from includedAssets
  for (const asset of commercialProduct.includedAssets) {
    included.push(asset);
  }

  // Verified assets that match the product
  if (assets) {
    for (const asset of assets) {
      if (asset.verified && !included.some((i) => i.includes(asset.name))) {
        included.push(`${asset.name} (${asset.type})`);
      }
    }
  }

  return {
    description: `${commercialProduct.productName} — ${commercialProduct.valueProposition}`,
    included,
    format: commercialProduct.format,
  };
}

function defineBonuses(
  commercialProduct: CommercialProduct,
  assets?: AvailableAsset[]
): Bonus[] {
  const bonuses: Bonus[] = [];

  // Only add bonuses that genuinely add value — not filler
  // Check for supplementary assets
  if (assets) {
    const bonusAssets = assets.filter(
      (a) =>
        a.type === "bonus" ||
        a.type === "supplementary" ||
        a.type === "template" ||
        a.type === "checklist" ||
        a.type === "worksheet"
    );

    for (const asset of bonusAssets) {
      bonuses.push({
        name: asset.name,
        description: asset.description,
        included: true,
        value: `Supplementary ${asset.type} to enhance main product`,
      });
    }
  }

  // Product-type-specific genuine bonuses
  switch (commercialProduct.productType) {
    case "ebook":
    case "guide":
      bonuses.push({
        name: "Quick Start Guide",
        description: "Condensed 1-page summary to get immediate value",
        included: true,
        value: "Accelerates time to value by providing immediate actionable steps",
      });
      break;
    case "template_pack":
      bonuses.push({
        name: "Example Outputs",
        description: "Completed examples showing template results",
        included: true,
        value: "Demonstrates expected output quality and reduces learning curve",
      });
      break;
    case "software":
    case "saas":
      bonuses.push({
        name: "Setup Guide",
        description: "Step-by-step setup and configuration instructions",
        included: true,
        value: "Reduces onboarding time and support requests",
      });
      break;
    default:
      break;
  }

  // Only add bonus for proof elements if they're actually available
  const availableProofs = commercialProduct.proofRequirements.filter(
    (p) => p.status === "AVAILABLE"
  );
  if (availableProofs.length > 0) {
    bonuses.push({
      name: "Social Proof Materials",
      description: `${availableProofs.length} proof element(s): ${availableProofs.map((p) => p.type).join(", ")}`,
      included: true,
      value: "Builds credibility and reduces purchase hesitation",
    });
  }

  return bonuses;
}

function defineVersions(
  commercialProduct: CommercialProduct,
  assets?: AvailableAsset[]
): PackageVersion[] {
  const versions: PackageVersion[] = [];

  // Always have a standard version
  versions.push({
    name: "Standard",
    included: commercialProduct.includedAssets,
    price: commercialProduct.priceRange.recommended,
    currency: commercialProduct.priceRange.currency,
  });

  // Only add a premium version if it genuinely adds more value
  // This requires real additional content or features — not just a price tier
  const hasBonusContent = assets && assets.some((a) => a.type === "premium" || a.type === "advanced");
  const hasMultipleFormats = commercialProduct.format.includes("+");

  if (hasBonusContent || hasMultipleFormats) {
    const premiumIncluded = [...commercialProduct.includedAssets];

    if (hasMultipleFormats) {
      premiumIncluded.push("All format variants");
    }

    if (hasBonusContent && assets) {
      for (const asset of assets.filter((a) => a.type === "premium" || a.type === "advanced")) {
        premiumIncluded.push(asset.name);
      }
    }

    // Premium price: typically 1.5-2x standard
    const premiumPrice = Math.round(
      commercialProduct.priceRange.recommended * 1.75
    );

    // Only add if it's within the price range or slightly above
    if (premiumPrice <= commercialProduct.priceRange.max * 1.5) {
      versions.push({
        name: "Premium",
        included: premiumIncluded,
        price: premiumPrice,
        currency: commercialProduct.priceRange.currency,
      });
    }
  }

  // For subscription products, add a basic tier if it makes sense
  if (
    commercialProduct.monetizationModel === "subscription" &&
    commercialProduct.priceRange.min < commercialProduct.priceRange.recommended
  ) {
    // Basic tier — limited features, lower price
    versions.unshift({
      name: "Basic",
      included: commercialProduct.includedAssets.slice(0, Math.ceil(commercialProduct.includedAssets.length / 2)),
      price: commercialProduct.priceRange.min,
      currency: commercialProduct.priceRange.currency,
    });
  }

  return versions;
}

function defineScope(commercialProduct: CommercialProduct): PackageScope {
  return {
    included: commercialProduct.includedAssets,
    excluded: commercialProduct.excludedScope,
    boundaries: [
      `Product scope: ${commercialProduct.productName} as ${commercialProduct.productType}`,
      `Personal use license unless otherwise stated`,
      commercialProduct.excludedScope.length > 0
        ? `Excludes: ${commercialProduct.excludedScope.slice(0, 3).join("; ")}`
        : "Standard product scope",
    ].join(". "),
  };
}

function defineDelivery(commercialProduct: CommercialProduct): DeliveryInfo {
  const formats: string[] = [];
  const requirements: string[] = [];

  // Parse format into individual formats
  const formatParts = commercialProduct.format
    .split(/[+,/]/)
    .map((f) => f.trim())
    .filter(Boolean);

  formats.push(...formatParts);

  // Delivery method and access based on product type
  let method: string;
  let access: string;

  switch (commercialProduct.productType) {
    case "ebook":
    case "guide":
    case "manual":
    case "workbook":
    case "checklist":
      method = "Direct download after purchase";
      access = "Immediate access via download link after payment";
      requirements.push("PDF reader software");
      if (formats.includes("EPUB")) {
        requirements.push("E-reader device or app for EPUB");
      }
      break;
    case "template_pack":
    case "digital_kit":
    case "resource_pack":
      method = "Direct download (ZIP archive) after purchase";
      access = "Immediate access via download link after payment";
      requirements.push("Software to extract ZIP files");
      requirements.push("Relevant application for template files");
      break;
    case "software":
      method = "Download installer or cloud access";
      access = "Account-based access with license key";
      requirements.push("Compatible operating system");
      requirements.push("Internet connection for activation");
      break;
    case "saas":
      method = "Cloud-based access";
      access = "Account-based access via web browser";
      requirements.push("Modern web browser");
      requirements.push("Internet connection");
      break;
    case "api":
      method = "API key provisioning";
      access = "API key and documentation portal access";
      requirements.push("API key management");
      requirements.push("Development environment for integration");
      break;
    default:
      method = "Direct digital delivery";
      access = "Access instructions provided after purchase";
      break;
  }

  return {
    method,
    format: formats,
    access,
    requirements,
  };
}

function defineUsageGuide(commercialProduct: CommercialProduct): UsageGuide {
  const steps: string[] = [];
  const prerequisites: string[] = [];

  // Generic usage steps based on product type
  switch (commercialProduct.productType) {
    case "ebook":
    case "guide":
    case "manual":
      steps.push("Download the document");
      steps.push("Review the table of contents for structure");
      steps.push("Read the introduction for context");
      steps.push("Follow chapters in order for structured learning");
      steps.push("Apply key takeaways to your situation");
      steps.push("Reference specific sections as needed");
      break;
    case "workbook":
    case "checklist":
      steps.push("Download the document");
      steps.push("Review the structure and instructions");
      steps.push("Complete exercises or checklists in order");
      steps.push("Review completed work against provided examples");
      break;
    case "template_pack":
      steps.push("Download and extract the template files");
      steps.push("Review the included documentation");
      steps.push("Select the appropriate template for your needs");
      steps.push("Customize the template with your content");
      steps.push("Test the output with a sample case");
      break;
    case "software":
    case "saas":
      steps.push("Set up your account or install the software");
      steps.push("Complete the initial configuration");
      steps.push("Follow the getting started guide");
      steps.push("Configure for your specific use case");
      steps.push("Test with sample data or workflow");
      break;
    case "api":
      steps.push("Obtain your API key");
      steps.push("Review the API documentation");
      steps.push("Test endpoints with the provided examples");
      steps.push("Integrate into your application");
      steps.push("Monitor usage and error rates");
      break;
    default:
      steps.push("Access the product deliverable");
      steps.push("Review included documentation");
      steps.push("Follow the provided instructions");
      break;
  }

  // Prerequisites from target customer pain points
  prerequisites.push("Problem or need matching the product's purpose");
  if (commercialProduct.targetCustomer.painPoints.length > 0) {
    prerequisites.push(
      `Experience with: ${commercialProduct.targetCustomer.currentSolutions.join(", ") || "related domain"}`
    );
  }

  // Time to value estimate (conservative)
  let timeToValue: string;
  switch (commercialProduct.productType) {
    case "checklist":
      timeToValue = "Immediate (under 5 minutes)";
      break;
    case "template_pack":
      timeToValue = "15-30 minutes (template setup and first use)";
      break;
    case "ebook":
    case "guide":
      timeToValue = "30-60 minutes (first chapter review and application)";
      break;
    case "workbook":
      timeToValue = "1-2 hours (first exercise completion)";
      break;
    case "software":
    case "saas":
    case "api":
      timeToValue = "1-4 hours (setup and first integration)";
      break;
    default:
      timeToValue = "Varies by use case";
      break;
  }

  return {
    steps,
    prerequisites,
    timeToValue,
  };
}

function defineExpectedOutcome(
  commercialProduct: CommercialProduct
): ExpectedOutcome {
  const disclaimers: string[] = [];

  // Base outcome from commercial product
  const description = commercialProduct.desiredOutcome || commercialProduct.valueProposition;

  // Evidence tag — if we have no proof, be honest
  const availableProofs = commercialProduct.proofRequirements.filter(
    (p) => p.status === "AVAILABLE"
  ).length;
  const totalProofs = commercialProduct.proofRequirements.length;

  let evidence: EvidenceTag;
  if (availableProofs === 0) {
    evidence = "NOT_VERIFIED";
    disclaimers.push(
      "No proof elements are currently available — outcomes are projected, not demonstrated"
    );
  } else if (availableProofs < totalProofs) {
    evidence = "INFERRED";
    disclaimers.push(
      `Only ${availableProofs} of ${totalProofs} proof requirements are available — outcomes are partially supported`
    );
  } else {
    evidence = "INFERRED"; // Even with all proofs, outcome is still inferred
    disclaimers.push(
      "Outcomes are supported by available evidence but individual results may vary"
    );
  }

  // Always add standard disclaimers
  disclaimers.push("Results depend on individual application and circumstances");
  disclaimers.push("No guaranteed outcomes — this is a tool, not a guaranteed result");

  // If price evidence is estimated, note it
  if (commercialProduct.priceRange.evidence === "ESTIMATED") {
    disclaimers.push(
      "Price is estimated based on product type heuristics — not verified market data"
    );
  }

  return {
    description,
    evidence,
    disclaimers,
  };
}

// ─── Utility Functions ────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 10)}`;
}
