/**
 * Product Decision — Product Brain Module
 *
 * Makes the GO/NO-GO decision based on FitScore.
 * Decision logic is DETERMINISTIC — based entirely on FitScore thresholds.
 * No LLM calls. No invented data. Must reference the FitScore.
 *
 * Rules:
 *   GO:              overall >= 0.7 AND no individual score < 0.4
 *   CONDITIONAL_GO:  overall >= 0.5 AND not meeting GO criteria
 *   NO_GO:           overall < 0.5 OR any critical score < 0.3
 */

import type { FitScore, EvidenceTag } from "@/lib/product-fit";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductDecision {
  decision: "GO" | "NO_GO" | "CONDITIONAL_GO";
  conditions: string[]; // Required conditions for CONDITIONAL_GO
  rationale: string;
  fitScore: FitScore;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  estimatedEffort: string;
  evidence: EvidenceTag;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

const THRESHOLDS = {
  GO_OVERALL: 0.7,
  CONDITIONAL_GO_OVERALL: 0.5,
  MIN_INDIVIDUAL_FOR_GO: 0.4,
  CRITICAL_SCORE_FLOOR: 0.3,
} as const;

// ─── Effort Estimation ────────────────────────────────────────────────────────

const EFFORT_BY_DOMAIN: Record<string, { low: string; medium: string; high: string }> = {
  ebook: { low: "1-2 weeks", medium: "2-4 weeks", high: "4-8 weeks" },
  software: { low: "2-4 weeks", medium: "1-3 months", high: "3-6 months" },
  saas: { low: "1-2 months", medium: "3-6 months", high: "6-12 months" },
  guide: { low: "3-5 days", medium: "1-2 weeks", high: "2-4 weeks" },
  template: { low: "1-3 days", medium: "3-7 days", high: "1-2 weeks" },
  kit: { low: "1-2 weeks", medium: "2-4 weeks", high: "1-3 months" },
};

const DEFAULT_EFFORT = { low: "1-2 weeks", medium: "2-4 weeks", high: "4-8 weeks" };

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Make a GO/NO-GO decision based on a FitScore.
 *
 * This function is purely deterministic — it does NOT use LLM.
 * It evaluates the FitScore against thresholds and returns a decision.
 * All data comes from the FitScore — nothing is invented.
 */
export function makeProductDecision(fitScore: FitScore): ProductDecision {
  const scores = extractScores(fitScore);
  const minScore = Math.min(...scores);
  const hasCriticalScore = scores.some((s) => s < THRESHOLDS.CRITICAL_SCORE_FLOOR);

  // Decision logic (deterministic)
  const decision = determineDecision(fitScore.overall, minScore, hasCriticalScore);

  // Build conditions for CONDITIONAL_GO
  const conditions = decision === "CONDITIONAL_GO"
    ? buildConditions(fitScore)
    : [];

  // Assess risk level
  const riskLevel = assessRiskLevel(fitScore.overall, minScore, hasCriticalScore);

  // Estimate effort based on domain and overall score
  const estimatedEffort = estimateEffort(
    fitScore.overall,
    (fitScore as any).domain || "unknown"
  );

  // Build rationale
  const rationale = buildRationale(decision, fitScore, minScore, hasCriticalScore, conditions);

  // Evidence inherits from FitScore (we don't create new data)
  const evidence: EvidenceTag = fitScore.evidence;

  return {
    decision,
    conditions,
    rationale,
    fitScore,
    riskLevel,
    estimatedEffort,
    evidence,
  };
}

/**
 * Check if a decision allows proceeding (GO or CONDITIONAL_GO).
 */
export function isProceedable(decision: ProductDecision): boolean {
  return decision.decision === "GO" || decision.decision === "CONDITIONAL_GO";
}

/**
 * Get the priority actions for a decision.
 * For GO: proceed to architecture.
 * For CONDITIONAL_GO: address conditions first.
 * For NO_GO: research more or abandon.
 */
export function getNextActions(decision: ProductDecision): string[] {
  switch (decision.decision) {
    case "GO":
      return [
        "Proceed to product architecture design",
        "Begin specification process",
        "Start economic analysis",
      ];
    case "CONDITIONAL_GO":
      return [
        "Address the following conditions before proceeding:",
        ...decision.conditions.map((c) => `  - ${c}`),
        "Then re-evaluate with updated FitScore",
      ];
    case "NO_GO":
      if (decision.fitScore.overall >= 0.3) {
        return [
          "Research more — the opportunity has potential but needs validation",
          "Gather market data to improve scores",
          "Consider pivoting the approach or target audience",
        ];
      }
      return [
        "Opportunity does not meet viability thresholds",
        "Consider archiving or revisiting with different parameters",
        "Document lessons learned",
      ];
    default:
      return [];
  }
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function determineDecision(
  overall: number,
  minScore: number,
  hasCriticalScore: boolean
): ProductDecision["decision"] {
  // NO_GO: overall < 0.5 or any critical score < 0.3
  if (overall < THRESHOLDS.CONDITIONAL_GO_OVERALL || hasCriticalScore) {
    return "NO_GO";
  }

  // GO: overall >= 0.7 AND no individual score < 0.4
  if (overall >= THRESHOLDS.GO_OVERALL && minScore >= THRESHOLDS.MIN_INDIVIDUAL_FOR_GO) {
    return "GO";
  }

  // CONDITIONAL_GO: overall >= 0.5 but not meeting GO criteria
  return "CONDITIONAL_GO";
}

function buildConditions(fitScore: FitScore): string[] {
  const conditions: string[] = [];

  if (fitScore.marketExistence < THRESHOLDS.MIN_INDIVIDUAL_FOR_GO) {
    conditions.push(
      `Market existence score (${fitScore.marketExistence}) is below threshold (${THRESHOLDS.MIN_INDIVIDUAL_FOR_GO}). Validate market demand.`
    );
  }

  if (fitScore.audienceClarity < THRESHOLDS.MIN_INDIVIDUAL_FOR_GO) {
    conditions.push(
      `Audience clarity score (${fitScore.audienceClarity}) is below threshold (${THRESHOLDS.MIN_INDIVIDUAL_FOR_GO}). Define target audience more precisely.`
    );
  }

  if (fitScore.problemValidity < THRESHOLDS.MIN_INDIVIDUAL_FOR_GO) {
    conditions.push(
      `Problem validity score (${fitScore.problemValidity}) is below threshold (${THRESHOLDS.MIN_INDIVIDUAL_FOR_GO}). Validate the problem statement.`
    );
  }

  if (fitScore.differentiation < THRESHOLDS.MIN_INDIVIDUAL_FOR_GO) {
    conditions.push(
      `Differentiation score (${fitScore.differentiation}) is below threshold (${THRESHOLDS.MIN_INDIVIDUAL_FOR_GO}). Identify unique value proposition.`
    );
  }

  if (fitScore.feasibility < THRESHOLDS.MIN_INDIVIDUAL_FOR_GO) {
    conditions.push(
      `Feasibility score (${fitScore.feasibility}) is below threshold (${THRESHOLDS.MIN_INDIVIDUAL_FOR_GO}). Assess technical and resource feasibility.`
    );
  }

  if (conditions.length === 0) {
    conditions.push(
      `Overall score (${fitScore.overall}) is below GO threshold (${THRESHOLDS.GO_OVERALL}). Improve individual scores to reach GO.`
    );
  }

  return conditions;
}

function assessRiskLevel(
  overall: number,
  minScore: number,
  hasCriticalScore: boolean
): ProductDecision["riskLevel"] {
  if (hasCriticalScore) return "CRITICAL";
  if (minScore < 0.35) return "HIGH";
  if (overall < THRESHOLDS.GO_OVERALL || minScore < THRESHOLDS.MIN_INDIVIDUAL_FOR_GO) return "MEDIUM";
  return "LOW";
}

function estimateEffort(overall: number, domain: string): string {
  const effortMap = EFFORT_BY_DOMAIN[domain] || DEFAULT_EFFORT;

  if (overall >= 0.8) return effortMap.low;
  if (overall >= 0.5) return effortMap.medium;
  return effortMap.high;
}

function buildRationale(
  decision: ProductDecision["decision"],
  fitScore: FitScore,
  minScore: number,
  hasCriticalScore: boolean,
  conditions: string[]
): string {
  const parts: string[] = [];

  parts.push(`Decision: ${decision}`);
  parts.push(`Overall fit score: ${fitScore.overall} (thresholds: GO≥${THRESHOLDS.GO_OVERALL}, COND≥${THRESHOLDS.CONDITIONAL_GO_OVERALL})`);
  parts.push(`Minimum individual score: ${minScore} (GO requires ≥${THRESHOLDS.MIN_INDIVIDUAL_FOR_GO})`);

  if (hasCriticalScore) {
    parts.push("CRITICAL: At least one individual score is below 0.3, indicating a fundamental gap.");
  }

  parts.push("Score breakdown:");
  parts.push(`  Market existence: ${fitScore.marketExistence}`);
  parts.push(`  Audience clarity: ${fitScore.audienceClarity}`);
  parts.push(`  Problem validity: ${fitScore.problemValidity}`);
  parts.push(`  Differentiation: ${fitScore.differentiation}`);
  parts.push(`  Feasibility: ${fitScore.feasibility}`);

  if (fitScore.reasoning) {
    parts.push(`Analysis reasoning: ${fitScore.reasoning}`);
  }

  if (conditions.length > 0) {
    parts.push("Conditions to address:");
    conditions.forEach((c) => parts.push(`  - ${c}`));
  }

  return parts.join("\n");
}

function extractScores(fitScore: FitScore): number[] {
  return [
    fitScore.marketExistence,
    fitScore.audienceClarity,
    fitScore.problemValidity,
    fitScore.differentiation,
    fitScore.feasibility,
  ];
}
