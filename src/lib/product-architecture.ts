/**
 * Product Architecture Engine — KREA V2 Product Brain
 *
 * Designs the product architecture from opportunity, decision, and evidence.
 * Produces a complete ProductArchitecture that defines WHAT to build,
 * for WHOM, WHY, and with what SCOPE boundaries.
 *
 * Acceptance Criteria satisfied:
 *   AC-015: Explicit MUST/SHOULD/COULD/OUT scope boundary
 *          Must prevent unbounded scope creep
 *
 * The architecture includes:
 *   - Jobs To Be Done (JTBD) framework
 *   - Value proposition
 *   - MoSCoW scope (MUST/SHOULD/COULD/OUT)
 *   - MVP definition
 *   - Validation requirements
 *   - Success criteria
 */

import ZAI from "z-ai-web-dev-sdk";
import { ProductEvidence, ProductEvidenceType } from "./product-intelligence";
import { Opportunity } from "./product-fit";
import { ProductDecision, ProductDecisionType, ConstructorSelection } from "./product-decision";
import { MemoryManager } from "@/lib/memory";
import { ExecutionTracer } from "@/lib/execution";

// ─── Types ────────────────────────────────────────────────────────────────────

/** MoSCoW priority item */
export interface MoscowItem {
  /** Item description */
  description: string;
  /** Rationale for this priority */
  rationale: string;
  /** Evidence supporting this item */
  evidenceIds: string[];
  /** Estimated effort */
  effort?: "hours" | "days" | "weeks";
  /** Whether this is part of MVP */
  inMvp: boolean;
}

/** Jobs To Be Done */
export interface JobToBeDone {
  /** The job statement: "When [situation], I want to [motivation], so I can [outcome]" */
  statement: string;
  /** Situation context */
  situation: string;
  /** Motivation */
  motivation: string;
  /** Desired outcome */
  outcome: string;
  /** Priority of this job */
  priority: "primary" | "secondary" | "tertiary";
}

/** Validation requirement */
export interface ValidationRequirement {
  /** What needs to be validated */
  what: string;
  /** How to validate it */
  how: string;
  /** Success criteria */
  successCriteria: string;
  /** Minimum sample size or threshold */
  threshold?: string;
  /** Priority */
  priority: "critical" | "high" | "medium";
}

/** Build requirement */
export interface BuildRequirement {
  /** What needs to be built */
  what: string;
  /** Technical specification or constraints */
  specification: string;
  /** Dependencies */
  dependencies: string[];
  /** Estimated effort */
  effort: "hours" | "days" | "weeks" | "months";
}

/** Complete product architecture */
export interface ProductArchitecture {
  /** Client or target market */
  client: string;
  /** Problem statement */
  problem: string;
  /** Jobs To Be Done */
  jtbd: JobToBeDone[];
  /** Desired outcome */
  desired_outcome: string;
  /** Value proposition */
  value_proposition: string;
  /** Product format */
  format: string;
  /** Scope definition */

  /** AC-015: MUST items — non-negotiable for launch */
  MUST: MoscowItem[];
  /** AC-015: SHOULD items — important but not blocking */
  SHOULD: MoscowItem[];
  /** AC-015: COULD items — nice to have */
  COULD: MoscowItem[];
  /** AC-015: OUT items — explicitly excluded to prevent scope creep */
  OUT: MoscowItem[];

  /** UX description */
  ux_description: string;
  /** Differentiation strategy */
  differentiation: string;
  /** Monetization model */
  monetization: string;
  /** MVP definition (subset of MUST items) */
  mvp_definition: {
    /** MVP scope description */
    scope: string;
    /** MVP items (must be subset of MUST) */
    items: MoscowItem[];
    /** Time box for MVP */
    timebox: string;
    /** Success metrics for MVP */
    successMetrics: string[];
  };
  /** Dependencies */
  dependencies: string[];
  /** Risks */
  risks: string[];
  /** Assumptions */
  assumptions: string[];
  /** Unknowns that need resolution */
  unknowns: string[];
  /** Validation requirements */
  validation_requirements: ValidationRequirement[];
  /** Build requirements */
  build_requirements: BuildRequirement[];
  /** Success criteria */
  success_criteria: string[];
  /** Architecture timestamp */
  architectedAt: string;
}

// ─── Product Architecture Engine ──────────────────────────────────────────────

/**
 * ProductArchitectureEngine — Designs the complete product architecture.
 *
 * AC-015: The MUST/SHOULD/COULD/OUT boundary is explicit and enforced.
 *         OUT items prevent scope creep by making exclusions visible.
 *         MVP is defined as a subset of MUST items only.
 */
type ArchZAIInstance = Awaited<ReturnType<typeof ZAI.create>>;

export class ProductArchitectureEngine {
  private memory: MemoryManager;
  private tracer: ExecutionTracer;
  private zai: ArchZAIInstance | null = null;

  constructor(memory?: MemoryManager, tracer?: ExecutionTracer) {
    this.memory = memory || new MemoryManager();
    this.tracer = tracer || new ExecutionTracer();
  }

  private async getZAI(): Promise<ArchZAIInstance> {
    if (!this.zai) {
      this.zai = await ZAI.create();
    }
    return this.zai;
  }

  /**
   * architect — Design the product architecture.
   *
   * Produces a complete ProductArchitecture with:
   *   - JTBD framework
   *   - Value proposition
   *   - MoSCoW scope (AC-015)
   *   - MVP definition
   *   - Validation and build requirements
   *   - Success criteria
   */
  async architect(
    opportunity: Opportunity,
    decision: ProductDecision,
    evidence: ProductEvidence[]
  ): Promise<ProductArchitecture> {
    const executionId = await this.tracer.start("product_architecture:architect", {
      inputs: { opportunity: opportunity.name, decision: decision.decision },
    });

    try {
      const zai = await this.getZAI();

      // AI-powered architecture design
      const response = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a product architect. Design a complete product architecture for the given opportunity.

Your response MUST be valid JSON with this structure:
{
  "jtbd": [{ "situation": "...", "motivation": "...", "outcome": "...", "priority": "primary|secondary|tertiary" }],
  "value_proposition": "...",
  "desired_outcome": "...",
  "ux_description": "...",
  "differentiation": "...",
  "monetization": "...",
  "MUST": [{ "description": "...", "rationale": "...", "effort": "hours|days|weeks", "inMvp": true }],
  "SHOULD": [{ "description": "...", "rationale": "...", "effort": "hours|days|weeks", "inMvp": false }],
  "COULD": [{ "description": "...", "rationale": "...", "effort": "hours|days|weeks", "inMvp": false }],
  "OUT": [{ "description": "...", "rationale": "...", "effort": "hours|days|weeks", "inMvp": false }],
  "risks": ["..."],
  "assumptions": ["..."],
  "unknowns": ["..."],
  "success_criteria": ["..."]
}

CRITICAL RULES (AC-015 - Scope Control):
1. MUST items are NON-NEGOTIABLE for launch — without them, the product doesn't solve the core problem
2. SHOULD items are important but the product launches without them
3. COULD items are nice-to-have — only if time permits
4. OUT items are EXPLICITLY EXCLUDED — they prevent scope creep
5. Every OUT item needs a rationale explaining WHY it's excluded
6. MVP MUST be a subset of MUST items only
7. Include at least 2 OUT items to demonstrate scope boundary awareness`,
          },
          {
            role: "user",
            content: `Opportunity: ${opportunity.name}
Domain: ${opportunity.domain}
Problem: ${opportunity.problem}
Solution: ${opportunity.solution}
Audience: ${opportunity.audience}
Format: ${opportunity.format || "unspecified"}
Decision: ${decision.decision}

Evidence summary:
${evidence.slice(0, 10).map((e) => `- [${e.type}] ${e.content.substring(0, 100)}`).join("\n")}

Design the product architecture with explicit scope boundaries.`,
          },
        ],
      });

      const archText = response.choices[0]?.message?.content || "";
      const parsed = this.parseArchitectureResponse(archText);

      // Build the complete architecture
      const architecture = this.buildArchitecture(
        opportunity,
        decision,
        evidence,
        parsed
      );

      // Persist to memory
      await this.memory.store(
        "krea",
        `product:${opportunity.domain}:architecture`,
        "SEMANTIC",
        {
          opportunity: opportunity.name,
          decision: decision.decision,
          mustCount: architecture.MUST.length,
          shouldCount: architecture.SHOULD.length,
          couldCount: architecture.COULD.length,
          outCount: architecture.OUT.length,
          mvpItems: architecture.mvp_definition.items.length,
        },
        {
          source: "product_architecture_engine",
          sourceType: "AGENT",
          confidence: 0.8,
          truthLevel: "ESTIMATED",
          scope: "agent",
        }
      );

      await this.tracer.succeed(executionId, {
        mustCount: architecture.MUST.length,
        outCount: architecture.OUT.length,
      });

      return architecture;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.tracer.fail(executionId, { message: err.message, outputs: {} });

      // Fallback: produce a minimal architecture from the opportunity
      return this.fallbackArchitecture(opportunity, decision, evidence);
    }
  }

  // ─── Architecture Construction ─────────────────────────────────────────

  /** Parse the AI response into structured architecture parts */
  private parseArchitectureResponse(text: string): Partial<ProductArchitecture> {
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }
    } catch {
      // Parse failed — will use fallback
    }
    return {};
  }

  /** Build the complete ProductArchitecture from parsed parts */
  private buildArchitecture(
    opportunity: Opportunity,
    decision: ProductDecision,
    evidence: ProductEvidence[],
    parsed: Partial<ProductArchitecture>
  ): ProductArchitecture {
    const evidenceIds = evidence.map((e) => e.id);

    // JTBD
    const jtbd: JobToBeDone[] = (parsed.jtbd || []).map((j: Record<string, unknown>) => ({
      statement: `When ${j.situation || "context"}, I want to ${j.motivation || "action"}, so I can ${j.outcome || "result"}`,
      situation: String(j.situation || ""),
      motivation: String(j.motivation || ""),
      outcome: String(j.outcome || ""),
      priority: (["primary", "secondary", "tertiary"].includes(String(j.priority)) ? j.priority : "primary") as JobToBeDone["priority"],
    }));

    if (jtbd.length === 0) {
      jtbd.push({
        statement: `When facing ${opportunity.problem}, I want to ${opportunity.solution}, so I can solve my problem effectively`,
        situation: opportunity.problem,
        motivation: opportunity.solution,
        outcome: "Effective problem resolution",
        priority: "primary",
      });
    }

    // MoSCoW items (AC-015)
    const MUST: MoscowItem[] = this.buildMoscowItems(parsed.MUST, [
      {
        description: `Core problem solution: ${opportunity.solution}`,
        rationale: "Solves the primary problem identified in the opportunity",
        evidenceIds,
        effort: "weeks",
        inMvp: true,
      },
    ], true, evidenceIds);

    const SHOULD: MoscowItem[] = this.buildMoscowItems(parsed.SHOULD, [], false, evidenceIds);

    const COULD: MoscowItem[] = this.buildMoscowItems(parsed.COULD, [], false, evidenceIds);

    // OUT items — AC-015: explicitly excluded to prevent scope creep
    const OUT: MoscowItem[] = this.buildMoscowItems(parsed.OUT, [
      {
        description: "Features not related to the core problem statement",
        rationale: "Scope boundary — anything not directly addressing the core problem is OUT to prevent scope creep (AC-015)",
        evidenceIds: [],
        effort: "weeks",
        inMvp: false,
      },
      {
        description: "Multi-language support (unless core problem is language-specific)",
        rationale: "Internationalization is a post-MVP concern. Including it now violates scope control (AC-015)",
        evidenceIds: [],
        effort: "months",
        inMvp: false,
      },
    ], false, evidenceIds);

    // MVP definition — subset of MUST items only (AC-015)
    const mvpItems = MUST.filter((item) => item.inMvp);
    const mvp_definition = {
      scope: `MVP: Core problem solution for ${opportunity.audience}`,
      items: mvpItems.length > 0 ? mvpItems : MUST.slice(0, 1),
      timebox: this.estimateMvpTimebox(opportunity, decision),
      successMetrics: (parsed.success_criteria as string[]) || [
        "Users can solve the core problem end-to-end",
        "Positive feedback from target audience",
        "Engagement metrics meet minimum threshold",
      ],
    };

    return {
      client: opportunity.audience,
      problem: opportunity.problem,
      jtbd,
      desired_outcome: parsed.desired_outcome || `Effectively solve ${opportunity.problem} for ${opportunity.audience}`,
      value_proposition: parsed.value_proposition || `${opportunity.solution} — the most effective way for ${opportunity.audience} to solve ${opportunity.problem}`,
      format: opportunity.format || "unspecified",
      MUST,
      SHOULD,
      COULD,
      OUT,
      ux_description: parsed.ux_description || `Clean, focused interface that guides ${opportunity.audience} through solving ${opportunity.problem} with minimal friction`,
      differentiation: parsed.differentiation || this.inferDifferentiation(evidence),
      monetization: parsed.monetization || this.inferMonetization(opportunity, evidence),
      mvp_definition,
      dependencies: this.inferDependencies(opportunity, decision),
      risks: (parsed.risks as string[]) || this.inferRisks(evidence),
      assumptions: (parsed.assumptions as string[]) || [
        `The problem (${opportunity.problem}) is real and painful for ${opportunity.audience}`,
        `The proposed solution (${opportunity.solution}) effectively addresses the problem`,
        `${opportunity.audience} is willing to adopt a new solution`,
      ],
      unknowns: (parsed.unknowns as string[]) || decision.uncertainties,
      validation_requirements: this.buildValidationRequirements(decision, evidence),
      build_requirements: this.buildBuildRequirements(opportunity, decision, MUST),
      success_criteria: (parsed.success_criteria as string[]) || [
        "Core problem is solved for target audience",
        "User satisfaction score >= 7/10",
        "Retention rate >= 40% after 30 days",
        "Time-to-value < 5 minutes for new users",
      ],
      architectedAt: new Date().toISOString(),
    };
  }

  /** Build MoSCoW items from parsed data with defaults */
  private buildMoscowItems(
    parsedItems: unknown,
    defaults: MoscowItem[],
    isMust: boolean,
    evidenceIds: string[]
  ): MoscowItem[] {
    if (Array.isArray(parsedItems) && parsedItems.length > 0) {
      return parsedItems.map((item: Record<string, unknown>) => ({
        description: String(item.description || ""),
        rationale: String(item.rationale || "Derived from product analysis"),
        evidenceIds: (item.evidenceIds as string[]) || evidenceIds.slice(0, 3),
        effort: (["hours", "days", "weeks", "months"].includes(String(item.effort)) ? item.effort : "days") as MoscowItem["effort"],
        inMvp: isMust ? (item.inMvp !== false) : false,
      }));
    }
    return defaults;
  }

  /** Estimate MVP timebox based on product format */
  private estimateMvpTimebox(opportunity: Opportunity, decision: ProductDecision): string {
    const format = (opportunity.format || "").toLowerCase();

    if (["ebook", "guía", "guide", "template"].some((f) => format.includes(f))) {
      return "1-2 weeks";
    }
    if (["workbook", "checklist", "course"].some((f) => format.includes(f))) {
      return "2-3 weeks";
    }
    if (["app", "web app", "tool", "landing page"].some((f) => format.includes(f))) {
      return "4-6 weeks";
    }
    if (["saas", "platform", "api"].some((f) => format.includes(f))) {
      return "8-12 weeks";
    }
    return "4-6 weeks";
  }

  /** Infer differentiation from evidence */
  private inferDifferentiation(evidence: ProductEvidence[]): string {
    const diffEvidence = evidence.filter((e) => e.type === "DIFFERENTIATION");
    if (diffEvidence.length > 0) {
      return diffEvidence.map((e) => e.content).join("; ");
    }
    return "Unique approach to solving the identified problem — differentiation to be refined based on competitive analysis";
  }

  /** Infer monetization model from opportunity and evidence */
  private inferMonetization(opportunity: Opportunity, evidence: ProductEvidence[]): string {
    const pricingEvidence = evidence.filter((e) => e.type === "PRICING");
    if (pricingEvidence.length > 0) {
      return `Based on market pricing evidence: ${pricingEvidence[0].content}`;
    }

    const format = (opportunity.format || "").toLowerCase();
    if (["ebook", "guía", "guide", "template"].some((f) => format.includes(f))) {
      return "One-time purchase (digital product)";
    }
    if (["course", "curso"].some((f) => format.includes(f))) {
      return "Course enrollment fee (one-time or installment)";
    }
    if (["saas", "app"].some((f) => format.includes(f))) {
      return "Subscription (monthly/annual) with free tier";
    }
    return "To be determined based on market research and validation";
  }

  /** Infer dependencies */
  private inferDependencies(opportunity: Opportunity, decision: ProductDecision): string[] {
    const deps: string[] = [];
    const format = (opportunity.format || "").toLowerCase();

    if (["app", "web app", "saas", "platform", "api"].some((f) => format.includes(f))) {
      deps.push("Hosting/infrastructure");
      deps.push("Authentication system");
      deps.push("Database");
    }

    if (decision.constructor?.secondary) {
      deps.push(`${decision.constructor.secondary} availability for technical implementation`);
    }

    deps.push("Content creation tools");
    return deps;
  }

  /** Infer risks from evidence */
  private inferRisks(evidence: ProductEvidence[]): string[] {
    const risks: string[] = [];
    const compEvidence = evidence.filter((e) => e.type === "COMPETITION");

    if (compEvidence.length >= 5) {
      risks.push("Crowded market — may struggle to differentiate");
    }
    if (compEvidence.some((e) => e.confidence >= 0.8)) {
      risks.push("Strong incumbent competitor with high market share");
    }

    risks.push("Market timing risk — conditions may change during build");
    risks.push("Adoption risk — target audience may resist change");

    return risks;
  }

  /** Build validation requirements from decision and evidence */
  private buildValidationRequirements(
    decision: ProductDecision,
    evidence: ProductEvidence[]
  ): ValidationRequirement[] {
    const requirements: ValidationRequirement[] = [];

    // Problem validation
    requirements.push({
      what: "Problem intensity and frequency",
      how: "User interviews with 10+ target users",
      successCriteria: "7+ out of 10 users confirm the problem is real and painful",
      threshold: "10 interviews",
      priority: "critical",
    });

    // Solution validation
    requirements.push({
      what: "Solution desirability",
      how: "Present solution concept to target users, measure interest",
      successCriteria: "60%+ express strong interest in the solution",
      threshold: "20 responses",
      priority: "critical",
    });

    // Payment validation
    const pricingEvidence = evidence.filter((e) => e.type === "PRICING");
    if (pricingEvidence.length === 0) {
      requirements.push({
        what: "Willingness to pay",
        how: "Pre-order or deposit test at proposed price point",
        successCriteria: "5+ pre-orders or 20%+ expressing purchase intent",
        threshold: "50 survey responses",
        priority: "high",
      });
    }

    // Usability validation
    requirements.push({
      what: "Usability and time-to-value",
      how: "Usability test with MVP prototype",
      successCriteria: "80%+ can complete core task without help",
      threshold: "5 usability tests",
      priority: "high",
    });

    return requirements;
  }

  /** Build requirements for construction */
  private buildBuildRequirements(
    opportunity: Opportunity,
    decision: ProductDecision,
    mustItems: MoscowItem[]
  ): BuildRequirement[] {
    const requirements: BuildRequirement[] = [];
    const format = (opportunity.format || "").toLowerCase();

    // Content requirements
    if (["ebook", "guía", "guide", "workbook", "template", "course"].some((f) => format.includes(f))) {
      requirements.push({
        what: "Core content creation",
        specification: "Structured content addressing all MUST items with evidence-backed material",
        dependencies: ["Research completion", "Outline approval"],
        effort: "weeks",
      });
      requirements.push({
        what: "Design and formatting",
        specification: "Professional layout, cover design, and visual elements",
        dependencies: ["Core content creation"],
        effort: "days",
      });
    }

    // Software requirements
    if (["app", "saas", "platform", "api", "web app"].some((f) => format.includes(f))) {
      requirements.push({
        what: "Core functionality implementation",
        specification: "Implement all MUST items as defined in architecture",
        dependencies: ["Technical architecture", "Design system"],
        effort: "weeks",
      });
      requirements.push({
        what: "Authentication and user management",
        specification: "User registration, login, profile management",
        dependencies: ["Database schema", "Hosting setup"],
        effort: "days",
      });
    }

    // Generic: testing
    requirements.push({
      what: "Quality assurance",
      specification: "Test all MVP items against acceptance criteria",
      dependencies: mustItems.map((m) => m.description),
      effort: "days",
    });

    return requirements;
  }

  /** Fallback architecture when AI fails */
  private fallbackArchitecture(
    opportunity: Opportunity,
    decision: ProductDecision,
    evidence: ProductEvidence[]
  ): ProductArchitecture {
    const evidenceIds = evidence.map((e) => e.id);

    return {
      client: opportunity.audience,
      problem: opportunity.problem,
      jtbd: [{
        statement: `When facing ${opportunity.problem}, I want to ${opportunity.solution}, so I can solve my problem`,
        situation: opportunity.problem,
        motivation: opportunity.solution,
        outcome: "Problem resolution",
        priority: "primary",
      }],
      desired_outcome: `Solve ${opportunity.problem} for ${opportunity.audience}`,
      value_proposition: `${opportunity.solution} for ${opportunity.audience}`,
      format: opportunity.format || "unspecified",
      MUST: [{
        description: `Core solution: ${opportunity.solution}`,
        rationale: "Core problem solution — non-negotiable",
        evidenceIds,
        effort: "weeks",
        inMvp: true,
      }],
      SHOULD: [],
      COULD: [],
      OUT: [
        {
          description: "Anything outside core problem scope",
          rationale: "AC-015: Scope boundary — prevents scope creep",
          evidenceIds: [],
          effort: "weeks",
          inMvp: false,
        },
        {
          description: "Advanced features not in MUST",
          rationale: "AC-015: Post-MVP consideration only",
          evidenceIds: [],
          effort: "weeks",
          inMvp: false,
        },
      ],
      ux_description: `Focused interface for ${opportunity.audience} to solve ${opportunity.problem}`,
      differentiation: "To be determined from competitive analysis",
      monetization: "To be determined from pricing validation",
      mvp_definition: {
        scope: `MVP: Core problem solution for ${opportunity.audience}`,
        items: [{
          description: `Core solution: ${opportunity.solution}`,
          rationale: "Core problem solution — non-negotiable",
          evidenceIds,
          effort: "weeks",
          inMvp: true,
        }],
        timebox: "4-6 weeks",
        successMetrics: ["Core problem solved end-to-end"],
      },
      dependencies: [],
      risks: ["AI architecture generation failed — manual review needed"],
      assumptions: [`Problem is real for ${opportunity.audience}`],
      unknowns: decision.uncertainties,
      validation_requirements: [{
        what: "Problem validation",
        how: "User interviews",
        successCriteria: "Problem confirmed by target users",
        priority: "critical",
      }],
      build_requirements: [{
        what: "Core implementation",
        specification: opportunity.solution,
        dependencies: [],
        effort: "weeks",
      }],
      success_criteria: ["Core problem is solved for target audience"],
      architectedAt: new Date().toISOString(),
    };
  }
}
