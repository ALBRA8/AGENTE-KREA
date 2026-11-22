/**
 * Commercial Readiness — KREA V2.1
 *
 * Commercial Readiness scoring with honest evidence.
 * Evaluates a product across 8 dimensions to determine its readiness
 * state for commercial sale.
 *
 * Readiness States:
 *   NOT_READY            → Product is incomplete, major work needed
 *   REQUIRES_REPAIR      → Product exists but has significant issues
 *   READY_FOR_VALIDATION → Product is complete enough for review/testing
 *   READY_FOR_SALE       → Product meets all critical requirements
 *   LAUNCHED             → Product is actively being sold (explicit only)
 *   ITERATING            → Product is under active revision
 *
 * CRITICAL RULES:
 *   - Never inflate readiness scores
 *   - If data is missing, score LOW and add warnings
 *   - All evidence tags must be honest
 *   - State transitions must follow the valid flow
 *   - LAUNCHED can only be set explicitly (never inferred)
 */

import { randomUUID } from "crypto";
import type { EvidenceTag } from "@/lib/product-fit";
import type { ProductQAReport, CommercialProduct, Packaging } from "@/lib/product-qa";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReadinessState =
  | "NOT_READY"
  | "REQUIRES_REPAIR"
  | "READY_FOR_VALIDATION"
  | "READY_FOR_SALE"
  | "LAUNCHED"
  | "ITERATING";

export interface CommercialReadiness {
  productId: string;
  version: string;
  state: ReadinessState;
  score: CommercialReadinessScore;
  requirements: ReadinessRequirement[];
  blockers: string[];
  evaluatedAt: Date;
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
  score: number; // 0-1
  evidence: EvidenceTag;
  confidence: number; // 0-1
  warnings: string[];
}

export interface ReadinessRequirement {
  dimension: string;
  requirement: string;
  met: boolean;
  evidence: EvidenceTag;
}

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface ProductAssets {
  artifactCount: number;
  hasBlueprint: boolean;
  hasSpecification: boolean;
  hasEconomics: boolean;
  hasArchitecture: boolean;
}

// ─── Valid State Transitions ─────────────────────────────────────────────────

const VALID_TRANSITIONS: Array<[ReadinessState, ReadinessState]> = [
  // Forward progression
  ["NOT_READY", "REQUIRES_REPAIR"],
  ["REQUIRES_REPAIR", "READY_FOR_VALIDATION"],
  ["READY_FOR_VALIDATION", "READY_FOR_SALE"],
  ["READY_FOR_SALE", "LAUNCHED"],
  // Can skip forward in some cases
  ["NOT_READY", "READY_FOR_VALIDATION"],
  ["REQUIRES_REPAIR", "READY_FOR_SALE"],
  // Any state can go to ITERATING
  ["NOT_READY", "ITERATING"],
  ["REQUIRES_REPAIR", "ITERATING"],
  ["READY_FOR_VALIDATION", "ITERATING"],
  ["READY_FOR_SALE", "ITERATING"],
  ["LAUNCHED", "ITERATING"],
  // ITERATING goes back to READY_FOR_VALIDATION after revision
  ["ITERATING", "READY_FOR_VALIDATION"],
  // Can regress if issues found
  ["READY_FOR_VALIDATION", "REQUIRES_REPAIR"],
  ["READY_FOR_SALE", "REQUIRES_REPAIR"],
  ["READY_FOR_SALE", "READY_FOR_VALIDATION"],
  ["LAUNCHED", "READY_FOR_SALE"],
  // Self-transitions allowed (re-evaluation)
  ["NOT_READY", "NOT_READY"],
  ["REQUIRES_REPAIR", "REQUIRES_REPAIR"],
  ["READY_FOR_VALIDATION", "READY_FOR_VALIDATION"],
  ["READY_FOR_SALE", "READY_FOR_SALE"],
  ["LAUNCHED", "LAUNCHED"],
  ["ITERATING", "ITERATING"],
];

function isValidTransition(from: ReadinessState, to: ReadinessState): boolean {
  return VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

// ─── State Thresholds ─────────────────────────────────────────────────────────

const STATE_THRESHOLDS = {
  NOT_READY: 0.3,
  REQUIRES_REPAIR: 0.5,
  READY_FOR_VALIDATION: 0.7,
} as const;

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Evaluate commercial readiness of a product.
 *
 * Scores each dimension with honest evidence:
 * - productCompleteness: blueprint requirements met
 * - contentCompleteness: from content QA results
 * - quality: from QA overall score
 * - packaging: packaging exists, core product defined, scope clear
 * - delivery: delivery method, format, access defined
 * - differentiation: value prop exists, differentiation stated
 * - evidence: proof requirements availability
 * - commercialClarity: customer, problem, price all defined
 *
 * Determines state based on overall score:
 * - overall < 0.3 → NOT_READY
 * - overall < 0.5 → REQUIRES_REPAIR
 * - overall < 0.7 → READY_FOR_VALIDATION
 * - overall >= 0.7 AND all critical requirements met → READY_FOR_SALE
 * - LAUNCHED: only if explicitly set
 * - ITERATING: if under active revision
 *
 * CRITICAL: Never inflate scores. Missing data → low score + warnings.
 */
export function evaluateReadiness(
  productId: string,
  version: string,
  qaReport: ProductQAReport,
  commercialProduct?: CommercialProduct,
  packaging?: Packaging,
  assets?: ProductAssets
): CommercialReadiness {
  const evaluatedAt = new Date();
  const requirements: ReadinessRequirement[] = [];
  const blockers: string[] = [];

  // ── Dimension 1: Product Completeness ─────────────────────────────────────
  const productCompleteness = scoreProductCompleteness(assets, requirements);

  // ── Dimension 2: Content Completeness ─────────────────────────────────────
  const contentCompleteness = scoreContentCompleteness(
    qaReport,
    requirements
  );

  // ── Dimension 3: Quality ──────────────────────────────────────────────────
  const quality = scoreQuality(qaReport, requirements);

  // ── Dimension 4: Packaging ────────────────────────────────────────────────
  const packagingScore = scorePackaging(
    commercialProduct,
    packaging,
    requirements
  );

  // ── Dimension 5: Delivery ────────────────────────────────────────────────
  const delivery = scoreDelivery(packaging, requirements);

  // ── Dimension 6: Differentiation ──────────────────────────────────────────
  const differentiation = scoreDifferentiation(
    commercialProduct,
    requirements
  );

  // ── Dimension 7: Evidence ────────────────────────────────────────────────
  const evidenceScore = scoreEvidence(
    commercialProduct,
    qaReport,
    requirements
  );

  // ── Dimension 8: Commercial Clarity ──────────────────────────────────────
  const commercialClarity = scoreCommercialClarity(
    commercialProduct,
    requirements
  );

  // ── Overall Score (equal weights) ────────────────────────────────────────
  const dimensionScores = [
    productCompleteness.score,
    contentCompleteness.score,
    quality.score,
    packagingScore.score,
    delivery.score,
    differentiation.score,
    evidenceScore.score,
    commercialClarity.score,
  ];
  const overall =
    dimensionScores.reduce((sum, s) => sum + s, 0) / dimensionScores.length;

  const score: CommercialReadinessScore = {
    overall: Math.round(overall * 1000) / 1000,
    productCompleteness,
    contentCompleteness,
    quality,
    packaging: packagingScore,
    delivery,
    differentiation,
    evidence: evidenceScore,
    commercialClarity,
  };

  // ── Determine State ──────────────────────────────────────────────────────
  // Check for critical blockers
  const criticalRequirements = requirements.filter(
    (r) => !r.met && r.dimension === "critical"
  );
  for (const req of criticalRequirements) {
    blockers.push(req.requirement);
  }

  let state: ReadinessState;
  if (overall < STATE_THRESHOLDS.NOT_READY) {
    state = "NOT_READY";
  } else if (overall < STATE_THRESHOLDS.REQUIRES_REPAIR) {
    state = "REQUIRES_REPAIR";
  } else if (overall < STATE_THRESHOLDS.READY_FOR_VALIDATION) {
    state = "READY_FOR_VALIDATION";
  } else {
    // overall >= 0.7
    if (criticalRequirements.length === 0) {
      state = "READY_FOR_SALE";
    } else {
      state = "READY_FOR_VALIDATION";
    }
  }

  return {
    productId,
    version,
    state,
    score,
    requirements,
    blockers,
    evaluatedAt,
  };
}

// ─── State Machine ───────────────────────────────────────────────────────────

/**
 * Transition readiness to a new state.
 *
 * Only allows valid transitions:
 *   NOT_READY → REQUIRES_REPAIR → READY_FOR_VALIDATION → READY_FOR_SALE → LAUNCHED
 *   Any → ITERATING
 *   ITERATING → READY_FOR_VALIDATION (after revision)
 *
 * Throws if transition is invalid.
 */
export function transitionReadiness(
  current: CommercialReadiness,
  newState: ReadinessState
): CommercialReadiness {
  if (!isValidTransition(current.state, newState)) {
    throw new ReadinessTransitionError(
      `Cannot transition from ${current.state} to ${newState}`,
      current.state,
      newState
    );
  }

  return {
    ...current,
    state: newState,
    evaluatedAt: new Date(),
  };
}

// ─── Requirements for Next State ─────────────────────────────────────────────

/**
 * Get the requirements needed to reach the next readiness state.
 */
export function getReadinessRequirements(
  state: ReadinessState
): ReadinessRequirement[] {
  switch (state) {
    case "NOT_READY":
      return [
        { dimension: "productCompleteness", requirement: "Product must have at least a blueprint and architecture", met: false, evidence: "NOT_VERIFIED" },
        { dimension: "contentCompleteness", requirement: "Core content sections must be defined", met: false, evidence: "NOT_VERIFIED" },
        { dimension: "quality", requirement: "Product must pass basic artifact QA", met: false, evidence: "NOT_VERIFIED" },
      ];

    case "REQUIRES_REPAIR":
      return [
        { dimension: "quality", requirement: "All CRITICAL issues must be resolved", met: false, evidence: "NOT_VERIFIED" },
        { dimension: "contentCompleteness", requirement: "Required content sections must be complete", met: false, evidence: "NOT_VERIFIED" },
        { dimension: "commercialClarity", requirement: "Product must have defined pricing and target customer", met: false, evidence: "NOT_VERIFIED" },
      ];

    case "READY_FOR_VALIDATION":
      return [
        { dimension: "quality", requirement: "Overall QA score must be >= 0.5", met: false, evidence: "NOT_VERIFIED" },
        { dimension: "packaging", requirement: "Product must be properly packaged with delivery format", met: false, evidence: "NOT_VERIFIED" },
        { dimension: "delivery", requirement: "Delivery method and access must be defined", met: false, evidence: "NOT_VERIFIED" },
        { dimension: "evidence", requirement: "At least one proof element must be available", met: false, evidence: "NOT_VERIFIED" },
      ];

    case "READY_FOR_SALE":
      return [
        { dimension: "critical", requirement: "Overall readiness score must be >= 0.7", met: false, evidence: "NOT_VERIFIED" },
        { dimension: "critical", requirement: "No CRITICAL QA issues remain", met: false, evidence: "NOT_VERIFIED" },
        { dimension: "commercialClarity", requirement: "Customer, problem, and price are all clearly defined", met: false, evidence: "NOT_VERIFIED" },
        { dimension: "differentiation", requirement: "Value proposition and differentiation are stated", met: false, evidence: "NOT_VERIFIED" },
        { dimension: "evidence", requirement: "Sufficient proof elements are available for claims", met: false, evidence: "NOT_VERIFIED" },
      ];

    case "LAUNCHED":
      return [
        { dimension: "critical", requirement: "Product must be in READY_FOR_SALE state", met: false, evidence: "NOT_VERIFIED" },
        { dimension: "delivery", requirement: "Delivery mechanism is operational", met: false, evidence: "NOT_VERIFIED" },
        { dimension: "evidence", requirement: "Launch is explicitly authorized", met: false, evidence: "NOT_VERIFIED" },
      ];

    case "ITERATING":
      return [
        { dimension: "quality", requirement: "Revisions must be completed before returning to validation", met: false, evidence: "NOT_VERIFIED" },
      ];

    default:
      return [];
  }
}

// ─── Dimension Scoring Functions ──────────────────────────────────────────────

function scoreProductCompleteness(
  assets: ProductAssets | undefined,
  requirements: ReadinessRequirement[]
): DimensionScore {
  const warnings: string[] = [];

  if (!assets) {
    warnings.push("No product assets information available");
    requirements.push({
      dimension: "productCompleteness",
      requirement: "Product must have defined assets (blueprint, architecture, etc.)",
      met: false,
      evidence: "NOT_VERIFIED",
    });
    return {
      score: 0,
      evidence: "NOT_VERIFIED",
      confidence: 0,
      warnings,
    };
  }

  const checks = [
    { label: "blueprint", met: assets.hasBlueprint, weight: 0.3 },
    { label: "specification", met: assets.hasSpecification, weight: 0.25 },
    { label: "architecture", met: assets.hasArchitecture, weight: 0.25 },
    { label: "economics", met: assets.hasEconomics, weight: 0.1 },
    { label: "artifacts", met: assets.artifactCount > 0, weight: 0.1 },
  ];

  let score = 0;
  for (const check of checks) {
    score += check.met ? check.weight : 0;
    requirements.push({
      dimension: "productCompleteness",
      requirement: `Product must have ${check.label}`,
      met: check.met,
      evidence: check.met ? "VERIFIED" : "NOT_VERIFIED",
    });
    if (!check.met) {
      warnings.push(`Missing: ${check.label}`);
    }
  }

  return {
    score: Math.round(score * 1000) / 1000,
    evidence: checks.some((c) => c.met) ? "VERIFIED" : "NOT_VERIFIED",
    confidence: checks.filter((c) => c.met).length / checks.length,
    warnings,
  };
}

function scoreContentCompleteness(
  qaReport: ProductQAReport,
  requirements: ReadinessRequirement[]
): DimensionScore {
  const warnings: string[] = [];
  const score = qaReport.contentQA.score;

  const met = score >= 0.7;
  requirements.push({
    dimension: "contentCompleteness",
    requirement: "Content QA score must be >= 0.7",
    met,
    evidence: "VERIFIED",
  });

  if (!met) {
    warnings.push(
      `Content QA score is ${score.toFixed(3)}, needs 0.7 or higher`
    );
  }

  // Add warnings from content QA issues
  for (const issue of qaReport.contentQA.issues) {
    if (issue.severity === "MAJOR" || issue.severity === "CRITICAL") {
      warnings.push(issue.description);
    }
  }

  return {
    score,
    evidence: "VERIFIED",
    confidence: score > 0.5 ? 0.8 : 0.4,
    warnings,
  };
}

function scoreQuality(
  qaReport: ProductQAReport,
  requirements: ReadinessRequirement[]
): DimensionScore {
  const warnings: string[] = [];
  const score = qaReport.overallScore;

  const noCritical = qaReport.criticalIssues.length === 0;
  requirements.push({
    dimension: "quality",
    requirement: "No CRITICAL QA issues remain",
    met: noCritical,
    evidence: "VERIFIED",
  });

  if (!noCritical) {
    warnings.push(
      `${qaReport.criticalIssues.length} critical issue(s) remain`
    );
  }

  const scoreMet = score >= 0.5;
  requirements.push({
    dimension: "quality",
    requirement: "Overall QA score must be >= 0.5",
    met: scoreMet,
    evidence: "VERIFIED",
  });

  if (!scoreMet) {
    warnings.push(
      `Overall QA score is ${score.toFixed(3)}, needs 0.5 or higher`
    );
  }

  return {
    score,
    evidence: "VERIFIED",
    confidence: noCritical ? 0.9 : 0.5,
    warnings,
  };
}

function scorePackaging(
  commercialProduct: CommercialProduct | undefined,
  packaging: Packaging | undefined,
  requirements: ReadinessRequirement[]
): DimensionScore {
  const warnings: string[] = [];

  if (!commercialProduct && !packaging) {
    warnings.push("No commercial product or packaging information available");
    requirements.push({
      dimension: "packaging",
      requirement: "Product must have commercial definition and packaging",
      met: false,
      evidence: "NOT_VERIFIED",
    });
    return {
      score: 0,
      evidence: "NOT_VERIFIED",
      confidence: 0,
      warnings,
    };
  }

  const checks: Array<{ label: string; met: boolean; weight: number }> = [];

  // Core product defined
  const hasCommercialDef = !!commercialProduct;
  checks.push({
    label: "commercial definition",
    met: hasCommercialDef,
    weight: 0.4,
  });
  requirements.push({
    dimension: "packaging",
    requirement: "Product must have commercial definition",
    met: hasCommercialDef,
    evidence: hasCommercialDef ? "VERIFIED" : "NOT_VERIFIED",
  });

  // Scope clear (has problem + value prop)
  const hasScope =
    !!commercialProduct?.hasProblemStatement &&
    !!commercialProduct?.hasValueProposition;
  checks.push({ label: "clear scope", met: hasScope, weight: 0.3 });
  requirements.push({
    dimension: "packaging",
    requirement: "Product scope must be clear (problem + value proposition)",
    met: hasScope,
    evidence: hasScope ? "VERIFIED" : "NOT_VERIFIED",
  });

  // Delivery format defined
  const hasDeliveryFormat = !!packaging?.deliveryFormat;
  checks.push({
    label: "delivery format",
    met: hasDeliveryFormat,
    weight: 0.3,
  });
  requirements.push({
    dimension: "packaging",
    requirement: "Product must have a delivery format",
    met: hasDeliveryFormat,
    evidence: hasDeliveryFormat ? "VERIFIED" : "NOT_VERIFIED",
  });

  let score = 0;
  for (const check of checks) {
    score += check.met ? check.weight : 0;
    if (!check.met) {
      warnings.push(`Missing: ${check.label}`);
    }
  }

  return {
    score: Math.round(score * 1000) / 1000,
    evidence: checks.some((c) => c.met) ? "VERIFIED" : "NOT_VERIFIED",
    confidence: checks.filter((c) => c.met).length / checks.length,
    warnings,
  };
}

function scoreDelivery(
  packaging: Packaging | undefined,
  requirements: ReadinessRequirement[]
): DimensionScore {
  const warnings: string[] = [];

  if (!packaging) {
    warnings.push("No packaging/delivery information available");
    requirements.push({
      dimension: "delivery",
      requirement: "Product must have delivery information",
      met: false,
      evidence: "NOT_VERIFIED",
    });
    return {
      score: 0,
      evidence: "NOT_VERIFIED",
      confidence: 0,
      warnings,
    };
  }

  const checks: Array<{ label: string; met: boolean; weight: number }> = [
    {
      label: "delivery method",
      met: !!packaging.deliveryFormat,
      weight: 0.35,
    },
    {
      label: "access method",
      met: !!packaging.accessMethod,
      weight: 0.35,
    },
    {
      label: "usage guide",
      met: !!packaging.usageGuide,
      weight: 0.15,
    },
    {
      label: "prerequisites",
      met: packaging.prerequisites.length > 0,
      weight: 0.15,
    },
  ];

  let score = 0;
  for (const check of checks) {
    score += check.met ? check.weight : 0;
    requirements.push({
      dimension: "delivery",
      requirement: `Delivery must have ${check.label}`,
      met: check.met,
      evidence: check.met ? "VERIFIED" : "NOT_VERIFIED",
    });
    if (!check.met) {
      warnings.push(`Missing: ${check.label}`);
    }
  }

  return {
    score: Math.round(score * 1000) / 1000,
    evidence: checks.some((c) => c.met) ? "VERIFIED" : "NOT_VERIFIED",
    confidence: checks.filter((c) => c.met).length / checks.length,
    warnings,
  };
}

function scoreDifferentiation(
  commercialProduct: CommercialProduct | undefined,
  requirements: ReadinessRequirement[]
): DimensionScore {
  const warnings: string[] = [];

  if (!commercialProduct) {
    warnings.push("No commercial product information available for differentiation scoring");
    requirements.push({
      dimension: "differentiation",
      requirement: "Product must have defined differentiation",
      met: false,
      evidence: "NOT_VERIFIED",
    });
    return {
      score: 0,
      evidence: "NOT_VERIFIED",
      confidence: 0,
      warnings,
    };
  }

  const checks: Array<{ label: string; met: boolean; weight: number }> = [
    {
      label: "value proposition",
      met: commercialProduct.hasValueProposition,
      weight: 0.5,
    },
    {
      label: "differentiation",
      met: commercialProduct.hasDifferentiation,
      weight: 0.5,
    },
  ];

  let score = 0;
  for (const check of checks) {
    score += check.met ? check.weight : 0;
    requirements.push({
      dimension: "differentiation",
      requirement: `Product must have ${check.label}`,
      met: check.met,
      evidence: check.met ? "VERIFIED" : "NOT_VERIFIED",
    });
    if (!check.met) {
      warnings.push(`Missing: ${check.label}`);
    }
  }

  return {
    score: Math.round(score * 1000) / 1000,
    evidence: checks.some((c) => c.met) ? "VERIFIED" : "NOT_VERIFIED",
    confidence: checks.filter((c) => c.met).length / checks.length,
    warnings,
  };
}

function scoreEvidence(
  commercialProduct: CommercialProduct | undefined,
  qaReport: ProductQAReport,
  requirements: ReadinessRequirement[]
): DimensionScore {
  const warnings: string[] = [];

  // Check proof requirements availability
  const verifiedTestimonials =
    commercialProduct?.testimonials.filter((t) => t.verified).length || 0;
  const totalTestimonials =
    commercialProduct?.testimonials.length || 0;

  // QA report itself is evidence
  const qaEvidence = qaReport.evidence === "VERIFIED" ? 0.3 : 0;

  // Testimonials as evidence (only verified ones count)
  const testimonialScore =
    totalTestimonials > 0
      ? Math.min(0.3, (verifiedTestimonials / totalTestimonials) * 0.3)
      : 0;

  // Product claims with evidence
  const claimScore =
    commercialProduct && commercialProduct.claims.length > 0 ? 0.2 : 0;

  // QA overall provides some evidence
  const qaScoreEvidence = qaReport.overallScore > 0.5 ? 0.2 : 0;

  const score = qaEvidence + testimonialScore + claimScore + qaScoreEvidence;

  requirements.push({
    dimension: "evidence",
    requirement: "At least one proof element must be available",
    met: score > 0,
    evidence: score > 0 ? "VERIFIED" : "NOT_VERIFIED",
  });

  if (verifiedTestimonials < totalTestimonials) {
    warnings.push(
      `${totalTestimonials - verifiedTestimonials} unverified testimonial(s) not counted as evidence`
    );
  }

  if (score < 0.3) {
    warnings.push("Insufficient evidence for commercial claims");
  }

  return {
    score: Math.round(score * 1000) / 1000,
    evidence: score > 0 ? "VERIFIED" : "NOT_VERIFIED",
    confidence: score > 0.3 ? 0.7 : 0.3,
    warnings,
  };
}

function scoreCommercialClarity(
  commercialProduct: CommercialProduct | undefined,
  requirements: ReadinessRequirement[]
): DimensionScore {
  const warnings: string[] = [];

  if (!commercialProduct) {
    warnings.push("No commercial product information available");
    requirements.push({
      dimension: "commercialClarity",
      requirement: "Product must have commercial clarity (customer, problem, price)",
      met: false,
      evidence: "NOT_VERIFIED",
    });
    return {
      score: 0,
      evidence: "NOT_VERIFIED",
      confidence: 0,
      warnings,
    };
  }

  const checks: Array<{ label: string; met: boolean; weight: number }> = [
    {
      label: "target customer",
      met: commercialProduct.hasTargetCustomer,
      weight: 0.35,
    },
    {
      label: "problem statement",
      met: commercialProduct.hasProblemStatement,
      weight: 0.3,
    },
    {
      label: "pricing",
      met: commercialProduct.hasPricing,
      weight: 0.35,
    },
  ];

  let score = 0;
  for (const check of checks) {
    score += check.met ? check.weight : 0;
    requirements.push({
      dimension: "commercialClarity",
      requirement: `Product must have ${check.label}`,
      met: check.met,
      evidence: check.met ? "VERIFIED" : "NOT_VERIFIED",
    });
    if (!check.met) {
      warnings.push(`Missing: ${check.label}`);
    }
  }

  return {
    score: Math.round(score * 1000) / 1000,
    evidence: checks.some((c) => c.met) ? "VERIFIED" : "NOT_VERIFIED",
    confidence: checks.filter((c) => c.met).length / checks.length,
    warnings,
  };
}

// ─── Error Class ──────────────────────────────────────────────────────────────

export class ReadinessTransitionError extends Error {
  readonly fromState: ReadinessState;
  readonly toState: ReadinessState;

  constructor(
    message: string,
    fromState: ReadinessState,
    toState: ReadinessState
  ) {
    super(message);
    this.name = "ReadinessTransitionError";
    this.fromState = fromState;
    this.toState = toState;
  }
}
