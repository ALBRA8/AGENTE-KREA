/**
 * Commercial Product Engine — KREA V2.1
 *
 * Transforms a Product Dossier into a commercial product definition.
 * This is the bridge between the Product Brain (analysis) and the
 * commercial pipeline (blueprint → packaging → offer).
 *
 * CRITICAL RULES:
 * - ALL market data must have an EvidenceTag — never present estimates as VERIFIED
 * - Price ranges based on domain heuristics, NEVER invented benchmarks
 * - Objections generated from target customer analysis
 * - Proof requirements: status starts as MISSING (honest default)
 * - NEVER inflates commercial readiness scores
 * - NEVER invents testimonials, market data, or guaranteed results
 */

import ZAI from "z-ai-web-dev-sdk";
import { z } from "zod";
import { parseStructuredResponse } from "@/lib/structured-output";
import type { EvidenceTag } from "@/lib/product-fit";
import type { ProductArchitecture } from "@/lib/product-architecture";
import type { ProductEconomics, RiskFactor } from "@/lib/product-economics";
import type { ProductDossierData } from "@/lib/product-dossier";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductType =
  | "ebook"
  | "guide"
  | "manual"
  | "workbook"
  | "checklist"
  | "template_pack"
  | "digital_kit"
  | "resource_pack"
  | "specialized_document"
  | "hybrid_content"
  | "software"
  | "saas"
  | "api";

export interface CustomerProfile {
  description: string;
  demographics: string[];
  psychographics: string[];
  painPoints: string[];
  currentSolutions: string[];
}

export interface PriceStrategy {
  model: "one_time" | "subscription" | "freemium" | "pay_what_you_want" | "tiered";
  reasoning: string;
  evidence: EvidenceTag;
}

export interface PriceRange {
  min: number;
  max: number;
  currency: string;
  recommended: number;
  evidence: EvidenceTag; // ALWAYS ESTIMATED or INFERRED for new products
}

export interface ProofRequirement {
  type: "testimonial" | "case_study" | "data" | "demo" | "sample" | "guarantee";
  description: string;
  status: "AVAILABLE" | "MISSING" | "PARTIAL";
}

export interface CommercialReadinessScore {
  overall: number;
  productCompleteness: DimensionScore;
  contentCompleteness: DimensionScore;
  quality: DimensionScore;
  packaging: DimensionScore;
  delivery: DimensionScore;
  differentiation: DimensionScore;
  evidence: DimensionScore;
  commercialClarity: DimensionScore;
}

export interface DimensionScore {
  score: number;
  evidence: EvidenceTag;
  confidence: number;
  warnings: string[];
}

export interface CommercialProduct {
  productId: string;
  productVersion: string;
  productName: string;
  productType: ProductType;
  targetCustomer: CustomerProfile;
  problem: string;
  jobToBeDone: string;
  desiredOutcome: string;
  valueProposition: string;
  differentiation: string;
  format: string;
  includedAssets: string[];
  excludedScope: string[];
  priceStrategy: PriceStrategy;
  priceRange: PriceRange;
  monetizationModel: string;
  distributionStrategy: string;
  positioning: string;
  keyBenefits: string[];
  objections: string[];
  proofRequirements: ProofRequirement[];
  commercialReadiness: CommercialReadinessScore;
  launchRequirements: string[];
  assumptions: string[];
  risks: RiskFactor[];
  evidence: EvidenceTag;
  provenance: string;
}

// ─── Zod Schemas for LLM Response ─────────────────────────────────────────────

const customerProfileSchema = z.object({
  description: z.string().min(10),
  demographics: z.array(z.string()),
  psychographics: z.array(z.string()),
  painPoints: z.array(z.string()),
  currentSolutions: z.array(z.string()),
});

const commercialResponseSchema = z.object({
  jobToBeDone: z.string().min(10),
  desiredOutcome: z.string().min(5),
  valueProposition: z.string().min(10),
  differentiation: z.string().min(5),
  positioning: z.string().min(5),
  keyBenefits: z.array(z.string()).min(1),
  objections: z.array(z.string()),
  targetCustomer: customerProfileSchema,
});

// ─── Price Heuristics by Product Type ─────────────────────────────────────────

/**
 * Conservative price range heuristics by product type.
 * These are ESTIMATED — never presented as verified market data.
 * Based on common digital product pricing patterns, not invented benchmarks.
 */
const PRICE_HEURISTICS: Record<string, { min: number; max: number; model: PriceStrategy["model"] }> = {
  ebook: { min: 9, max: 49, model: "one_time" },
  guide: { min: 7, max: 39, model: "one_time" },
  manual: { min: 19, max: 79, model: "one_time" },
  workbook: { min: 9, max: 39, model: "one_time" },
  checklist: { min: 3, max: 19, model: "one_time" },
  template_pack: { min: 9, max: 49, model: "one_time" },
  digital_kit: { min: 19, max: 99, model: "one_time" },
  resource_pack: { min: 14, max: 69, model: "one_time" },
  specialized_document: { min: 29, max: 149, model: "one_time" },
  hybrid_content: { min: 19, max: 99, model: "tiered" },
  software: { min: 19, max: 199, model: "one_time" },
  saas: { min: 9, max: 99, model: "subscription" },
  api: { min: 9, max: 299, model: "subscription" },
};

/**
 * Distribution strategies by product type.
 */
const DISTRIBUTION_DEFAULTS: Record<string, string> = {
  ebook: "Direct download (PDF/EPUB) via website or marketplace",
  guide: "Direct download (PDF) via website",
  manual: "Direct download (PDF) via website or email delivery",
  workbook: "Direct download (PDF) with fillable fields",
  checklist: "Direct download (PDF) via website",
  template_pack: "Direct download (ZIP) via website",
  digital_kit: "Direct download (ZIP) via website with access instructions",
  resource_pack: "Direct download (ZIP) via website",
  specialized_document: "Direct download (PDF/DOCX) via secure delivery",
  hybrid_content: "Direct download (ZIP) with multiple format access",
  software: "Direct download (installer) or cloud access",
  saas: "Cloud access with account-based delivery",
  api: "API key provisioning with documentation portal",
};

// ─── ZAI Adapter ──────────────────────────────────────────────────────────────

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Create a Commercial Product from a Product Dossier, Architecture, and Economics.
 *
 * Uses ZAI to help define the commercial product (customer profile, value prop,
 * positioning), but ALL market data is tagged INFERRED or ESTIMATED.
 *
 * Price ranges come from domain heuristics — never invented benchmarks.
 * Objections are generated from target customer analysis.
 * Proof requirements start as MISSING (honest default).
 */
export async function createCommercialProduct(
  dossier: ProductDossierData,
  architecture: ProductArchitecture,
  economics: ProductEconomics
): Promise<CommercialProduct> {
  const productId = generateId("cprod");
  const productVersion = "1.0.0";
  const productType = mapProductType(architecture.productType);
  const productName = dossier.title;

  // Get price heuristics for this product type
  const priceHeuristic = PRICE_HEURISTICS[productType] || PRICE_HEURISTICS.ebook;

  // Build the price range from heuristics (ALWAYS ESTIMATED for new products)
  const priceRange: PriceRange = {
    min: priceHeuristic.min,
    max: priceHeuristic.max,
    currency: economics.estimatedCost.currency,
    recommended: Math.round((priceHeuristic.min + priceHeuristic.max) / 2),
    evidence: "ESTIMATED", // NEVER VERIFIED for new product prices
  };

  // Build the price strategy
  const priceStrategy: PriceStrategy = {
    model: priceHeuristic.model,
    reasoning: `Based on ${productType} product type heuristics. Actual pricing should be validated with market research.`,
    evidence: "ESTIMATED",
  };

  // Generate proof requirements (all start as MISSING — honest default)
  const proofRequirements: ProofRequirement[] = generateProofRequirements(productType);

  // Try LLM-assisted commercial definition
  try {
    const zai = await getZAI();
    const prompt = buildCommercialPrompt(dossier, architecture, economics, productType, priceRange);

    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: COMMERCIAL_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content || "";
    const parseResult = parseStructuredResponse(content, commercialResponseSchema);

    if (parseResult.success) {
      const data = parseResult.data;

      const commercialProduct: CommercialProduct = {
        productId,
        productVersion,
        productName,
        productType,
        targetCustomer: data.targetCustomer,
        problem: dossier.opportunity?.problemStatement || dossier.description,
        jobToBeDone: data.jobToBeDone,
        desiredOutcome: data.desiredOutcome,
        valueProposition: data.valueProposition,
        differentiation: data.differentiation,
        format: inferFormat(productType, architecture),
        includedAssets: inferIncludedAssets(productType, architecture),
        excludedScope: inferExcludedScope(productType, architecture),
        priceStrategy,
        priceRange,
        monetizationModel: priceStrategy.model,
        distributionStrategy: DISTRIBUTION_DEFAULTS[productType] || "Direct digital delivery",
        positioning: data.positioning,
        keyBenefits: data.keyBenefits,
        objections: data.objections,
        proofRequirements,
        commercialReadiness: evaluateCommercialReadiness({
          productId,
          productVersion,
          productName,
          productType,
          targetCustomer: data.targetCustomer,
          problem: dossier.opportunity?.problemStatement || dossier.description,
          jobToBeDone: data.jobToBeDone,
          desiredOutcome: data.desiredOutcome,
          valueProposition: data.valueProposition,
          differentiation: data.differentiation,
          format: inferFormat(productType, architecture),
          includedAssets: inferIncludedAssets(productType, architecture),
          excludedScope: inferExcludedScope(productType, architecture),
          priceStrategy,
          priceRange,
          monetizationModel: priceStrategy.model,
          distributionStrategy: DISTRIBUTION_DEFAULTS[productType] || "Direct digital delivery",
          positioning: data.positioning,
          keyBenefits: data.keyBenefits,
          objections: data.objections,
          proofRequirements,
          commercialReadiness: createDefaultReadiness(),
          launchRequirements: [],
          assumptions: [],
          risks: economics.riskFactors,
          evidence: "INFERRED",
          provenance: `commercial-product:${productId}`,
        }),
        launchRequirements: generateLaunchRequirements(productType, proofRequirements),
        assumptions: generateAssumptions(productType, priceRange),
        risks: economics.riskFactors,
        evidence: "INFERRED", // LLM-derived, never VERIFIED
        provenance: `commercial-product:${productId}`,
      };

      return commercialProduct;
    }

    console.error("[CommercialProduct] LLM parse failed:", parseResult.error);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CommercialProduct] LLM error:", message);
  }

  // Fallback: create commercial product from dossier data without LLM
  return createFallbackCommercialProduct(
    productId,
    productVersion,
    productName,
    productType,
    dossier,
    architecture,
    economics,
    priceStrategy,
    priceRange,
    proofRequirements
  );
}

/**
 * Evaluate commercial readiness of a product.
 *
 * Each dimension is scored 0-1 with evidence.
 * Overall = weighted average.
 * Warnings are added when data is insufficient.
 * NEVER inflates scores — honest assessment only.
 */
export function evaluateCommercialReadiness(
  product: CommercialProduct,
  qaReport?: { passed: boolean; issues: string[] },
  assets?: { id: string; type: string; verified: boolean }[]
): CommercialReadinessScore {
  // Product completeness: do we have a well-defined product?
  const productCompleteness = scoreProductCompleteness(product);

  // Content completeness: is content ready?
  const contentCompleteness = scoreContentCompleteness(product, assets);

  // Quality: has QA been done?
  const quality = scoreQuality(qaReport);

  // Packaging: is the product packaged for delivery?
  const packaging = scorePackaging(product);

  // Delivery: can we deliver the product?
  const delivery = scoreDelivery(product);

  // Differentiation: is the product differentiated?
  const differentiation = scoreDifferentiation(product);

  // Evidence: how strong is our evidence?
  const evidence = scoreEvidence(product);

  // Commercial clarity: is the offer clear?
  const commercialClarity = scoreCommercialClarity(product);

  // Weighted average — never inflate
  const weights = {
    productCompleteness: 0.15,
    contentCompleteness: 0.15,
    quality: 0.15,
    packaging: 0.10,
    delivery: 0.10,
    differentiation: 0.10,
    evidence: 0.15,
    commercialClarity: 0.10,
  };

  const overall = Math.min(
    1,
    weights.productCompleteness * productCompleteness.score +
      weights.contentCompleteness * contentCompleteness.score +
      weights.quality * quality.score +
      weights.packaging * packaging.score +
      weights.delivery * delivery.score +
      weights.differentiation * differentiation.score +
      weights.evidence * evidence.score +
      weights.commercialClarity * commercialClarity.score
  );

  return {
    overall: roundScore(overall),
    productCompleteness,
    contentCompleteness,
    quality,
    packaging,
    delivery,
    differentiation,
    evidence,
    commercialClarity,
  };
}

// ─── Dimension Scoring Functions ──────────────────────────────────────────────

function scoreProductCompleteness(product: CommercialProduct): DimensionScore {
  const warnings: string[] = [];
  let score = 0;

  // Check core fields
  if (product.problem && product.problem.length > 10) score += 0.15;
  else warnings.push("Problem statement is missing or too short");

  if (product.jobToBeDone && product.jobToBeDone.length > 10) score += 0.15;
  else warnings.push("Job to be done is missing or too short");

  if (product.valueProposition && product.valueProposition.length > 10) score += 0.2;
  else warnings.push("Value proposition is missing or too short");

  if (product.targetCustomer.description.length > 10) score += 0.15;
  else warnings.push("Target customer is not well defined");

  if (product.keyBenefits.length > 0) score += 0.15;
  else warnings.push("No key benefits defined");

  if (product.format) score += 0.1;
  else warnings.push("Product format not specified");

  if (product.differentiation && product.differentiation.length > 5) score += 0.1;
  else warnings.push("Differentiation is not defined");

  return {
    score: roundScore(score),
    evidence: "INFERRED",
    confidence: score > 0.7 ? 0.8 : score > 0.4 ? 0.5 : 0.2,
    warnings,
  };
}

function scoreContentCompleteness(
  product: CommercialProduct,
  assets?: { id: string; type: string; verified: boolean }[]
): DimensionScore {
  const warnings: string[] = [];

  if (!assets || assets.length === 0) {
    warnings.push("No assets available — content cannot be verified");
    return {
      score: 0.1,
      evidence: "NOT_VERIFIED",
      confidence: 0.1,
      warnings,
    };
  }

  const verifiedAssets = assets.filter((a) => a.verified).length;
  const totalAssets = assets.length;
  const verifiedRatio = totalAssets > 0 ? verifiedAssets / totalAssets : 0;

  if (verifiedRatio < 0.5) {
    warnings.push(`Only ${verifiedAssets}/${totalAssets} assets are verified`);
  }

  return {
    score: roundScore(Math.min(1, verifiedRatio * 1.2)),
    evidence: verifiedRatio > 0.8 ? "VERIFIED" : verifiedRatio > 0.5 ? "INFERRED" : "NOT_VERIFIED",
    confidence: verifiedRatio > 0.8 ? 0.9 : verifiedRatio > 0.5 ? 0.6 : 0.3,
    warnings,
  };
}

function scoreQuality(
  qaReport?: { passed: boolean; issues: string[] }
): DimensionScore {
  const warnings: string[] = [];

  if (!qaReport) {
    warnings.push("No QA report available — quality cannot be verified");
    return {
      score: 0.2,
      evidence: "NOT_VERIFIED",
      confidence: 0.1,
      warnings,
    };
  }

  if (!qaReport.passed) {
    warnings.push(`QA did not pass: ${qaReport.issues.length} issues found`);
    return {
      score: 0.3,
      evidence: "VERIFIED",
      confidence: 0.8,
      warnings,
    };
  }

  if (qaReport.issues.length > 0) {
    warnings.push(`QA passed with ${qaReport.issues.length} minor issues`);
  }

  return {
    score: qaReport.issues.length === 0 ? 0.95 : 0.75,
    evidence: "VERIFIED",
    confidence: 0.9,
    warnings,
  };
}

function scorePackaging(product: CommercialProduct): DimensionScore {
  const warnings: string[] = [];
  let score = 0;

  if (product.format) score += 0.25;
  else warnings.push("Format not specified");

  if (product.distributionStrategy) score += 0.25;
  else warnings.push("Distribution strategy not defined");

  if (product.includedAssets.length > 0) score += 0.25;
  else warnings.push("No included assets defined");

  if (product.priceRange.recommended > 0) score += 0.25;
  else warnings.push("Price not set");

  return {
    score: roundScore(score),
    evidence: "INFERRED",
    confidence: score > 0.7 ? 0.7 : 0.4,
    warnings,
  };
}

function scoreDelivery(product: CommercialProduct): DimensionScore {
  const warnings: string[] = [];
  let score = 0;

  if (product.distributionStrategy) score += 0.4;
  else warnings.push("No distribution strategy");

  if (product.format) score += 0.3;
  else warnings.push("No delivery format specified");

  if (product.priceStrategy.model) score += 0.3;
  else warnings.push("No monetization model");

  return {
    score: roundScore(score),
    evidence: "INFERRED",
    confidence: 0.5,
    warnings,
  };
}

function scoreDifferentiation(product: CommercialProduct): DimensionScore {
  const warnings: string[] = [];

  if (!product.differentiation || product.differentiation.length < 10) {
    warnings.push("Differentiation is weak or undefined");
    return {
      score: 0.2,
      evidence: "NOT_VERIFIED",
      confidence: 0.2,
      warnings,
    };
  }

  // Basic heuristic: longer, more specific differentiation statements score higher
  const lengthScore = Math.min(1, product.differentiation.length / 200);
  const hasSpecifics = product.keyBenefits.length > 2;

  const score = Math.min(1, lengthScore * 0.6 + (hasSpecifics ? 0.4 : 0.1));

  if (!hasSpecifics) {
    warnings.push("Few key benefits — differentiation may not be convincing");
  }

  return {
    score: roundScore(score),
    evidence: "INFERRED",
    confidence: 0.5,
    warnings,
  };
}

function scoreEvidence(product: CommercialProduct): DimensionScore {
  const warnings: string[] = [];

  // Check how much evidence is actually verified
  const overallEvidence = product.evidence;
  const priceEvidence = product.priceRange.evidence;
  const strategyEvidence = product.priceStrategy.evidence;

  // Count proof requirements that are available
  const availableProofs = product.proofRequirements.filter(
    (p) => p.status === "AVAILABLE"
  ).length;
  const totalProofs = product.proofRequirements.length;
  const proofRatio = totalProofs > 0 ? availableProofs / totalProofs : 0;

  let score = 0;

  // Overall evidence quality
  if (overallEvidence === "VERIFIED") score += 0.3;
  else if (overallEvidence === "INFERRED") score += 0.15;
  else warnings.push("Overall product evidence is not verified");

  // Price evidence
  if (priceEvidence === "VERIFIED") score += 0.2;
  else if (priceEvidence === "ESTIMATED" || priceEvidence === "INFERRED") score += 0.1;
  else warnings.push("Price evidence is not established");

  // Strategy evidence
  if (strategyEvidence === "VERIFIED") score += 0.2;
  else if (strategyEvidence === "ESTIMATED" || strategyEvidence === "INFERRED") score += 0.1;
  else warnings.push("Strategy evidence is not established");

  // Proof availability
  score += proofRatio * 0.3;

  if (proofRatio < 0.5) {
    warnings.push(
      `Only ${availableProofs}/${totalProofs} proof requirements are available — most are MISSING`
    );
  }

  return {
    score: roundScore(score),
    evidence: overallEvidence === "VERIFIED" ? "VERIFIED" : "INFERRED",
    confidence: proofRatio > 0.7 ? 0.8 : proofRatio > 0.3 ? 0.5 : 0.2,
    warnings,
  };
}

function scoreCommercialClarity(product: CommercialProduct): DimensionScore {
  const warnings: string[] = [];
  let score = 0;

  if (product.valueProposition.length > 20) score += 0.2;
  else warnings.push("Value proposition is too short to be compelling");

  if (product.positioning.length > 10) score += 0.2;
  else warnings.push("Positioning is missing");

  if (product.objections.length > 0) score += 0.15;
  else warnings.push("No customer objections identified — may indicate incomplete customer analysis");

  if (product.keyBenefits.length >= 3) score += 0.2;
  else if (product.keyBenefits.length > 0) score += 0.1;
  else warnings.push("No key benefits defined");

  if (product.priceRange.recommended > 0) score += 0.15;
  else warnings.push("No recommended price set");

  if (product.targetCustomer.painPoints.length > 0) score += 0.1;
  else warnings.push("No customer pain points identified");

  return {
    score: roundScore(score),
    evidence: "INFERRED",
    confidence: score > 0.7 ? 0.7 : 0.4,
    warnings,
  };
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function generateProofRequirements(productType: ProductType): ProofRequirement[] {
  // Standard proof requirements for any product — all start as MISSING
  const base: ProofRequirement[] = [
    {
      type: "testimonial",
      description: "Customer testimonial verifying the product delivers on its promise",
      status: "MISSING",
    },
    {
      type: "case_study",
      description: "Case study demonstrating real-world application and results",
      status: "MISSING",
    },
    {
      type: "sample",
      description: "Free sample or preview of the product",
      status: "MISSING",
    },
  ];

  // Product-type-specific requirements
  switch (productType) {
    case "software":
    case "saas":
    case "api":
      base.push(
        {
          type: "demo",
          description: "Working demo or trial access",
          status: "MISSING",
        },
        {
          type: "data",
          description: "Performance data or usage metrics",
          status: "MISSING",
        }
      );
      break;
    case "ebook":
    case "guide":
    case "manual":
    case "workbook":
      base.push({
        type: "sample",
        description: "Chapter excerpt or table of contents preview",
        status: "MISSING",
      });
      break;
    default:
      break;
  }

  return base;
}

function generateLaunchRequirements(
  productType: ProductType,
  proofRequirements: ProofRequirement[]
): string[] {
  const requirements: string[] = [];

  // Core launch requirements
  requirements.push("Product content fully complete and QA-approved");
  requirements.push("Delivery mechanism tested and functional");
  requirements.push("Payment processing configured and tested");

  // If proof requirements are mostly MISSING, flag it
  const missingProofs = proofRequirements.filter((p) => p.status === "MISSING").length;
  if (missingProofs > 0) {
    requirements.push(
      `Gather proof elements: ${missingProofs} requirement(s) currently MISSING`
    );
  }

  // Product-type-specific requirements
  if (productType === "saas" || productType === "api") {
    requirements.push("Infrastructure provisioned and load-tested");
    requirements.push("Monitoring and error tracking configured");
  }

  if (productType === "ebook" || productType === "guide") {
    requirements.push("Cover design finalized");
    requirements.push("File format tested on target devices");
  }

  return requirements;
}

function generateAssumptions(productType: ProductType, priceRange: PriceRange): string[] {
  return [
    `Target customers have the problem described — this is INFERRED, not verified`,
    `Price range $${priceRange.min}-$${priceRange.max} is appropriate for this market — ESTIMATED`,
    `Product can be delivered via standard digital distribution — INFERRED`,
    `Target audience can find and access the product — NOT VERIFIED`,
    productType === "saas" || productType === "api"
      ? `Technical infrastructure will support expected usage — ESTIMATED`
      : `Content quality meets professional standards — NOT VERIFIED`,
  ];
}

function mapProductType(archType: string): ProductType {
  const mapping: Record<string, ProductType> = {
    ebook: "ebook",
    guide: "guide",
    software: "software",
    saas: "saas",
    template: "template_pack",
    kit: "digital_kit",
  };
  return mapping[archType] || "hybrid_content";
}

function inferFormat(productType: ProductType, architecture: ProductArchitecture): string {
  // Check if architecture is a BookArchitecture with format
  if ("format" in architecture && typeof architecture.format === "string") {
    return architecture.format;
  }

  const formatMap: Record<string, string> = {
    ebook: "PDF + EPUB",
    guide: "PDF",
    manual: "PDF",
    workbook: "PDF (fillable)",
    checklist: "PDF",
    template_pack: "ZIP (multiple formats)",
    digital_kit: "ZIP (organized files)",
    resource_pack: "ZIP (organized files)",
    specialized_document: "PDF + DOCX",
    hybrid_content: "ZIP (multiple formats)",
    software: "Installer / Cloud",
    saas: "Cloud (Web App)",
    api: "API + Documentation Portal",
  };

  return formatMap[productType] || "Digital delivery";
}

function inferIncludedAssets(productType: ProductType, architecture: ProductArchitecture): string[] {
  const assets: string[] = [];

  // Add architecture components as assets
  for (const component of architecture.components) {
    assets.push(`${component.name} (${component.type})`);
  }

  // Add product-type-specific assets
  switch (productType) {
    case "ebook":
    case "guide":
      assets.push("Main content document", "Table of contents", "Cover page");
      break;
    case "template_pack":
      assets.push("Template files", "Usage instructions", "Example outputs");
      break;
    case "digital_kit":
      assets.push("Kit components", "Assembly guide", "Quick-start instructions");
      break;
    case "software":
    case "saas":
      assets.push("Application", "User documentation", "API documentation");
      break;
    default:
      assets.push("Main deliverable", "Documentation");
      break;
  }

  return assets;
}

function inferExcludedScope(productType: ProductType, architecture: ProductArchitecture): string[] {
  const excluded: string[] = [];

  // Common exclusions
  excluded.push("Ongoing consulting or coaching (not included unless explicitly stated)");
  excluded.push("Custom modifications or personalization services");

  // Type-specific exclusions
  if (productType === "ebook" || productType === "guide") {
    excluded.push("Source files or editable formats");
    excluded.push("Resell or redistribution rights");
  }

  if (productType === "software" || productType === "saas" || productType === "api") {
    excluded.push("Custom development or integration services");
    excluded.push("SLA guarantees (unless separately contracted)");
  }

  return excluded;
}

function createDefaultReadiness(): CommercialReadinessScore {
  const defaultDim: DimensionScore = {
    score: 0,
    evidence: "NOT_VERIFIED",
    confidence: 0,
    warnings: ["Readiness not yet evaluated"],
  };

  return {
    overall: 0,
    productCompleteness: { ...defaultDim },
    contentCompleteness: { ...defaultDim },
    quality: { ...defaultDim },
    packaging: { ...defaultDim },
    delivery: { ...defaultDim },
    differentiation: { ...defaultDim },
    evidence: { ...defaultDim },
    commercialClarity: { ...defaultDim },
  };
}

function createFallbackCommercialProduct(
  productId: string,
  productVersion: string,
  productName: string,
  productType: ProductType,
  dossier: ProductDossierData,
  architecture: ProductArchitecture,
  economics: ProductEconomics,
  priceStrategy: PriceStrategy,
  priceRange: PriceRange,
  proofRequirements: ProofRequirement[]
): CommercialProduct {
  const targetCustomer: CustomerProfile = {
    description: dossier.opportunity?.targetAudience || "Target audience not yet defined",
    demographics: [],
    psychographics: [],
    painPoints: [dossier.opportunity?.problemStatement || "Problem not yet defined"],
    currentSolutions: dossier.opportunity?.existingAlternatives || [],
  };

  const product: CommercialProduct = {
    productId,
    productVersion,
    productName,
    productType,
    targetCustomer,
    problem: dossier.opportunity?.problemStatement || dossier.description,
    jobToBeDone: `Help ${targetCustomer.description} solve: ${dossier.opportunity?.problemStatement || dossier.description}`,
    desiredOutcome: "Desired outcome to be defined with further analysis",
    valueProposition: `${productName} addresses the problem of ${dossier.opportunity?.problemStatement || "undefined"} for ${targetCustomer.description}`,
    differentiation: "Differentiation to be established through market research",
    format: inferFormat(productType, architecture),
    includedAssets: inferIncludedAssets(productType, architecture),
    excludedScope: inferExcludedScope(productType, architecture),
    priceStrategy,
    priceRange,
    monetizationModel: priceStrategy.model,
    distributionStrategy: DISTRIBUTION_DEFAULTS[productType] || "Direct digital delivery",
    positioning: `For ${targetCustomer.description} who need to solve ${dossier.opportunity?.problemStatement || "their problem"}`,
    keyBenefits: ["Benefit definitions require further analysis"],
    objections: ["Customer objections require further analysis"],
    proofRequirements,
    commercialReadiness: createDefaultReadiness(),
    launchRequirements: generateLaunchRequirements(productType, proofRequirements),
    assumptions: generateAssumptions(productType, priceRange),
    risks: economics.riskFactors,
    evidence: "NOT_VERIFIED",
    provenance: `commercial-product:${productId}:fallback`,
  };

  // Now evaluate readiness
  product.commercialReadiness = evaluateCommercialReadiness(product);

  return product;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const COMMERCIAL_SYSTEM_PROMPT = `You are a Commercial Product Strategist for KREA V2.1.
Transform the product dossier and architecture into a commercial product definition.

Return a JSON object with:
- jobToBeDone: string (the job the customer is hiring this product to do)
- desiredOutcome: string (the specific outcome the customer wants)
- valueProposition: string (why this product is the best choice)
- differentiation: string (how this product is different from alternatives)
- positioning: string (market positioning statement)
- keyBenefits: array of strings (3-7 specific benefits)
- objections: array of strings (likely customer objections, 2-5)
- targetCustomer: { description, demographics[], psychographics[], painPoints[], currentSolutions[] }

CRITICAL RULES:
- Do NOT invent market data, statistics, or benchmarks
- Do NOT create fake testimonials or guaranteed results
- Base analysis ONLY on the information provided
- Be CONSERVATIVE — it's better to be honest than impressive
- Objections should be realistic concerns real customers would have
- Price is NOT set here — it comes from heuristics and economics
- Return ONLY valid JSON`;

function buildCommercialPrompt(
  dossier: ProductDossierData,
  architecture: ProductArchitecture,
  economics: ProductEconomics,
  productType: ProductType,
  priceRange: PriceRange
): string {
  const componentsSummary = architecture.components
    .map((c) => `  - ${c.name} (${c.type}): ${c.description}`)
    .join("\n");

  return `Define the commercial product for:

Title: ${dossier.title}
Description: ${dossier.description}
Domain: ${dossier.domain}
Product Type: ${productType}
Problem: ${dossier.opportunity?.problemStatement || "Not yet defined"}
Target Audience: ${dossier.opportunity?.targetAudience || "Not yet defined"}
Existing Alternatives: ${dossier.opportunity?.existingAlternatives?.join(", ") || "None specified"}

Architecture:
${architecture.architecture}
Components:
${componentsSummary}

Economics:
- Estimated Price Range: $${priceRange.min}-$${priceRange.max} (ESTIMATED)
- Estimated Cost: $${economics.estimatedCost.total} ${economics.estimatedCost.currency}
- Risk Factors: ${economics.riskFactors.length}

Provide a complete commercial product definition. Be specific but honest.`;
}

// ─── Utility Functions ────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 10)}`;
}

function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}
