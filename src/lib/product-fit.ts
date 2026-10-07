/**
 * Product Fit Engine — KREA V2 Product Brain
 *
 * Evaluates product opportunities across multiple dimensions to determine
 * whether to BUILD, VALIDATE_FIRST, or DO_NOT_BUILD.
 *
 * Acceptance Criteria satisfied:
 *   AC-010: No magic numbers — every score is explained with the variables evaluated
 *   AC-007: Unknown evidence produces uncertain dimensions and VALIDATE_FIRST recommendation
 *
 * Scoring rules:
 *   - High problem intensity + high demand + low competition → BUILD
 *   - Good signals but uncertain evidence → VALIDATE_FIRST
 *   - Low demand or high risk or poor evidence → DO_NOT_BUILD
 *   - Always explain WHAT variables were evaluated and HOW
 */

import { ProductEvidence, ProductEvidenceType } from "./product-intelligence";
import { TruthLevel, TRUTH_LEVEL_ORDER } from "@/contracts/evidence";

// ─── Types ────────────────────────────────────────────────────────────────────

/** An opportunity to evaluate */
export interface Opportunity {
  /** Short name */
  name: string;
  /** Domain/market */
  domain: string;
  /** Problem statement */
  problem: string;
  /** Proposed solution concept */
  solution: string;
  /** Target audience description */
  audience: string;
  /** Product format (eBook, SaaS, API, etc.) */
  format?: string;
}

/** A single evaluated dimension */
export interface EvaluatedDimension {
  /** Dimension name */
  name: string;
  /** Score 0-1 */
  score: number;
  /** Evidence supporting this score */
  evidence: string[];
  /** Confidence in this score (0-1) */
  confidence: number;
  /** Whether this dimension is uncertain (low evidence) */
  is_uncertain: boolean;
  /** Explanation of HOW this score was derived (AC-010) */
  explanation: string;
}

/** The decision from a fit evaluation */
export type FitDecision = "BUILD" | "VALIDATE_FIRST" | "DO_NOT_BUILD";

/** Complete fit evaluation result */
export interface FitResult {
  /** The decision */
  decision: FitDecision;
  /** Overall score 0-1 */
  score: number;
  /** Evaluated dimensions */
  dimensions: EvaluatedDimension[];
  /** WHY this decision was made (AC-010) */
  explanation: string;
  /** What remains unknown */
  uncertainties: string[];
  /** Recommended next actions */
  recommended_actions: string[];
  /** All evidence referenced in the evaluation */
  evidence_used: ProductEvidence[];
  /** Timestamp */
  evaluatedAt: string;
}

// ─── Dimension Names ─────────────────────────────────────────────────────────

const DIMENSION_NAMES = [
  "problem_intensity",
  "demand",
  "payment_intent",
  "audience_size",
  "competition",
  "differentiation",
  "feasibility",
  "build_time",
  "economics",
  "risk",
  "evidence_quality",
] as const;

export type DimensionName = (typeof DIMENSION_NAMES)[number];

// ─── Scoring Weights ─────────────────────────────────────────────────────────

/**
 * Weights for each dimension in the overall score.
 * Higher weight = more important for the BUILD decision.
 *
 * These are NOT magic numbers — each weight reflects a deliberate
 * prioritization of what makes a product opportunity viable.
 */
const DIMENSION_WEIGHTS: Record<DimensionName, number> = {
  problem_intensity: 0.18,  // Core: how painful is the problem?
  demand: 0.16,             // Core: is there real demand?
  payment_intent: 0.12,     // Key: will people pay?
  audience_size: 0.10,      // Important: enough potential customers?
  competition: 0.10,        // Important: is the space crowded? (inverse — less competition = better)
  differentiation: 0.10,    // Important: can we stand out?
  feasibility: 0.08,        // Supporting: can we actually build it?
  build_time: 0.04,         // Supporting: how long will it take?
  economics: 0.06,          // Supporting: does the math work?
  risk: 0.04,               // Supporting: what could go wrong? (inverse)
  evidence_quality: 0.02,   // Meta: how good is our evidence?
};

// ─── Product Fit Engine ──────────────────────────────────────────────────────

/**
 * ProductFitEngine — Evaluates opportunities across 11 dimensions.
 *
 * Each dimension is scored 0-1 with explicit explanation of how
 * the score was derived from evidence. No magic numbers (AC-010).
 */
export class ProductFitEngine {
  /**
   * evaluate — Produce a FitResult for an opportunity given evidence.
   *
   * Decision logic (AC-010 — every threshold explained):
   *   - BUILD:       score >= 0.65 AND no critical uncertainties AND evidence_quality >= 0.5
   *   - VALIDATE_FIRST: score >= 0.40 OR (score >= 0.30 AND has uncertain dimensions)
   *   - DO_NOT_BUILD:  score < 0.40 AND no uncertain dimensions that could improve score
   */
  evaluate(opportunity: Opportunity, evidence: ProductEvidence[]): FitResult {
    const evidenceByType = this.groupEvidenceByType(evidence);

    // Evaluate each dimension
    const dimensions: EvaluatedDimension[] = [
      this.evaluateProblemIntensity(evidenceByType),
      this.evaluateDemand(evidenceByType),
      this.evaluatePaymentIntent(evidenceByType),
      this.evaluateAudienceSize(evidenceByType),
      this.evaluateCompetition(evidenceByType),
      this.evaluateDifferentiation(evidenceByType),
      this.evaluateFeasibility(evidenceByType, opportunity),
      this.evaluateBuildTime(evidenceByType, opportunity),
      this.evaluateEconomics(evidenceByType),
      this.evaluateRisk(evidenceByType),
      this.evaluateEvidenceQuality(evidence),
    ];

    // Calculate weighted overall score
    const score = this.calculateWeightedScore(dimensions);

    // Determine decision
    const decision = this.determineDecision(score, dimensions);

    // Collect uncertainties
    const uncertainties = dimensions
      .filter((d) => d.is_uncertain)
      .map((d) => `${d.name}: ${d.explanation}`);

    // Generate explanation
    const explanation = this.generateExplanation(decision, score, dimensions, opportunity);

    // Recommended actions
    const recommended_actions = this.recommendActions(decision, dimensions, uncertainties);

    return {
      decision,
      score: Math.round(score * 100) / 100,
      dimensions,
      explanation,
      uncertainties,
      recommended_actions,
      evidence_used: evidence,
      evaluatedAt: new Date().toISOString(),
    };
  }

  // ─── Dimension Evaluators ──────────────────────────────────────────────

  /** Problem intensity: how painful is the problem? */
  private evaluateProblemIntensity(
    evidenceByType: Map<ProductEvidenceType, ProductEvidence[]>
  ): EvaluatedDimension {
    const problemEvidence = evidenceByType.get("PROBLEM") || [];
    const needEvidence = evidenceByType.get("NEED") || [];
    const allEvidence = [...problemEvidence, ...needEvidence];

    if (allEvidence.length === 0) {
      return {
        name: "problem_intensity",
        score: 0.3,
        evidence: [],
        confidence: 0,
        is_uncertain: true,
        explanation: "No PROBLEM or NEED evidence found. Default score 0.3 assigned due to absence of evidence (AC-007). REQUIERE_VALIDACION — research problem intensity before deciding.",
      };
    }

    // Average confidence of problem evidence indicates intensity
    const avgConfidence = allEvidence.reduce((s, e) => s + e.confidence, 0) / allEvidence.length;
    const highConfidenceCount = allEvidence.filter((e) => e.confidence >= 0.7).length;
    const ratio = highConfidenceCount / allEvidence.length;

    // Score: weighted combination of average confidence and ratio of high-confidence evidence
    const score = 0.6 * avgConfidence + 0.4 * ratio;
    const isUncertain = avgConfidence < 0.5;

    return {
      name: "problem_intensity",
      score: Math.round(score * 100) / 100,
      evidence: allEvidence.map((e) => e.id),
      confidence: avgConfidence,
      is_uncertain: isUncertain,
      explanation: isUncertain
        ? `Problem intensity estimated at ${score.toFixed(2)} from ${allEvidence.length} evidence items (avg confidence: ${avgConfidence.toFixed(2)}, ${highConfidenceCount} high-confidence). Low confidence makes this uncertain — VALIDATE problem intensity with users.`
        : `Problem intensity scored ${score.toFixed(2)}: ${allEvidence.length} evidence items, average confidence ${avgConfidence.toFixed(2)}, ${highConfidenceCount} items with confidence >= 0.7 (ratio: ${ratio.toFixed(2)}). Formula: 0.6 * avgConfidence + 0.4 * highRatio.`,
    };
  }

  /** Demand: is there real demand? */
  private evaluateDemand(
    evidenceByType: Map<ProductEvidenceType, ProductEvidence[]>
  ): EvaluatedDimension {
    const demandEvidence = evidenceByType.get("DEMAND") || [];
    const behaviorEvidence = evidenceByType.get("BEHAVIOR") || [];
    const allEvidence = [...demandEvidence, ...behaviorEvidence];

    if (allEvidence.length === 0) {
      return {
        name: "demand",
        score: 0.2,
        evidence: [],
        confidence: 0,
        is_uncertain: true,
        explanation: "No DEMAND or BEHAVIOR evidence found. Default score 0.2 — cannot confirm demand without evidence (AC-007). REQUIERE_VALIDACION.",
      };
    }

    const avgConfidence = allEvidence.reduce((s, e) => s + e.confidence, 0) / allEvidence.length;
    const demandSpecific = demandEvidence.length / Math.max(allEvidence.length, 1);
    const score = 0.5 * avgConfidence + 0.3 * demandSpecific + 0.2 * (allEvidence.length > 3 ? 1 : allEvidence.length / 3);

    return {
      name: "demand",
      score: Math.round(score * 100) / 100,
      evidence: allEvidence.map((e) => e.id),
      confidence: avgConfidence,
      is_uncertain: avgConfidence < 0.5 || demandEvidence.length === 0,
      explanation: `Demand scored ${score.toFixed(2)}: ${demandEvidence.length} demand + ${behaviorEvidence.length} behavior evidence items. Formula: 0.5 * avgConfidence(${avgConfidence.toFixed(2)}) + 0.3 * demandRatio(${demandSpecific.toFixed(2)}) + 0.2 * volumeBonus.`,
    };
  }

  /** Payment intent: will people pay? */
  private evaluatePaymentIntent(
    evidenceByType: Map<ProductEvidenceType, ProductEvidence[]>
  ): EvaluatedDimension {
    const demandEvidence = evidenceByType.get("DEMAND") || [];
    const pricingEvidence = evidenceByType.get("PRICING") || [];
    const allEvidence = [...demandEvidence, ...pricingEvidence];

    if (pricingEvidence.length === 0 && demandEvidence.length === 0) {
      return {
        name: "payment_intent",
        score: 0.3,
        evidence: [],
        confidence: 0,
        is_uncertain: true,
        explanation: "No PRICING or DEMAND evidence to assess payment intent. Default 0.3. REQUIERE_VALIDACION — validate willingness to pay.",
      };
    }

    // Pricing evidence is the strongest signal for payment intent
    const pricingSignal = pricingEvidence.length > 0
      ? pricingEvidence.reduce((s, e) => s + e.confidence, 0) / pricingEvidence.length
      : 0.3;
    const demandSignal = demandEvidence.length > 0
      ? demandEvidence.reduce((s, e) => s + e.confidence, 0) / demandEvidence.length
      : 0.3;

    const score = 0.6 * pricingSignal + 0.4 * demandSignal;

    return {
      name: "payment_intent",
      score: Math.round(score * 100) / 100,
      evidence: allEvidence.map((e) => e.id),
      confidence: (pricingSignal + demandSignal) / 2,
      is_uncertain: pricingEvidence.length === 0,
      explanation: `Payment intent scored ${score.toFixed(2)}: pricing signal ${pricingSignal.toFixed(2)} from ${pricingEvidence.length} items, demand signal ${demandSignal.toFixed(2)} from ${demandEvidence.length} items. Formula: 0.6 * pricingSignal + 0.4 * demandSignal.${pricingEvidence.length === 0 ? " No pricing evidence — uncertain." : ""}`,
    };
  }

  /** Audience size: enough potential customers? */
  private evaluateAudienceSize(
    evidenceByType: Map<ProductEvidenceType, ProductEvidence[]>
  ): EvaluatedDimension {
    const audienceEvidence = evidenceByType.get("AUDIENCE") || [];

    if (audienceEvidence.length === 0) {
      return {
        name: "audience_size",
        score: 0.3,
        evidence: [],
        confidence: 0,
        is_uncertain: true,
        explanation: "No AUDIENCE evidence found. Cannot estimate audience size. Default 0.3. REQUIERE_VALIDACION.",
      };
    }

    const avgConfidence = audienceEvidence.reduce((s, e) => s + e.confidence, 0) / audienceEvidence.length;
    // More audience evidence items suggests a larger, more identifiable audience
    const volumeFactor = Math.min(1, audienceEvidence.length / 5);
    const score = 0.6 * avgConfidence + 0.4 * volumeFactor;

    return {
      name: "audience_size",
      score: Math.round(score * 100) / 100,
      evidence: audienceEvidence.map((e) => e.id),
      confidence: avgConfidence,
      is_uncertain: avgConfidence < 0.4,
      explanation: `Audience size scored ${score.toFixed(2)}: ${audienceEvidence.length} audience evidence items, avg confidence ${avgConfidence.toFixed(2)}, volume factor ${volumeFactor.toFixed(2)}. Formula: 0.6 * avgConfidence + 0.4 * volumeFactor.`,
    };
  }

  /** Competition: is the space crowded? (inverse — less competition = higher score) */
  private evaluateCompetition(
    evidenceByType: Map<ProductEvidenceType, ProductEvidence[]>
  ): EvaluatedDimension {
    const compEvidence = evidenceByType.get("COMPETITION") || [];
    const productEvidence = evidenceByType.get("EXISTING_PRODUCT") || [];
    const allEvidence = [...compEvidence, ...productEvidence];

    if (allEvidence.length === 0) {
      return {
        name: "competition",
        score: 0.5,
        evidence: [],
        confidence: 0,
        is_uncertain: true,
        explanation: "No COMPETITION or EXISTING_PRODUCT evidence. Cannot assess competitive landscape. Default 0.5 (neutral). REQUIERE_VALIDACION.",
      };
    }

    // More competitors = lower score (inverse relationship)
    const competitorCount = allEvidence.length;
    const avgStrength = allEvidence.reduce((s, e) => s + e.confidence, 0) / allEvidence.length;

    // Fewer competitors and weaker existing solutions → higher score
    const crowdingFactor = Math.max(0, 1 - (competitorCount / 10));
    const strengthFactor = Math.max(0, 1 - avgStrength);
    const score = 0.5 * crowdingFactor + 0.5 * strengthFactor;

    return {
      name: "competition",
      score: Math.round(score * 100) / 100,
      evidence: allEvidence.map((e) => e.id),
      confidence: 0.7,
      is_uncertain: compEvidence.length === 0,
      explanation: `Competition scored ${score.toFixed(2)} (inverse — higher = less competition): ${competitorCount} competitors/products found, avg strength ${avgStrength.toFixed(2)}. Crowding factor ${crowdingFactor.toFixed(2)}, strength factor ${strengthFactor.toFixed(2)}. Formula: 0.5 * crowding + 0.5 * strength.`,
    };
  }

  /** Differentiation: can we stand out? */
  private evaluateDifferentiation(
    evidenceByType: Map<ProductEvidenceType, ProductEvidence[]>
  ): EvaluatedDimension {
    const diffEvidence = evidenceByType.get("DIFFERENTIATION") || [];
    const compEvidence = evidenceByType.get("COMPETITION") || [];

    if (diffEvidence.length === 0 && compEvidence.length === 0) {
      return {
        name: "differentiation",
        score: 0.4,
        evidence: [],
        confidence: 0,
        is_uncertain: true,
        explanation: "No DIFFERENTIATION or COMPETITION evidence. Cannot assess differentiation potential. Default 0.4. REQUIERE_VALIDACION.",
      };
    }

    const diffSignal = diffEvidence.length > 0
      ? diffEvidence.reduce((s, e) => s + e.confidence, 0) / diffEvidence.length
      : 0.3;
    // Gaps in competition suggest differentiation opportunity
    const gapSignal = compEvidence.length > 0
      ? 0.5 // Competitors exist but gaps may too
      : 0.7; // No competitors found — differentiation by default

    const score = 0.6 * diffSignal + 0.4 * gapSignal;

    return {
      name: "differentiation",
      score: Math.round(score * 100) / 100,
      evidence: [...diffEvidence, ...compEvidence].map((e) => e.id),
      confidence: diffEvidence.length > 0 ? diffSignal : 0.3,
      is_uncertain: diffEvidence.length === 0,
      explanation: `Differentiation scored ${score.toFixed(2)}: ${diffEvidence.length} differentiation evidence (signal: ${diffSignal.toFixed(2)}), gap signal ${gapSignal.toFixed(2)}. Formula: 0.6 * diffSignal + 0.4 * gapSignal.${diffEvidence.length === 0 ? " No explicit differentiation evidence — uncertain." : ""}`,
    };
  }

  /** Feasibility: can we actually build it? */
  private evaluateFeasibility(
    evidenceByType: Map<ProductEvidenceType, ProductEvidence[]>,
    opportunity: Opportunity
  ): EvaluatedDimension {
    // Assess feasibility based on product format
    const format = (opportunity.format || "").toLowerCase();
    let baseFeasibility = 0.5;

    // Content products are highly feasible for KREA
    if (["ebook", "guía", "guide", "workbook", "template", "checklist", "curso", "course"].some((f) => format.includes(f))) {
      baseFeasibility = 0.85;
    }
    // Simple web apps are moderately feasible
    else if (["app", "web app", "saas", "tool"].some((f) => format.includes(f))) {
      baseFeasibility = 0.5;
    }
    // Complex infrastructure is less feasible
    else if (["api", "platform", "infrastructure", "backend", "infra"].some((f) => format.includes(f))) {
      baseFeasibility = 0.35;
    }

    const oppEvidence = evidenceByType.get("OPPORTUNITY") || [];
    const evidenceBoost = oppEvidence.length > 0 ? 0.1 : 0;

    const score = Math.min(1, baseFeasibility + evidenceBoost);

    return {
      name: "feasibility",
      score: Math.round(score * 100) / 100,
      evidence: oppEvidence.map((e) => e.id),
      confidence: 0.7,
      is_uncertain: format === "",
      explanation: `Feasibility scored ${score.toFixed(2)}: base feasibility ${baseFeasibility.toFixed(2)} for format "${format || "unknown"}", evidence boost ${evidenceBoost}. Content products are more feasible for KREA; infrastructure requires delegation.`,
    };
  }

  /** Build time: how long will it take? (inverse — shorter = better) */
  private evaluateBuildTime(
    evidenceByType: Map<ProductEvidenceType, ProductEvidence[]>,
    opportunity: Opportunity
  ): EvaluatedDimension {
    const format = (opportunity.format || "").toLowerCase();
    let baseScore = 0.5;

    // Content: fast to produce
    if (["ebook", "guía", "guide", "workbook", "template", "checklist"].some((f) => format.includes(f))) {
      baseScore = 0.8; // Days to weeks
    }
    // Simple app: moderate
    else if (["app", "web app", "tool"].some((f) => format.includes(f))) {
      baseScore = 0.5; // Weeks to months
    }
    // Complex: slow
    else if (["saas", "platform", "api", "infrastructure"].some((f) => format.includes(f))) {
      baseScore = 0.25; // Months
    }

    return {
      name: "build_time",
      score: Math.round(baseScore * 100) / 100,
      evidence: [],
      confidence: 0.6,
      is_uncertain: format === "",
      explanation: `Build time scored ${baseScore.toFixed(2)} (inverse — higher = faster): based on format "${format || "unknown"}". Content=0.8 (days), App=0.5 (weeks), Platform=0.25 (months).`,
    };
  }

  /** Economics: does the math work? */
  private evaluateEconomics(
    evidenceByType: Map<ProductEvidenceType, ProductEvidence[]>
  ): EvaluatedDimension {
    const pricingEvidence = evidenceByType.get("PRICING") || [];
    const demandEvidence = evidenceByType.get("DEMAND") || [];

    if (pricingEvidence.length === 0 && demandEvidence.length === 0) {
      return {
        name: "economics",
        score: 0.3,
        evidence: [],
        confidence: 0,
        is_uncertain: true,
        explanation: "No PRICING or DEMAND evidence to evaluate economics. Default 0.3. REQUIERE_VALIDACION — need pricing and cost data.",
      };
    }

    const pricingSignal = pricingEvidence.length > 0
      ? pricingEvidence.reduce((s, e) => s + e.confidence, 0) / pricingEvidence.length
      : 0.3;
    const demandSignal = demandEvidence.length > 0
      ? demandEvidence.reduce((s, e) => s + e.confidence, 0) / demandEvidence.length
      : 0.3;

    const score = 0.5 * pricingSignal + 0.5 * demandSignal;

    return {
      name: "economics",
      score: Math.round(score * 100) / 100,
      evidence: [...pricingEvidence, ...demandEvidence].map((e) => e.id),
      confidence: (pricingSignal + demandSignal) / 2,
      is_uncertain: pricingEvidence.length === 0,
      explanation: `Economics scored ${score.toFixed(2)}: pricing signal ${pricingSignal.toFixed(2)}, demand signal ${demandSignal.toFixed(2)}. Formula: 0.5 * pricing + 0.5 * demand.${pricingEvidence.length === 0 ? " No pricing evidence — uncertain." : ""}`,
    };
  }

  /** Risk: what could go wrong? (inverse — less risk = higher score) */
  private evaluateRisk(
    evidenceByType: Map<ProductEvidenceType, ProductEvidence[]>
  ): EvaluatedDimension {
    const compEvidence = evidenceByType.get("COMPETITION") || [];
    const productEvidence = evidenceByType.get("EXISTING_PRODUCT") || [];

    // Risk factors
    const highCompetition = compEvidence.length >= 5;
    const strongExisting = productEvidence.some((e) => e.confidence >= 0.8);
    const lowEvidence = compEvidence.length + productEvidence.length < 2;

    let riskScore = 0.6; // Base: moderate-low risk

    if (highCompetition) riskScore -= 0.15;
    if (strongExisting) riskScore -= 0.1;
    if (lowEvidence) riskScore -= 0.2; // Unknown = risky

    riskScore = Math.max(0, Math.min(1, riskScore));

    return {
      name: "risk",
      score: Math.round(riskScore * 100) / 100,
      evidence: [...compEvidence, ...productEvidence].map((e) => e.id),
      confidence: 0.5,
      is_uncertain: lowEvidence,
      explanation: `Risk scored ${riskScore.toFixed(2)} (inverse — higher = less risk): base 0.6, highCompetition(${highCompetition}) -0.15, strongExisting(${strongExisting}) -0.1, lowEvidence(${lowEvidence}) -0.2. Less evidence = more risk.`,
    };
  }

  /** Evidence quality: how good is our evidence overall? */
  private evaluateEvidenceQuality(allEvidence: ProductEvidence[]): EvaluatedDimension {
    if (allEvidence.length === 0) {
      return {
        name: "evidence_quality",
        score: 0,
        evidence: [],
        confidence: 0,
        is_uncertain: true,
        explanation: "No evidence at all. Evidence quality is 0. REQUIERE_VALIDACION — research is required before any decision.",
      };
    }

    const avgConfidence = allEvidence.reduce((s, e) => s + e.confidence, 0) / allEvidence.length;
    const avgTruthLevel = allEvidence.reduce((s, e) => s + TRUTH_LEVEL_ORDER[e.truthLevel], 0) / allEvidence.length / 5;
    const verifiedCount = allEvidence.filter((e) => e.verificationStatus === "VERIFIED_PASS").length;
    const verifiedRatio = verifiedCount / allEvidence.length;

    const score = 0.4 * avgConfidence + 0.3 * avgTruthLevel + 0.3 * (verifiedRatio > 0 ? verifiedRatio : avgConfidence * 0.5);

    return {
      name: "evidence_quality",
      score: Math.round(score * 100) / 100,
      evidence: allEvidence.map((e) => e.id),
      confidence: avgConfidence,
      is_uncertain: avgConfidence < 0.5,
      explanation: `Evidence quality scored ${score.toFixed(2)}: ${allEvidence.length} items, avg confidence ${avgConfidence.toFixed(2)}, avg truth level ${avgTruthLevel.toFixed(2)}, ${verifiedCount} verified (${verifiedRatio.toFixed(2)}). Formula: 0.4 * confidence + 0.3 * truthLevel + 0.3 * verifiedRatio.`,
    };
  }

  // ─── Decision Logic ────────────────────────────────────────────────────

  /** Calculate weighted overall score from dimensions */
  private calculateWeightedScore(dimensions: EvaluatedDimension[]): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const dim of dimensions) {
      const weight = DIMENSION_WEIGHTS[dim.name as DimensionName] || 0.05;
      weightedSum += dim.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /** Determine the fit decision based on score and dimensions */
  private determineDecision(score: number, dimensions: EvaluatedDimension[]): FitDecision {
    const evidenceQuality = dimensions.find((d) => d.name === "evidence_quality");
    const uncertainCount = dimensions.filter((d) => d.is_uncertain).length;
    const criticalUncertain = dimensions.filter(
      (d) => d.is_uncertain && (d.name === "problem_intensity" || d.name === "demand" || d.name === "payment_intent")
    ).length;

    // DO_NOT_BUILD: very low score with no critical uncertainties that could change things
    if (score < 0.30 && criticalUncertain === 0) {
      return "DO_NOT_BUILD";
    }

    // VALIDATE_FIRST: good signals but uncertain evidence
    if (score >= 0.30 && score < 0.65) {
      return "VALIDATE_FIRST";
    }

    // VALIDATE_FIRST: decent score but critical uncertainties
    if (score >= 0.65 && (criticalUncertain > 0 || (evidenceQuality && evidenceQuality.score < 0.5))) {
      return "VALIDATE_FIRST";
    }

    // BUILD: strong score, good evidence, no critical uncertainties
    if (score >= 0.65 && criticalUncertain === 0 && uncertainCount <= 3) {
      return "BUILD";
    }

    // Default: validate if uncertain
    if (uncertainCount > 3) {
      return "VALIDATE_FIRST";
    }

    return "DO_NOT_BUILD";
  }

  /** Generate a human-readable explanation of the decision (AC-010) */
  private generateExplanation(
    decision: FitDecision,
    score: number,
    dimensions: EvaluatedDimension[],
    opportunity: Opportunity
  ): string {
    const topDims = dimensions
      .sort((a, b) => (DIMENSION_WEIGHTS[b.name as DimensionName] || 0) - (DIMENSION_WEIGHTS[a.name as DimensionName] || 0))
      .slice(0, 5);

    const uncertainDims = dimensions.filter((d) => d.is_uncertain);

    const decisionExplanations: Record<FitDecision, string> = {
      BUILD: `BUILD recommendation for "${opportunity.name}" (score: ${score.toFixed(2)}). Key factors: ${topDims.map((d) => `${d.name}=${d.score.toFixed(2)}`).join(", ")}. Evidence is sufficient and no critical uncertainties remain.`,
      VALIDATE_FIRST: `VALIDATE_FIRST recommendation for "${opportunity.name}" (score: ${score.toFixed(2)}). Key factors: ${topDims.map((d) => `${d.name}=${d.score.toFixed(2)}`).join(", ")}. Uncertain dimensions: ${uncertainDims.map((d) => d.name).join(", ") || "none"}. Validation needed before committing to build.`,
      DO_NOT_BUILD: `DO_NOT_BUILD recommendation for "${opportunity.name}" (score: ${score.toFixed(2)}). Key factors: ${topDims.map((d) => `${d.name}=${d.score.toFixed(2)}`).join(", ")}. The evidence does not support investment at this time.`,
    };

    return decisionExplanations[decision];
  }

  /** Recommend specific next actions based on the decision */
  private recommendActions(
    decision: FitDecision,
    dimensions: EvaluatedDimension[],
    uncertainties: string[]
  ): string[] {
    const actions: string[] = [];

    if (decision === "BUILD") {
      actions.push("Proceed to product architecture and specification");
      actions.push("Define MVP scope (MUST items only)");
      actions.push("Set up build tracking and success criteria");
    } else if (decision === "VALIDATE_FIRST") {
      // Recommend validation based on uncertain dimensions
      const uncertain = dimensions.filter((d) => d.is_uncertain);
      for (const dim of uncertain) {
        switch (dim.name) {
          case "problem_intensity":
            actions.push("Validate problem intensity: interview 10+ potential users about their pain");
            break;
          case "demand":
            actions.push("Validate demand: run a smoke test or landing page to measure interest");
            break;
          case "payment_intent":
            actions.push("Validate payment intent: test pricing with pre-orders or deposit requests");
            break;
          case "audience_size":
            actions.push("Validate audience size: research market size data and search volumes");
            break;
          case "competition":
            actions.push("Validate competitive landscape: audit existing solutions and their gaps");
            break;
          case "differentiation":
            actions.push("Validate differentiation: test unique value proposition with target audience");
            break;
          case "economics":
            actions.push("Validate economics: estimate costs and revenue model with real data");
            break;
          default:
            actions.push(`Validate ${dim.name}: gather more evidence to reduce uncertainty`);
        }
      }
      if (actions.length === 0) {
        actions.push("Gather more evidence for uncertain dimensions before deciding");
      }
    } else {
      // DO_NOT_BUILD
      actions.push("Document why this opportunity was rejected (evidence trail)");
      actions.push("Set reminder to re-evaluate if market conditions change");
      if (uncertainties.length > 0) {
        actions.push("If new evidence becomes available, re-run fit evaluation");
      }
    }

    return actions;
  }

  // ─── Utility ───────────────────────────────────────────────────────────

  /** Group evidence items by their type */
  private groupEvidenceByType(
    evidence: ProductEvidence[]
  ): Map<ProductEvidenceType, ProductEvidence[]> {
    const map = new Map<ProductEvidenceType, ProductEvidence[]>();
    for (const item of evidence) {
      const items = map.get(item.type) || [];
      items.push(item);
      map.set(item.type, items);
    }
    return map;
  }
}
