/**
 * Launch Package — KREA V2.1
 *
 * Assembles everything needed to launch a product commercially.
 * Generates FAQ, objection responses, proof requirements, and integrity checks.
 *
 * CRITICAL RULES:
 *   - Integrity check must catch ALL dishonest patterns:
 *     - Fake testimonials
 *     - Guaranteed results
 *     - Invented statistics
 *     - False authority claims
 *     - False scarcity
 *   - If proof is missing: proofStatus = MISSING
 *   - Disclaimers added when evidence is insufficient
 *   - All evidence tags must be honest
 *   - Use crypto.randomUUID() for IDs
 */

import { randomUUID } from "crypto";
import type { EvidenceTag } from "@/lib/product-fit";
import type { ProductQAReport, CommercialProduct, Packaging } from "@/lib/product-qa";
import type { CommercialReadiness, ReadinessState } from "@/lib/commercial-readiness";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LaunchPackage {
  packageId: string;
  productId: string;
  version: string;
  product: LaunchProductInfo;
  offer: OfferInfo;
  positioning: string;
  targetCustomer: CustomerInfo;
  corePromise: string;
  benefits: string[];
  included: string[];
  bonuses: string[];
  price: PriceInfo;
  delivery: DeliveryInfo;
  faq: FAQItem[];
  objections: ObjectionResponse[];
  cta: string;
  assets: AssetInfo[];
  proofRequirements: ProofStatus[];
  disclaimers: string[];
  integrityCheck: IntegrityCheck;
  evidence: EvidenceTag;
  generatedAt: Date;
}

export interface LaunchProductInfo {
  name: string;
  type: string;
  description: string;
  version: string;
}

export interface OfferInfo {
  problem: string;
  promise: string;
  mechanism: string;
}

export interface CustomerInfo {
  description: string;
  painPoints: string[];
}

export interface PriceInfo {
  amount: number;
  currency: string;
  model: string;
}

export interface DeliveryInfo {
  method: string;
  format: string[];
  access: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ObjectionResponse {
  objection: string;
  response: string;
  evidence: EvidenceTag;
}

export interface AssetInfo {
  filename: string;
  type: string;
  size: number;
}

export interface ProofStatus {
  type: string;
  status: "AVAILABLE" | "MISSING" | "PARTIAL";
  description: string;
}

export interface IntegrityCheck {
  passes: boolean;
  issues: string[];
}

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface OfferArchitecture {
  problem: string;
  promise: string;
  mechanism: string;
  benefits: string[];
  bonuses: string[];
  included: string[];
}

export interface LaunchAssets {
  files: AssetInfo[];
}

export interface ProductDefinition {
  name: string;
  type: string;
  description: string;
  version: string;
  targetCustomer: string;
  painPoints: string[];
  valueProposition: string;
  differentiation: string;
  price: { amount: number; currency: string; model: string };
}

// ─── Dishonesty Detection Patterns ───────────────────────────────────────────

const FAKE_TESTIMONIAL_PATTERNS = [
  /\b(this\s+product\s+changed\s+my\s+life)\b/i,
  /\b(I\s+was\s+skeptical\s+but\s+now)\b/i,
  /\b(works\s+like\s+magic)\b/i,
  /\b(miracle)\b/i,
  /\b(life\s*-?\s*changing)\b/i,
];

const GUARANTEED_RESULT_PATTERNS = [
  /\b(guarantee(d)?)\s+(you('ll|s\s+will)?\s+)?(will|can|see|get|achieve|earn|make|lose)\b/i,
  /\b(100%)\s+(guarantee(d|d\s+results)?|success|effective|working|satisfaction)\b/i,
  /\b(or\s+your\s+money\s+back)\b/i,
  /\b(will\s+definitely)\b/i,
  /\b(cannot\s+fail)\b/i,
];

const INVENTED_STATISTICS_PATTERNS = [
  /\b(\d{2,3}%)\s+(of\s+(people|users|customers|clients|students)\s+(report|see|experience|achieve|love))\b/i,
  /\b(over\s+\d+,?\d*\s+(people|users|customers)\s+(have\s+)?(used|bought|trusted))\b/i,
  /\b(average\s+(user|customer|student)\s+(gets|sees|earns|loses|achieves)\s+\$?\d+)/i,
];

const FALSE_AUTHORITY_PATTERNS = [
  /\b(as\s+seen\s+on)\b/i,
  /\b(used\s+by\s+(fortune\s+500|top\s+companies|leading\s+organizations))\b/i,
  /\b(doctor\s+recommended)\b/i,
  /\b(clinically\s+proven)\b/i,
  /\b(scientifically\s+proven)\b/i,
  /\b(expert\s+approved)\b/i,
  /\b(award\s*-?\s*winning)\b/i,
  /\b(world\s+[-\s]?class)\b/i,
];

const FALSE_SCARCITY_PATTERNS = [
  /\b(limited\s+time\s+offer)\b/i,
  /\b(only\s+\d+\s+left)\b/i,
  /\b(act\s+now)\b/i,
  /\b(hurry)\b/i,
  /\b(ending\s+soon)\b/i,
  /\b(once\s+in\s+a\s+lifetime)\b/i,
  /\b(don't\s+miss\s+out)\b/i,
  /\b(exclusive\s+(deal|offer|price|opportunity))\b/i,
  /\b(price\s+going\s+up)\b/i,
];

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Generate a launch package from product data.
 *
 * Assembles all elements from existing data:
 * - Product info, offer, positioning, customer, pricing
 * - FAQ generated from common objections + product features
 * - Objection responses with honest evidence tags
 * - CTA based on readiness state
 * - Proof requirements with honest availability status
 * - Integrity check catching all dishonest patterns
 * - Disclaimers when evidence is insufficient
 *
 * CRITICAL: Never fabricates missing data. If something is missing,
 * it's marked as empty/missing, never invented.
 */
export function generateLaunchPackage(
  productDef: ProductDefinition,
  packaging: Packaging | undefined,
  offerArch: OfferArchitecture | undefined,
  assets: LaunchAssets | undefined,
  qaReport: ProductQAReport | undefined,
  readiness: CommercialReadiness | undefined
): LaunchPackage {
  const packageId = `lp_${randomUUID().replace(/-/g, "").substring(0, 20)}`;
  const generatedAt = new Date();

  // ── Product Info ──────────────────────────────────────────────────────────
  const product: LaunchProductInfo = {
    name: productDef.name,
    type: productDef.type,
    description: productDef.description,
    version: productDef.version,
  };

  // ── Offer ─────────────────────────────────────────────────────────────────
  const offer: OfferInfo = offerArch
    ? {
        problem: offerArch.problem,
        promise: offerArch.promise,
        mechanism: offerArch.mechanism,
      }
    : {
        problem: productDef.painPoints.join("; ") || "Not defined",
        promise: productDef.valueProposition || "Not defined",
        mechanism: packaging?.usageGuide
          ? `${packaging.deliveryFormat || 'Digital'} delivery: ${packaging.usageGuide}`
          : `${packaging?.deliveryFormat || 'Digital'} product delivery`,
      };

  // ── Positioning ───────────────────────────────────────────────────────────
  const positioning = buildPositioning(productDef, offerArch);

  // ── Target Customer ───────────────────────────────────────────────────────
  const targetCustomer: CustomerInfo = {
    description: productDef.targetCustomer || "Not defined",
    painPoints: productDef.painPoints.length > 0
      ? productDef.painPoints
      : ["Not defined"],
  };

  // ── Core Promise ──────────────────────────────────────────────────────────
  const corePromise = offer.promise;

  // ── Benefits / Included / Bonuses ─────────────────────────────────────────
  const benefits = offerArch?.benefits || [productDef.valueProposition || "Not defined"];
  const included = offerArch?.included || [];
  const bonuses = offerArch?.bonuses || [];

  // ── Price ─────────────────────────────────────────────────────────────────
  const price: PriceInfo = {
    amount: productDef.price.amount,
    currency: productDef.price.currency,
    model: productDef.price.model,
  };

  // ── Delivery ──────────────────────────────────────────────────────────────
  const delivery: DeliveryInfo = packaging
    ? {
        method: packaging.deliveryFormat || "Not defined",
        format: packaging.deliveryFormat ? [packaging.deliveryFormat] : [],
        access: packaging.accessMethod || "Not defined",
      }
    : {
        method: "Not defined",
        format: [],
        access: "Not defined",
      };

  // ── FAQ ───────────────────────────────────────────────────────────────────
  const faq = generateFAQ(productDef, offerArch, packaging);

  // ── Objection Responses ───────────────────────────────────────────────────
  const objections = generateObjectionResponses(productDef, readiness);

  // ── CTA ───────────────────────────────────────────────────────────────────
  const cta = generateCTA(readiness?.state);

  // ── Assets ────────────────────────────────────────────────────────────────
  const assetInfos: AssetInfo[] = assets?.files || [];

  // ── Proof Requirements ────────────────────────────────────────────────────
  const proofRequirements = generateProofRequirements(
    productDef,
    readiness
  );

  // ── Integrity Check ───────────────────────────────────────────────────────
  const integrityCheck = runIntegrityCheck(productDef, offerArch);

  // ── Disclaimers ───────────────────────────────────────────────────────────
  const disclaimers = generateDisclaimers(readiness, integrityCheck, proofRequirements);

  // ── Evidence ──────────────────────────────────────────────────────────────
  const hasVerifiedData = readiness && readiness.score.overall > 0.5;
  const evidence: EvidenceTag = hasVerifiedData ? "VERIFIED" : "INFERRED";

  return {
    packageId,
    productId: productDef.name.toLowerCase().replace(/\s+/g, "-"),
    version: productDef.version,
    product,
    offer,
    positioning,
    targetCustomer,
    corePromise,
    benefits,
    included,
    bonuses,
    price,
    delivery,
    faq,
    objections,
    cta,
    assets: assetInfos,
    proofRequirements,
    disclaimers,
    integrityCheck,
    evidence,
    generatedAt,
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate a launch package.
 *
 * Checks:
 * - All required fields are populated
 * - Integrity passes
 * - No fake claims detected
 */
export function validateLaunchPackage(
  pkg: LaunchPackage
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Required string fields must be non-empty
  const requiredStrings: Array<{ field: string; value: string }> = [
    { field: "product.name", value: pkg.product.name },
    { field: "product.type", value: pkg.product.type },
    { field: "product.description", value: pkg.product.description },
    { field: "product.version", value: pkg.product.version },
    { field: "offer.problem", value: pkg.offer.problem },
    { field: "offer.promise", value: pkg.offer.promise },
    { field: "offer.mechanism", value: pkg.offer.mechanism },
    { field: "positioning", value: pkg.positioning },
    { field: "targetCustomer.description", value: pkg.targetCustomer.description },
    { field: "corePromise", value: pkg.corePromise },
    { field: "cta", value: pkg.cta },
  ];

  for (const { field, value } of requiredStrings) {
    if (!value || value === "Not defined") {
      issues.push(`Required field "${field}" is empty or undefined`);
    }
  }

  // Price must be positive
  if (pkg.price.amount <= 0) {
    issues.push("Price amount must be positive");
  }

  // Benefits must be non-empty
  if (pkg.benefits.length === 0) {
    issues.push("Product must have at least one benefit");
  }

  // Integrity must pass
  if (!pkg.integrityCheck.passes) {
    issues.push(`Integrity check failed: ${pkg.integrityCheck.issues.join("; ")}`);
  }

  // Check for fake claims in the package
  const fakeClaimIssues = getIntegrityIssues(pkg);
  if (fakeClaimIssues.length > 0) {
    issues.push(`Fake claims detected: ${fakeClaimIssues.join("; ")}`);
  }

  // Delivery must be defined
  if (pkg.delivery.method === "Not defined") {
    issues.push("Delivery method is not defined");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

// ─── Integrity Check ──────────────────────────────────────────────────────────

/**
 * Detect integrity issues in a launch package.
 *
 * Checks for:
 * - Fake testimonials
 * - Guaranteed results
 * - Invented statistics
 * - False authority claims
 * - False scarcity
 */
export function getIntegrityIssues(pkg: LaunchPackage): string[] {
  const issues: string[] = [];

  // Check all text fields for dishonest patterns
  const textFields = [
    pkg.product.description,
    pkg.offer.problem,
    pkg.offer.promise,
    pkg.offer.mechanism,
    pkg.positioning,
    pkg.corePromise,
    ...pkg.benefits,
    ...pkg.included,
    ...pkg.bonuses,
    ...pkg.faq.map((f) => `${f.question} ${f.answer}`),
    ...pkg.objections.map((o) => `${o.objection} ${o.response}`),
    pkg.cta,
    ...pkg.disclaimers,
  ];

  const fullText = textFields.join(" ");

  // Check for fake testimonials
  for (const pattern of FAKE_TESTIMONIAL_PATTERNS) {
    if (pattern.test(fullText)) {
      issues.push("Fake testimonial pattern detected in product text");
      break;
    }
  }

  // Check for guaranteed results
  for (const pattern of GUARANTEED_RESULT_PATTERNS) {
    if (pattern.test(fullText)) {
      issues.push("Guaranteed-result claim detected in product text");
      break;
    }
  }

  // Check for invented statistics
  for (const pattern of INVENTED_STATISTICS_PATTERNS) {
    if (pattern.test(fullText)) {
      issues.push("Invented-statistics pattern detected in product text");
      break;
    }
  }

  // Check for false authority
  for (const pattern of FALSE_AUTHORITY_PATTERNS) {
    if (pattern.test(fullText)) {
      issues.push("False authority claim detected in product text");
      break;
    }
  }

  // Check for false scarcity
  for (const pattern of FALSE_SCARCITY_PATTERNS) {
    if (pattern.test(fullText)) {
      issues.push("False scarcity pattern detected in product text");
      break;
    }
  }

  return issues;
}

// ─── Internal: Integrity Check for ProductDefinition ─────────────────────────

function runIntegrityCheck(
  productDef: ProductDefinition,
  offerArch: OfferArchitecture | undefined
): IntegrityCheck {
  const issues: string[] = [];

  // Check product definition fields
  const textsToCheck = [
    productDef.description,
    productDef.valueProposition,
    productDef.differentiation,
    ...productDef.painPoints,
  ];
  if (offerArch) {
    textsToCheck.push(
      offerArch.problem,
      offerArch.promise,
      offerArch.mechanism,
      ...offerArch.benefits,
      ...offerArch.bonuses
    );
  }

  const allText = textsToCheck.join(" ");

  // Run all pattern checks
  for (const pattern of FAKE_TESTIMONIAL_PATTERNS) {
    if (pattern.test(allText)) {
      issues.push("Fake testimonial language detected");
      break;
    }
  }

  for (const pattern of GUARANTEED_RESULT_PATTERNS) {
    if (pattern.test(allText)) {
      issues.push("Guaranteed-result claim detected");
      break;
    }
  }

  for (const pattern of INVENTED_STATISTICS_PATTERNS) {
    if (pattern.test(allText)) {
      issues.push("Invented statistics detected");
      break;
    }
  }

  for (const pattern of FALSE_AUTHORITY_PATTERNS) {
    if (pattern.test(allText)) {
      issues.push("False authority claim detected");
      break;
    }
  }

  for (const pattern of FALSE_SCARCITY_PATTERNS) {
    if (pattern.test(allText)) {
      issues.push("False scarcity pattern detected");
      break;
    }
  }

  return {
    passes: issues.length === 0,
    issues,
  };
}

// ─── Internal: FAQ Generation ─────────────────────────────────────────────────

function generateFAQ(
  productDef: ProductDefinition,
  offerArch: OfferArchitecture | undefined,
  packaging: Packaging | undefined
): FAQItem[] {
  const faq: FAQItem[] = [];

  // FAQ from common objections
  faq.push({
    question: `What is ${productDef.name}?`,
    answer: productDef.description,
  });

  if (productDef.targetCustomer) {
    faq.push({
      question: `Who is ${productDef.name} for?`,
      answer: `${productDef.name} is designed for ${productDef.targetCustomer}.`,
    });
  }

  if (offerArch?.mechanism) {
    faq.push({
      question: `How does ${productDef.name} work?`,
      answer: offerArch.mechanism,
    });
  }

  faq.push({
    question: `How much does ${productDef.name} cost?`,
    answer: `${productDef.name} is ${productDef.price.currency} ${productDef.price.amount} (${productDef.price.model}).`,
  });

  if (packaging?.deliveryFormat) {
    faq.push({
      question: `How will I receive ${productDef.name}?`,
      answer: `You'll receive ${productDef.name} as ${packaging.deliveryFormat}${packaging.accessMethod ? `, accessible via ${packaging.accessMethod}` : ""}.`,
    });
  }

  if (packaging?.prerequisites && packaging.prerequisites.length > 0) {
    faq.push({
      question: `What do I need before using ${productDef.name}?`,
      answer: `Prerequisites: ${packaging.prerequisites.join(", ")}.`,
    });
  }

  if (productDef.differentiation) {
    faq.push({
      question: `How is ${productDef.name} different from alternatives?`,
      answer: productDef.differentiation,
    });
  }

  // Standard objection-based FAQs
  faq.push({
    question: "What if it doesn't work for me?",
    answer: "We encourage you to review the product details carefully before purchasing to ensure it meets your needs.",
  });

  return faq;
}

// ─── Internal: Objection Responses ───────────────────────────────────────────

function generateObjectionResponses(
  productDef: ProductDefinition,
  readiness: CommercialReadiness | undefined
): ObjectionResponse[] {
  const objections: ObjectionResponse[] = [];

  // Price objection
  objections.push({
    objection: "It's too expensive",
    response: `At ${productDef.price.currency} ${productDef.price.amount}, ${productDef.name} is priced to reflect the value it delivers. Consider the cost of the problem it solves: ${productDef.painPoints[0] || "the challenges you're facing"}.`,
    evidence: readiness && readiness.score.commercialClarity.score > 0.5
      ? "VERIFIED"
      : "INFERRED",
  });

  // Time objection
  objections.push({
    objection: "I don't have time for this",
    response: `${productDef.name} is designed to be ${productDef.type === "ebook" || productDef.type === "guide" ? "read at your own pace" : "implemented incrementally"}. You can start seeing results with focused effort.`,
    evidence: "INFERRED",
  });

  // Skepticism objection
  objections.push({
    objection: "I've tried similar things before and they didn't work",
    response: productDef.differentiation
      ? `${productDef.name} is different because: ${productDef.differentiation}`
      : "We understand your skepticism. We encourage you to review the product details to see if it's right for your specific situation.",
    evidence: productDef.differentiation ? "VERIFIED" : "INFERRED",
  });

  // Relevance objection
  objections.push({
    objection: "This isn't relevant to me",
    response: productDef.targetCustomer
      ? `${productDef.name} is specifically designed for ${productDef.targetCustomer}. If that describes you, this product is likely relevant to your situation.`
      : "Please review the product description to determine if it's relevant to your situation.",
    evidence: productDef.targetCustomer ? "VERIFIED" : "INFERRED",
  });

  // Complexity objection
  objections.push({
    objection: "This looks too complicated",
    response: `${productDef.name} is structured to be straightforward${productDef.type === "guide" || productDef.type === "ebook" ? " with clear sections and step-by-step guidance" : ""}. We recommend starting with the core material and expanding from there.`,
    evidence: "INFERRED",
  });

  return objections;
}

// ─── Internal: CTA Generation ────────────────────────────────────────────────

function generateCTA(readinessState: ReadinessState | undefined): string {
  switch (readinessState) {
    case "READY_FOR_SALE":
    case "LAUNCHED":
      return "Get started now";
    case "READY_FOR_VALIDATION":
      return "Coming soon — join the waitlist";
    case "REQUIRES_REPAIR":
    case "NOT_READY":
      return "Currently in development";
    case "ITERATING":
      return "Being improved — check back soon";
    default:
      return "Learn more";
  }
}

// ─── Internal: Proof Requirements ────────────────────────────────────────────

function generateProofRequirements(
  productDef: ProductDefinition,
  readiness: CommercialReadiness | undefined
): ProofStatus[] {
  const proofs: ProofStatus[] = [];

  // Problem validation
  const hasProblem = productDef.painPoints.length > 0;
  proofs.push({
    type: "problem_validation",
    status: hasProblem ? "AVAILABLE" : "MISSING",
    description: hasProblem
      ? "Problem statement defined with specific pain points"
      : "Problem validation missing — no pain points defined",
  });

  // Solution demonstration
  const hasSolution = !!productDef.valueProposition;
  proofs.push({
    type: "solution_demonstration",
    status: hasSolution ? "AVAILABLE" : "MISSING",
    description: hasSolution
      ? "Solution/value proposition is stated"
      : "Solution demonstration missing — no value proposition defined",
  });

  // Market evidence
  const hasMarket = readiness && readiness.score.commercialClarity.score > 0.5;
  proofs.push({
    type: "market_evidence",
    status: hasMarket
      ? "AVAILABLE"
      : readiness
        ? "PARTIAL"
        : "MISSING",
    description: hasMarket
      ? "Market evidence available from commercial clarity"
      : "Market evidence is insufficient or missing",
  });

  // Quality evidence
  const hasQuality = readiness && readiness.score.quality.score > 0.5;
  proofs.push({
    type: "quality_evidence",
    status: hasQuality
      ? "AVAILABLE"
      : readiness
        ? "PARTIAL"
        : "MISSING",
    description: hasQuality
      ? "Product has passed quality assurance"
      : "Quality evidence is insufficient or missing",
  });

  // Differentiation evidence
  const hasDiff = !!productDef.differentiation;
  proofs.push({
    type: "differentiation_evidence",
    status: hasDiff ? "AVAILABLE" : "MISSING",
    description: hasDiff
      ? "Differentiation from alternatives is stated"
      : "Differentiation evidence is missing",
  });

  // Testimonial evidence
  proofs.push({
    type: "testimonial_evidence",
    status: "MISSING",
    description: "Testimonial evidence must be provided externally — never fabricated",
  });

  return proofs;
}

// ─── Internal: Disclaimers ───────────────────────────────────────────────────

function generateDisclaimers(
  readiness: CommercialReadiness | undefined,
  integrityCheck: IntegrityCheck,
  proofRequirements: ProofStatus[]
): string[] {
  const disclaimers: string[] = [];

  // Add disclaimer if readiness is low
  if (!readiness || readiness.score.overall < 0.5) {
    disclaimers.push(
      "This product is still in development. Features and content may change before final release."
    );
  }

  // Add disclaimer if integrity issues exist
  if (!integrityCheck.passes) {
    disclaimers.push(
      "Some marketing claims in this product have been flagged for review. Please verify independently."
    );
  }

  // Add disclaimer for missing proof
  const missingProofs = proofRequirements.filter(
    (p) => p.status === "MISSING"
  );
  if (missingProofs.length > 0) {
    disclaimers.push(
      `Evidence is not yet available for: ${missingProofs.map((p) => p.type.replace(/_/g, " ")).join(", ")}. Claims should be verified independently.`
    );
  }

  // Add disclaimer for partial proof
  const partialProofs = proofRequirements.filter(
    (p) => p.status === "PARTIAL"
  );
  if (partialProofs.length > 0) {
    disclaimers.push(
      `Evidence is partial for: ${partialProofs.map((p) => p.type.replace(/_/g, " ")).join(", ")}. Additional verification is recommended.`
    );
  }

  // Standard results disclaimer
  disclaimers.push(
    "Results may vary. This product provides tools and information; outcomes depend on individual effort and circumstances."
  );

  return disclaimers;
}

// ─── Internal: Positioning ───────────────────────────────────────────────────

function buildPositioning(
  productDef: ProductDefinition,
  offerArch: OfferArchitecture | undefined
): string {
  const parts: string[] = [];

  if (productDef.valueProposition) {
    parts.push(productDef.valueProposition);
  }

  if (productDef.differentiation) {
    parts.push(`Unlike alternatives, ${productDef.differentiation}`);
  }

  if (productDef.targetCustomer) {
    parts.push(`Designed for ${productDef.targetCustomer}`);
  }

  if (offerArch?.mechanism) {
    parts.push(`Through ${offerArch.mechanism}`);
  }

  return parts.length > 0 ? parts.join(". ") + "." : "Product positioning not fully defined.";
}
