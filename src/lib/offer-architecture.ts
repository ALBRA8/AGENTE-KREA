/**
 * Offer Architecture Engine — KREA V2.1
 *
 * Constructs the complete offer following the framework:
 * Problem → Promise → Product → Mechanism → Proof → Price → RiskReduction → CTA
 *
 * This engine takes a CommercialProduct and ProductPackaging and produces
 * a complete OfferArchitecture where each element is:
 * - Sourced from actual data (not invented)
 * - Tagged with evidence
 * - Warned if data is insufficient
 *
 * CRITICAL: The Integrity Check is the most important part.
 * It MUST detect and flag:
 * - Fake testimonials
 * - Invented data/statistics
 * - False authority claims
 * - False scarcity/urgency
 * - Guaranteed results that aren't actually guaranteed
 *
 * The integrity check is the last line of defense against dishonest marketing.
 */

import type { EvidenceTag } from "@/lib/product-fit";
import type {
  CommercialProduct,
  ProofRequirement,
} from "@/lib/commercial-product";
import type {
  ProductPackaging,
} from "@/lib/product-packaging";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OfferElement {
  content: string;
  evidence: EvidenceTag;
  source: string; // where this came from
  warnings: string[];
}

export interface IntegrityCheck {
  hasFakeTestimonials: boolean;
  hasInventedData: boolean;
  hasFalseAuthority: boolean;
  hasFalseScarcity: boolean;
  hasGuaranteedResults: boolean;
  passesIntegrity: boolean;
  issues: string[];
}

export interface OfferArchitecture {
  offerId: string;
  productId: string;
  problem: OfferElement;
  promise: OfferElement;
  product: OfferElement;
  mechanism: OfferElement;
  proof: OfferElement;
  price: OfferElement;
  riskReduction: OfferElement;
  cta: OfferElement;
  integrityCheck: IntegrityCheck;
  evidence: EvidenceTag;
}

// ─── Patterns for Integrity Detection ─────────────────────────────────────────

/**
 * Patterns that indicate fake testimonials.
 * These are heuristic patterns — not perfect, but catch common fakes.
 */
const FAKE_TESTIMONIAL_PATTERNS = [
  /\b(?:thousands|millions)\s+of\s+(?:customers|users|people|clients)\s+(?:love|trust|swear|rely)\b/i,
  /\b(?:rated|rated)\s+(?:5|five)\s+(?:stars?|⭐)/i,
  /\b(?:join|joined)\s+(?:\d+,?\d*)\s+(?:happy|satisfied)\s+(?:customers|users|members)\b/i,
  /\b(?:as seen on|featured on|as featured in)\b.*\b(?:cnn|bbc|forbes|techcrunch|nyt)\b/i,
  /\b(?:everyone|everybody|all)\s+(?:is|are|raving|talking)\b/i,
];

/**
 * Patterns that indicate invented data or statistics.
 */
const INVENTED_DATA_PATTERNS = [
  /\b(?:studies show|research shows|science shows|data shows)\b(?!\s+(?:that\s+)?(?:this|our|the\s+specific))/i,
  /\b(?:\d{2,3})%\s+(?:of\s+)?(?:people|users|customers|businesses)\s+(?:report|see|experience|achieve)\b/i,
  /\b(?:average|typical|normal)\s+(?:customer|user|client)\s+(?:sees|gets|achieves|earns|makes)\s+(?:\$|£|€)/i,
  /\b(?:proven|clinically|scientifically)\s+(?:to|by)\b/i,
  /\b(?:guaranteed|guarantee)\s+(?:to\s+)?(?:increase|double|triple|grow|improve|boost)\b/i,
];

/**
 * Patterns that indicate false authority.
 */
const FALSE_AUTHORITY_PATTERNS = [
  /\b(?:world['']?s?\s+)?(?:leading|best|#1|number\s+1|top|premier)\s+(?:expert|authority|specialist|company|brand|solution)\b/i,
  /\b(?:award[\s-]?winning)\b(?!\s+(?:specifically|by\s))/i,
  /\b(?:trusted\s+by)\s+(?:fortune\s+500|top\s+companies|leading\s+brands)\b/i,
  /\b(?:industry\s+leader|market\s+leader|dominant\s+player)\b/i,
];

/**
 * Patterns that indicate false scarcity or urgency.
 */
const FALSE_SCARCITY_PATTERNS = [
  /\b(?:limited\s+time\s+offer|hurry|act\s+now|don'?t\s+wait|last\s+chance|final\s+chance)\b/i,
  /\b(?:only|just)\s+\d+\s+(?:left|remaining|spots?|copies?|seats?|available)\b/i,
  /\b(?:selling\s+out|almost\s+gone|going\s+fast)\b/i,
  /\b(?:price\s+going\s+up|price\s+increase|increasing\s+soon)\b/i,
  /\b(?:expires?|deadline|closing\s+soon)\s+(?:today|tonight|midnight|in\s+\d+\s+hours?)\b/i,
];

/**
 * Patterns that indicate guaranteed results that aren't actually guaranteed.
 */
const GUARANTEED_RESULT_PATTERNS = [
  /\b(?:guaranteed|guarantee|promise|ensured?)\s+(?:to\s+)?(?:make|earn|save|get|achieve|see|gain|win)\s+(?:you\s+)?(?:\$|£|€|\d)/i,
  /\b(?:or\s+your\s+money\s+back|100%\s+(?:guaranteed|money\s+back|refund)|double\s+your\s+money\s+back)\b/i,
  /\b(?:results?\s+)?(?:guaranteed|assured|certain|promised)\b/i,
  /\b(?:will|shall|must)\s+(?:definitely|absolutely|certainly|guaranteed)\s+(?:make|earn|save|get|achieve|see)\b/i,
  /\b(?:fail[\s-]?proof|can'?t\s+fail|impossible\s+to\s+fail|zero\s+risk)\b/i,
];

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Create an Offer Architecture from a Commercial Product and Packaging.
 *
 * Problem → Promise → Product → Mechanism → Proof → Price → RiskReduction → CTA
 *
 * Each element is derived from real data, tagged with evidence,
 * and warned if data is insufficient.
 *
 * The integrity check runs last and is the final gate.
 */
export function createOfferArchitecture(
  commercialProduct: CommercialProduct,
  packaging: ProductPackaging
): OfferArchitecture {
  const offerId = generateId("offer");

  // Problem: directly from commercial product
  const problem = buildProblemElement(commercialProduct);

  // Promise: derived from value proposition (NOT invented)
  const promise = buildPromiseElement(commercialProduct);

  // Product: from commercial product description and packaging
  const product = buildProductElement(commercialProduct, packaging);

  // Mechanism: how the product works
  const mechanism = buildMechanismElement(commercialProduct, packaging);

  // Proof: from proof requirements (MISSING = noted honestly)
  const proof = buildProofElement(commercialProduct);

  // Price: from price range
  const price = buildPriceElement(commercialProduct);

  // Risk reduction: guarantees only if evidence supports
  const riskReduction = buildRiskReductionElement(commercialProduct, packaging);

  // CTA: appropriate to readiness level
  const cta = buildCTAElement(commercialProduct);

  // Determine overall evidence (weakest link)
  const allEvidence: EvidenceTag[] = [
    problem.evidence,
    promise.evidence,
    product.evidence,
    mechanism.evidence,
    proof.evidence,
    price.evidence,
    riskReduction.evidence,
    cta.evidence,
  ];
  const overallEvidence = weakestEvidence(allEvidence);

  // Build the offer
  const offer: OfferArchitecture = {
    offerId,
    productId: commercialProduct.productId,
    problem,
    promise,
    product,
    mechanism,
    proof,
    price,
    riskReduction,
    cta,
    integrityCheck: { // Placeholder — will be updated
      hasFakeTestimonials: false,
      hasInventedData: false,
      hasFalseAuthority: false,
      hasFalseScarcity: false,
      hasGuaranteedResults: false,
      passesIntegrity: true,
      issues: [],
    },
    evidence: overallEvidence,
  };

  // Run integrity check
  offer.integrityCheck = checkOfferIntegrity(offer);

  return offer;
}

/**
 * Check Offer Integrity.
 *
 * Scans all elements for dishonest patterns:
 * - Fake testimonials
 * - Invented data/statistics
 * - False authority claims
 * - False scarcity/urgency
 * - Guaranteed results that aren't actually guaranteed
 *
 * Returns passesIntegrity = true ONLY if no issues are found.
 */
export function checkOfferIntegrity(offer: OfferArchitecture): IntegrityCheck {
  const issues: string[] = [];
  let hasFakeTestimonials = false;
  let hasInventedData = false;
  let hasFalseAuthority = false;
  let hasFalseScarcity = false;
  let hasGuaranteedResults = false;

  // Collect all text content from all elements
  const elements: { name: string; content: string }[] = [
    { name: "Problem", content: offer.problem.content },
    { name: "Promise", content: offer.promise.content },
    { name: "Product", content: offer.product.content },
    { name: "Mechanism", content: offer.mechanism.content },
    { name: "Proof", content: offer.proof.content },
    { name: "Price", content: offer.price.content },
    { name: "RiskReduction", content: offer.riskReduction.content },
    { name: "CTA", content: offer.cta.content },
  ];

  for (const element of elements) {
    // Check for fake testimonials
    for (const pattern of FAKE_TESTIMONIAL_PATTERNS) {
      if (pattern.test(element.content)) {
        hasFakeTestimonials = true;
        issues.push(
          `[${element.name}] Fake testimonial pattern detected: "${pattern.source}"`
        );
        break;
      }
    }

    // Check for invented data
    for (const pattern of INVENTED_DATA_PATTERNS) {
      if (pattern.test(element.content)) {
        hasInventedData = true;
        issues.push(
          `[${element.name}] Invented data pattern detected: "${pattern.source}"`
        );
        break;
      }
    }

    // Check for false authority
    for (const pattern of FALSE_AUTHORITY_PATTERNS) {
      if (pattern.test(element.content)) {
        hasFalseAuthority = true;
        issues.push(
          `[${element.name}] False authority pattern detected: "${pattern.source}"`
        );
        break;
      }
    }

    // Check for false scarcity
    for (const pattern of FALSE_SCARCITY_PATTERNS) {
      if (pattern.test(element.content)) {
        hasFalseScarcity = true;
        issues.push(
          `[${element.name}] False scarcity pattern detected: "${pattern.source}"`
        );
        break;
      }
    }

    // Check for guaranteed results
    for (const pattern of GUARANTEED_RESULT_PATTERNS) {
      if (pattern.test(element.content)) {
        hasGuaranteedResults = true;
        issues.push(
          `[${element.name}] Guaranteed result pattern detected: "${pattern.source}"`
        );
        break;
      }
    }
  }

  // Additional integrity checks

  // Check if proof element claims VERIFIED but proof requirements are MISSING
  if (offer.proof.evidence === "VERIFIED") {
    const proofContent = offer.proof.content.toLowerCase();
    if (
      proofContent.includes("testimonial") &&
      !proofContent.includes("available")
    ) {
      issues.push(
        "[Proof] Claims verified evidence but proof requirements may not be available"
      );
      hasInventedData = true;
    }
  }

  // Check if price claims VERIFIED for a new product (should always be ESTIMATED)
  if (offer.price.evidence === "VERIFIED") {
    issues.push(
      "[Price] Price evidence marked as VERIFIED for a new product — should be ESTIMATED or INFERRED"
    );
    hasInventedData = true;
  }

  // Check if promise makes claims not supported by proof
  const promiseContent = offer.promise.content.toLowerCase();
  if (
    (promiseContent.includes("guarantee") || promiseContent.includes("will achieve")) &&
    offer.proof.evidence !== "VERIFIED"
  ) {
    issues.push(
      "[Promise] Makes guarantee/achievement claims without verified proof"
    );
    hasGuaranteedResults = true;
  }

  const passesIntegrity = issues.length === 0;

  return {
    hasFakeTestimonials,
    hasInventedData,
    hasFalseAuthority,
    hasFalseScarcity,
    hasGuaranteedResults,
    passesIntegrity,
    issues,
  };
}

// ─── Element Builder Functions ────────────────────────────────────────────────

function buildProblemElement(commercialProduct: CommercialProduct): OfferElement {
  const warnings: string[] = [];

  if (!commercialProduct.problem || commercialProduct.problem.length < 10) {
    warnings.push("Problem statement is too short — may not resonate with customers");
  }

  // Check if problem mentions customer pain points
  const painPointsMentioned = commercialProduct.targetCustomer.painPoints.some(
    (pp) => commercialProduct.problem.toLowerCase().includes(pp.toLowerCase().substring(0, 20))
  );
  if (!painPointsMentioned && commercialProduct.targetCustomer.painPoints.length > 0) {
    warnings.push("Problem statement doesn't directly reference known customer pain points");
  }

  return {
    content: commercialProduct.problem,
    evidence: commercialProduct.evidence,
    source: `commercialProduct.problem (from dossier opportunity)`,
    warnings,
  };
}

function buildPromiseElement(commercialProduct: CommercialProduct): OfferElement {
  const warnings: string[] = [];

  // Promise is derived from value proposition — NOT invented
  const content = commercialProduct.valueProposition;

  // Check if promise is too strong for the evidence
  if (
    content.toLowerCase().includes("guarantee") &&
    commercialProduct.proofRequirements.filter((p) => p.status === "AVAILABLE").length === 0
  ) {
    warnings.push(
      "Promise contains 'guarantee' but no proof elements are available — remove guarantee language"
    );
  }

  // Check if promise is specific enough
  if (content.length < 20) {
    warnings.push("Promise may be too vague — consider making it more specific");
  }

  return {
    content,
    evidence: commercialProduct.evidence,
    source: `commercialProduct.valueProposition (derived from analysis)`,
    warnings,
  };
}

function buildProductElement(
  commercialProduct: CommercialProduct,
  packaging: ProductPackaging
): OfferElement {
  const warnings: string[] = [];

  // Product element describes what the customer gets
  const parts: string[] = [];
  parts.push(`${commercialProduct.productName} — ${commercialProduct.format}`);

  if (packaging.coreProduct.included.length > 0) {
    parts.push(`Includes: ${packaging.coreProduct.included.slice(0, 5).join(", ")}`);
  }

  if (packaging.bonuses.length > 0) {
    parts.push(`Bonus materials: ${packaging.bonuses.map((b) => b.name).join(", ")}`);
  } else {
    warnings.push("No bonus materials — consider adding value-add content");
  }

  return {
    content: parts.join(". "),
    evidence: commercialProduct.evidence,
    source: `commercialProduct + packaging (core product and bonuses)`,
    warnings,
  };
}

function buildMechanismElement(
  commercialProduct: CommercialProduct,
  packaging: ProductPackaging
): OfferElement {
  const warnings: string[] = [];

  // Mechanism explains HOW the product delivers the promise
  const parts: string[] = [];

  // How the product works — from usage guide
  if (packaging.usage.steps.length > 0) {
    parts.push(
      `How it works: ${packaging.usage.steps.slice(0, 4).join(" → ")}`
    );
  }

  // Time to value
  if (packaging.usage.timeToValue) {
    parts.push(`Time to value: ${packaging.usage.timeToValue}`);
  }

  // Distribution method
  parts.push(`Delivery: ${packaging.delivery.method}`);

  if (parts.length === 0) {
    warnings.push("Mechanism is not well defined — customer may not understand how product works");
  }

  return {
    content: parts.join(". "),
    evidence: "INFERRED", // Mechanism is inferred from product design
    source: `packaging.usage + packaging.delivery (derived from product type)`,
    warnings,
  };
}

function buildProofElement(commercialProduct: CommercialProduct): OfferElement {
  const warnings: string[] = [];
  const parts: string[] = [];

  const available = commercialProduct.proofRequirements.filter(
    (p) => p.status === "AVAILABLE"
  );
  const missing = commercialProduct.proofRequirements.filter(
    (p) => p.status === "MISSING"
  );
  const partial = commercialProduct.proofRequirements.filter(
    (p) => p.status === "PARTIAL"
  );

  // Honestly report what proof is available
  if (available.length > 0) {
    parts.push(
      `Available proof: ${available.map((p) => `${p.type} (${p.description})`).join("; ")}`
    );
  }

  if (partial.length > 0) {
    parts.push(
      `Partial proof: ${partial.map((p) => `${p.type} — ${p.description}`).join("; ")}`
    );
  }

  // IMPORTANT: Honestly report what's MISSING — don't hide it
  if (missing.length > 0) {
    parts.push(
      `Missing proof: ${missing.map((p) => p.type).join(", ")} — needs to be developed before launch`
    );
    warnings.push(
      `${missing.length} proof element(s) are MISSING — offer credibility is reduced`
    );
  }

  if (available.length === 0 && partial.length === 0) {
    warnings.push("NO proof elements are available — offer has no credibility support");
  }

  // Evidence tag based on proof availability
  let evidence: EvidenceTag;
  if (available.length > 0 && missing.length === 0) {
    evidence = "INFERRED"; // Even with all proofs, outcome is inferred
  } else if (available.length > 0 || partial.length > 0) {
    evidence = "INFERRED";
  } else {
    evidence = "NOT_VERIFIED";
  }

  return {
    content: parts.join(". "),
    evidence,
    source: `commercialProduct.proofRequirements (from proof analysis)`,
    warnings,
  };
}

function buildPriceElement(commercialProduct: CommercialProduct): OfferElement {
  const warnings: string[] = [];

  const content = [
    `${commercialProduct.monetizationModel} pricing model`,
    `Price range: ${commercialProduct.priceRange.currency} ${commercialProduct.priceRange.min} - ${commercialProduct.priceRange.max}`,
    `Recommended: ${commercialProduct.priceRange.currency} ${commercialProduct.priceRange.recommended}`,
    `Reasoning: ${commercialProduct.priceStrategy.reasoning}`,
  ].join(". ");

  // Price is ALWAYS estimated for new products
  if (commercialProduct.priceRange.evidence !== "ESTIMATED" && commercialProduct.priceRange.evidence !== "INFERRED") {
    warnings.push(
      "Price evidence should be ESTIMATED or INFERRED for new products — not VERIFIED"
    );
  }

  return {
    content,
    evidence: commercialProduct.priceRange.evidence,
    source: `commercialProduct.priceRange + priceStrategy (from heuristics and economics)`,
    warnings,
  };
}

function buildRiskReductionElement(
  commercialProduct: CommercialProduct,
  packaging: ProductPackaging
): OfferElement {
  const warnings: string[] = [];
  const parts: string[] = [];

  // Risk reduction — only offer what evidence supports
  const availableProofs = commercialProduct.proofRequirements.filter(
    (p) => p.status === "AVAILABLE"
  );

  // If we have available proof, we can offer a satisfaction approach
  if (availableProofs.length > 0) {
    parts.push(
      `Product is supported by ${availableProofs.length} verified proof element(s): ${availableProofs.map((p) => p.type).join(", ")}`
    );
  }

  // Sample/preview reduces risk
  const hasSample = commercialProduct.proofRequirements.some(
    (p) => p.type === "sample" && (p.status === "AVAILABLE" || p.status === "PARTIAL")
  );
  if (hasSample) {
    parts.push("Free sample/preview available to evaluate before purchase");
  } else {
    warnings.push("No sample/preview available — consider providing one to reduce purchase risk");
  }

  // Guarantee — ONLY if evidence actually supports it
  const hasGuarantee = commercialProduct.proofRequirements.some(
    (p) => p.type === "guarantee" && p.status === "AVAILABLE"
  );
  if (hasGuarantee) {
    parts.push("Satisfaction guarantee available (backed by verified evidence)");
  } else {
    // DO NOT offer a guarantee if we don't have evidence to support it
    parts.push("Standard terms apply — guarantee not offered without supporting evidence");
    warnings.push("Cannot offer guarantee — no verified evidence to support guarantee claims");
  }

  // Use disclaimers from packaging
  if (packaging.expectedOutcome.disclaimers.length > 0) {
    parts.push(`Note: ${packaging.expectedOutcome.disclaimers[0]}`);
  }

  const evidence = hasGuarantee ? "INFERRED" : "NOT_VERIFIED";

  return {
    content: parts.join(". "),
    evidence,
    source: `commercialProduct.proofRequirements + packaging.expectedOutcome (from evidence analysis)`,
    warnings,
  };
}

function buildCTAElement(commercialProduct: CommercialProduct): OfferElement {
  const warnings: string[] = [];

  // CTA should be appropriate to readiness level
  const readiness = commercialProduct.commercialReadiness.overall;
  let content: string;
  let evidence: EvidenceTag;

  if (readiness >= 0.7) {
    // High readiness — direct purchase CTA
    content = `Get ${commercialProduct.productName} now — ${commercialProduct.priceRange.currency} ${commercialProduct.priceRange.recommended}`;
    evidence = "INFERRED";
  } else if (readiness >= 0.4) {
    // Medium readiness — softer CTA
    content = `Learn more about ${commercialProduct.productName} — see if it's right for you`;
    evidence = "INFERRED";
    warnings.push(
      "Commercial readiness is medium — consider a softer CTA rather than direct purchase"
    );
  } else {
    // Low readiness — very soft CTA or no CTA
    content = `${commercialProduct.productName} is in development — sign up for updates`;
    evidence = "NOT_VERIFIED";
    warnings.push(
      "Commercial readiness is LOW — product should not be offered for sale yet"
    );
  }

  // Check that CTA doesn't use false urgency
  if (
    content.toLowerCase().includes("limited") ||
    content.toLowerCase().includes("hurry") ||
    content.toLowerCase().includes("now or") ||
    content.toLowerCase().includes("before it's too late")
  ) {
    warnings.push("CTA contains urgency language — ensure it's genuine, not manufactured");
  }

  return {
    content,
    evidence,
    source: `commercialProduct.commercialReadiness (from readiness evaluation)`,
    warnings,
  };
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Return the weakest (least trustworthy) evidence tag from a list.
 * Order: UNKNOWN < NOT_VERIFIED < ESTIMATED < INFERRED < VERIFIED
 */
function weakestEvidence(evidenceTags: EvidenceTag[]): EvidenceTag {
  const order: Record<EvidenceTag, number> = {
    UNKNOWN: 0,
    NOT_VERIFIED: 1,
    ESTIMATED: 2,
    INFERRED: 3,
    VERIFIED: 4,
  };

  let weakest: EvidenceTag = "VERIFIED";
  let weakestOrder = Infinity;

  for (const tag of evidenceTags) {
    const tagOrder = order[tag];
    if (tagOrder < weakestOrder) {
      weakestOrder = tagOrder;
      weakest = tag;
    }
  }

  return weakest;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 10)}`;
}
