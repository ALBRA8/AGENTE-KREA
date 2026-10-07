/**
 * Product Decision Engine — KREA V2 Product Brain
 *
 * Makes the final decision on what to do with a product opportunity.
 * Incorporates fit evaluation results, evidence, and constructor selection
 * to determine the appropriate action path.
 *
 * Acceptance Criteria satisfied:
 *   AC-012: Justification must reference specific evidence
 *   AC-013: Constructor selection based on product format
 *
 * Decisions:
 *   DO_NOT_BUILD         — Evidence doesn't support building
 *   RESEARCH_MORE        — Not enough evidence to decide either way
 *   VALIDATE_FIRST       — Promising but needs validation before committing
 *   BUILD_DIRECTLY       — KREA can produce this (content products)
 *   BUILD_WITH_CONSTRUCTOR — Complex hybrid needing KREA + specialist
 *   DELEGATE_TO_SPECIALIST — Outside KREA's scope (Codex/Antigravity)
 */

import { ProductEvidence, ProductEvidenceType } from "./product-intelligence";
import { Opportunity, FitResult, FitDecision, EvaluatedDimension } from "./product-fit";

// ─── Decision Types ───────────────────────────────────────────────────────────

/** The final decision about a product opportunity */
export type ProductDecisionType =
  | "DO_NOT_BUILD"
  | "RESEARCH_MORE"
  | "VALIDATE_FIRST"
  | "BUILD_DIRECTLY"
  | "BUILD_WITH_CONSTRUCTOR"
  | "DELEGATE_TO_SPECIALIST";

/** A reason with supporting evidence */
export interface DecisionReason {
  /** The reason text */
  text: string;
  /** Evidence IDs supporting this reason (AC-012) */
  evidenceIds: string[];
  /** Confidence in this reason */
  confidence: number;
}

/** A risk identified in the decision */
export interface DecisionRisk {
  /** Risk description */
  description: string;
  /** Severity: 0-1 (1 = critical) */
  severity: number;
  /** Evidence supporting this risk assessment */
  evidenceIds: string[];
  /** Mitigation strategy */
  mitigation?: string;
}

/** The next action to take */
export interface NextAction {
  /** Action description */
  action: string;
  /** Who should perform this action */
  assignee: "krea" | "codex" | "antigravity" | "human" | "chismoso";
  /** Priority of this action */
  priority: "critical" | "high" | "medium" | "low";
  /** Estimated effort */
  effort?: "hours" | "days" | "weeks" | "months";
}

/** Complete product decision */
export interface ProductDecision {
  /** The decision */
  decision: ProductDecisionType;
  /** Why this decision was made (AC-012 — references specific evidence) */
  reasons: DecisionReason[];
  /** Evidence referenced in the decision */
  evidence: ProductEvidence[];
  /** Risks identified */
  risks: DecisionRisk[];
  /** What remains uncertain */
  uncertainties: string[];
  /** Next action to take */
  next_action: NextAction;
  /** Constructor selection (if building) */
  constructor?: ConstructorSelection;
  /** Timestamp */
  decidedAt: string;
}

/** Constructor selection result (AC-013) */
export interface ConstructorSelection {
  /** Primary constructor agent */
  primary: "krea" | "codex" | "antigravity";
  /** Supporting constructor (if hybrid) */
  secondary?: "krea" | "codex" | "antigravity";
  /** Why this constructor was selected */
  rationale: string;
  /** What the primary constructor will build */
  scope: string;
}

// ─── Product Format Classifications (AC-013) ──────────────────────────────────

/** Formats KREA can produce directly */
const KREA_DIRECT_FORMATS = [
  "ebook", "guía", "guide", "workbook", "template", "checklist",
  "curso", "course", "manual", "playbook", "blueprint", "framework",
  "infographic", "cheatsheet", "reference", "tutorial",
];

/** Formats requiring specialist construction */
const SPECIALIST_FORMATS = [
  "app", "application", "saas", "software", "platform",
  "backend", "api", "infra", "infrastructure", "service",
  "microservice", "database", "system", "integration",
];

/** Formats that are hybrids (KREA content + specialist tech) */
const HYBRID_FORMATS = [
  "landing page", "web app", "website", "portal", "dashboard",
  "tool", "automation", "bot", "extension", "plugin",
];

// ─── Product Decision Engine ──────────────────────────────────────────────────

/**
 * ProductDecisionEngine — Makes the final product decision.
 *
 * Combines fit evaluation with evidence and format analysis to produce
 * a definitive decision with evidence-backed justification (AC-012)
 * and appropriate constructor selection (AC-013).
 */
export class ProductDecisionEngine {
  /**
   * decide — Make the final product decision.
   *
   * AC-012: Every reason references specific evidence IDs.
   * AC-013: Constructor selected based on product format.
   */
  decide(
    opportunity: Opportunity,
    fitResult: FitResult,
    evidence: ProductEvidence[]
  ): ProductDecision {
    // Step 1: Determine the base decision from fit result
    const baseDecision = this.mapFitToDecision(fitResult);

    // Step 2: Apply constructor selection if building (AC-013)
    const constructor = this.needsConstructor(baseDecision)
      ? this.selectConstructor(opportunity, fitResult)
      : undefined;

    // Step 3: Generate evidence-backed reasons (AC-012)
    const reasons = this.generateReasons(opportunity, fitResult, evidence, baseDecision);

    // Step 4: Identify risks
    const risks = this.identifyRisks(fitResult, evidence);

    // Step 5: Determine next action
    const next_action = this.determineNextAction(baseDecision, constructor, fitResult);

    // Step 6: Collect uncertainties
    const uncertainties = [...fitResult.uncertainties];

    return {
      decision: baseDecision,
      reasons,
      evidence,
      risks,
      uncertainties,
      next_action,
      constructor,
      decidedAt: new Date().toISOString(),
    };
  }

  // ─── Decision Mapping ──────────────────────────────────────────────────

  /** Map fit decision to product decision type */
  private mapFitToDecision(fitResult: FitResult): ProductDecisionType {
    switch (fitResult.decision) {
      case "DO_NOT_BUILD":
        // If evidence quality is very low, we might need more research
        const evidenceQuality = fitResult.dimensions.find((d) => d.name === "evidence_quality");
        if (evidenceQuality && evidenceQuality.score < 0.2 && evidenceQuality.is_uncertain) {
          return "RESEARCH_MORE";
        }
        return "DO_NOT_BUILD";

      case "VALIDATE_FIRST":
        return "VALIDATE_FIRST";

      case "BUILD":
        // BUILD from fit engine — but we need to determine HOW to build
        // This will be refined by constructor selection
        return "BUILD_DIRECTLY";

      default:
        return "RESEARCH_MORE";
    }
  }

  /** Whether this decision needs constructor selection */
  private needsConstructor(decision: ProductDecisionType): boolean {
    return ["BUILD_DIRECTLY", "BUILD_WITH_CONSTRUCTOR", "DELEGATE_TO_SPECIALIST"].includes(decision);
  }

  // ─── Constructor Selection (AC-013) ─────────────────────────────────────

  /**
   * selectConstructor — Choose the right builder based on product format.
   *
   * AC-013:
   *   - eBook/guía/workbook/template → BUILD_DIRECTLY (KREA can produce)
   *   - App/SaaS/backend/API/infra → DELEGATE_TO_SPECIALIST (Codex/Antigravity)
   *   - Complex hybrid → BUILD_WITH_CONSTRUCTOR (KREA + specialist)
   */
  selectConstructor(
    opportunity: Opportunity,
    fitResult: FitResult
  ): ConstructorSelection {
    const format = (opportunity.format || "").toLowerCase();

    // Check if KREA can build this directly
    if (KREA_DIRECT_FORMATS.some((f) => format.includes(f))) {
      return {
        primary: "krea",
        rationale: `Product format "${format}" is a content product that KREA can produce directly (eBook, guide, template, etc.). No specialist construction needed.`,
        scope: "Full product: content, design, structure, and packaging",
      };
    }

    // Check if this needs specialist construction
    if (SPECIALIST_FORMATS.some((f) => format.includes(f))) {
      return {
        primary: "codex",
        secondary: "antigravity",
        rationale: `Product format "${format}" requires software construction. Codex handles code/architecture, Antigravity handles design/UX. KREA provides product specification and acceptance criteria.`,
        scope: "Software architecture, implementation, and deployment",
      };
    }

    // Check if this is a hybrid
    if (HYBRID_FORMATS.some((f) => format.includes(f))) {
      return {
        primary: "krea",
        secondary: "codex",
        rationale: `Product format "${format}" is a hybrid: KREA produces content/copy/design, Codex handles technical implementation. KREA leads product direction.`,
        scope: "Content, copy, design direction, and product specification",
      };
    }

    // Default: if format is unclear, lean toward hybrid
    return {
      primary: "krea",
      secondary: "codex",
      rationale: `Product format "${format || "unspecified"}" is ambiguous. Defaulting to hybrid: KREA produces content and specification, Codex handles technical needs if required. Re-evaluate after architecture phase.`,
      scope: "Product specification and content creation",
    };
  }

  // ─── Reason Generation (AC-012) ────────────────────────────────────────

  /**
   * generateReasons — Create evidence-backed reasons for the decision.
   *
   * AC-012: Every reason must reference specific evidence IDs.
   */
  private generateReasons(
    opportunity: Opportunity,
    fitResult: FitResult,
    evidence: ProductEvidence[],
    decision: ProductDecisionType
  ): DecisionReason[] {
    const reasons: DecisionReason[] = [];

    // Overall score reason
    const topEvidenceIds = fitResult.evidence_used
      .slice(0, 5)
      .map((e) => e.id);

    reasons.push({
      text: `Overall fit score is ${fitResult.score.toFixed(2)} (threshold: BUILD >= 0.65, VALIDATE >= 0.30, DO_NOT_BUILD < 0.30). Decision: ${decision}.`,
      evidenceIds: topEvidenceIds,
      confidence: fitResult.score,
    });

    // Key dimension reasons (top 3 most weighted)
    const sortedDims = [...fitResult.dimensions].sort(
      (a, b) => b.score - a.score
    );

    for (const dim of sortedDims.slice(0, 3)) {
      const dimEvidenceIds = dim.evidence.length > 0
        ? dim.evidence
        : topEvidenceIds;

      reasons.push({
        text: `${dim.name}: scored ${dim.score.toFixed(2)} (confidence: ${dim.confidence.toFixed(2)}${dim.is_uncertain ? ", UNCERTAIN" : ""}). ${dim.explanation}`,
        evidenceIds: dimEvidenceIds,
        confidence: dim.confidence,
      });
    }

    // Decision-specific reasons
    switch (decision) {
      case "DO_NOT_BUILD":
        const lowDemandEvidence = evidence.filter((e) => e.type === "DEMAND" && e.confidence < 0.4);
        const highCompEvidence = evidence.filter((e) => e.type === "COMPETITION" && e.confidence >= 0.7);
        reasons.push({
          text: `Insufficient evidence to proceed. ${lowDemandEvidence.length > 0 ? "Low demand signals detected." : ""} ${highCompEvidence.length > 0 ? "Strong competition identified." : ""} Score ${fitResult.score.toFixed(2)} is below build threshold.`,
          evidenceIds: [...lowDemandEvidence, ...highCompEvidence].map((e) => e.id).concat(topEvidenceIds),
          confidence: 0.8,
        });
        break;

      case "RESEARCH_MORE":
        reasons.push({
          text: `Evidence quality too low to make a decision. ${fitResult.uncertainties.length} uncertainties identified. More research needed before committing resources.`,
          evidenceIds: topEvidenceIds,
          confidence: 0.7,
        });
        break;

      case "VALIDATE_FIRST":
        const uncertainDims = fitResult.dimensions.filter((d) => d.is_uncertain);
        reasons.push({
          text: `Good potential (score: ${fitResult.score.toFixed(2)}) but ${uncertainDims.length} uncertain dimensions require validation before building. Key uncertainties: ${uncertainDims.map((d) => d.name).join(", ")}.`,
          evidenceIds: uncertainDims.flatMap((d) => d.evidence).concat(topEvidenceIds),
          confidence: 0.7,
        });
        break;

      case "BUILD_DIRECTLY":
        const problemEvidence = evidence.filter((e) => e.type === "PROBLEM");
        reasons.push({
          text: `Strong evidence supports building. Problem is well-defined${problemEvidence.length > 0 ? ` (${problemEvidence.length} problem evidence items)` : ""}, demand is confirmed, and KREA can produce this format directly.`,
          evidenceIds: problemEvidence.map((e) => e.id).concat(topEvidenceIds),
          confidence: 0.85,
        });
        break;

      case "BUILD_WITH_CONSTRUCTOR":
        reasons.push({
          text: `Product requires hybrid construction: KREA for content/definition, specialist for technical implementation. Score ${fitResult.score.toFixed(2)} supports investment.`,
          evidenceIds: topEvidenceIds,
          confidence: 0.75,
        });
        break;

      case "DELEGATE_TO_SPECIALIST":
        reasons.push({
          text: `Product format requires specialist construction (Codex/Antigravity). KREA provides specification and acceptance criteria, specialist handles build. Score ${fitResult.score.toFixed(2)} supports investment.`,
          evidenceIds: topEvidenceIds,
          confidence: 0.7,
        });
        break;
    }

    return reasons;
  }

  // ─── Risk Identification ───────────────────────────────────────────────

  /** Identify risks from fit evaluation and evidence */
  private identifyRisks(
    fitResult: FitResult,
    evidence: ProductEvidence[]
  ): DecisionRisk[] {
    const risks: DecisionRisk[] = [];

    // Competition risk
    const compEvidence = evidence.filter((e) => e.type === "COMPETITION");
    if (compEvidence.length >= 5) {
      risks.push({
        description: `High competition: ${compEvidence.length} competitors identified`,
        severity: 0.7,
        evidenceIds: compEvidence.map((e) => e.id),
        mitigation: "Focus on specific niche or differentiator within the market",
      });
    }

    // Evidence quality risk
    const evidenceQuality = fitResult.dimensions.find((d) => d.name === "evidence_quality");
    if (evidenceQuality && evidenceQuality.score < 0.4) {
      risks.push({
        description: `Low evidence quality (${evidenceQuality.score.toFixed(2)}) — decisions may be based on assumptions`,
        severity: 0.6,
        evidenceIds: evidenceQuality.evidence,
        mitigation: "Invest in validation before committing significant resources",
      });
    }

    // Uncertainty risk
    const uncertainCount = fitResult.dimensions.filter((d) => d.is_uncertain).length;
    if (uncertainCount >= 4) {
      risks.push({
        description: `${uncertainCount} dimensions are uncertain — many unknowns could invalidate the opportunity`,
        severity: 0.5,
        evidenceIds: [],
        mitigation: "Run targeted validation experiments for each uncertain dimension",
      });
    }

    // Economic risk
    const economics = fitResult.dimensions.find((d) => d.name === "economics");
    if (economics && economics.score < 0.4) {
      risks.push({
        description: `Weak economics (${economics.score.toFixed(2)}) — may not be financially viable`,
        severity: 0.8,
        evidenceIds: economics.evidence,
        mitigation: "Validate pricing model and cost structure with real data",
      });
    }

    // Feasibility risk
    const feasibility = fitResult.dimensions.find((d) => d.name === "feasibility");
    if (feasibility && feasibility.score < 0.4) {
      risks.push({
        description: `Low feasibility (${feasibility.score.toFixed(2)}) — may be difficult or expensive to build`,
        severity: 0.6,
        evidenceIds: feasibility.evidence,
        mitigation: "Scope down to MVP, consider phased approach or delegation",
      });
    }

    return risks;
  }

  // ─── Next Action ───────────────────────────────────────────────────────

  /** Determine the next action based on decision and constructor */
  private determineNextAction(
    decision: ProductDecisionType,
    constructor: ConstructorSelection | undefined,
    fitResult: FitResult
  ): NextAction {
    switch (decision) {
      case "DO_NOT_BUILD":
        return {
          action: "Document rejection reasons and archive opportunity",
          assignee: "krea",
          priority: "low",
          effort: "hours",
        };

      case "RESEARCH_MORE":
        return {
          action: "Conduct targeted research on uncertain dimensions: " + fitResult.uncertainties.slice(0, 3).join(", "),
          assignee: "krea",
          priority: "high",
          effort: "days",
        };

      case "VALIDATE_FIRST":
        return {
          action: fitResult.recommended_actions[0] || "Run validation experiments for uncertain dimensions",
          assignee: "human",
          priority: "high",
          effort: "weeks",
        };

      case "BUILD_DIRECTLY":
        return {
          action: "Create product architecture and specification",
          assignee: "krea",
          priority: "high",
          effort: "days",
        };

      case "BUILD_WITH_CONSTRUCTOR":
        return {
          action: `Create product architecture (KREA) and handoff specification to ${constructor?.secondary || "codex"}`,
          assignee: "krea",
          priority: "high",
          effort: "weeks",
        };

      case "DELEGATE_TO_SPECIALIST":
        return {
          action: `Generate handoff contract for ${constructor?.primary || "codex"} with complete product specification`,
          assignee: "krea",
          priority: "high",
          effort: "days",
        };
    }
  }
}
