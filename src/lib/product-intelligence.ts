/**
 * Product Intelligence — KREA V2 Product Brain
 *
 * Research and evidence gathering for product opportunities.
 * Uses ZAI SDK for AI-powered research analysis and MemoryDV for persistence.
 *
 * Acceptance Criteria satisfied:
 *   AC-007: When insufficient evidence exists → return UNKNOWN/REQUIERE_VALIDACION
 *   AC-053: Memory isolation — product memories don't contaminate other products
 *
 * Evidence types cover the full product research spectrum:
 *   PROBLEM, AUDIENCE, NEED, DEMAND, BEHAVIOR, COMPETITION,
 *   EXISTING_PRODUCT, PRICING, DIFFERENTIATION, OPPORTUNITY
 */

import { randomUUID } from "crypto";
import ZAI from "z-ai-web-dev-sdk";
import { MemoryManager } from "@/lib/memory";
import { ExecutionTracer } from "@/lib/execution";
import {
  TruthLevel,
  SourceType,
  VerificationStatus,
  Evidence,
  EvidenceBuilder,
  weakestTruthLevel,
  TRUTH_LEVEL_ORDER,
} from "@/contracts/evidence";

// ─── Product Evidence Types ──────────────────────────────────────────────────

/** Categories of evidence relevant to product decisions */
export type ProductEvidenceType =
  | "PROBLEM"
  | "AUDIENCE"
  | "NEED"
  | "DEMAND"
  | "BEHAVIOR"
  | "COMPETITION"
  | "EXISTING_PRODUCT"
  | "PRICING"
  | "DIFFERENTIATION"
  | "OPPORTUNITY";

/** A single piece of product evidence with full provenance */
export interface ProductEvidence {
  /** Unique identifier */
  id: string;
  /** Category of this evidence */
  type: ProductEvidenceType;
  /** The fact or observation */
  content: string;
  /** Where this evidence came from */
  source: string;
  /** Type of source */
  sourceType: SourceType;
  /** Confidence in this evidence (0-1) */
  confidence: number;
  /** How reliable is this evidence */
  truthLevel: TruthLevel;
  /** When this evidence was gathered */
  timestamp: string;
  /** Whether this evidence has been verified */
  verificationStatus: VerificationStatus;
  /** Additional structured data */
  metadata?: Record<string, unknown>;
}

/** Result of a research operation */
export interface ResearchResult {
  /** The query that was researched */
  query: string;
  /** Evidence items discovered */
  evidence: ProductEvidence[];
  /** Summary of findings */
  summary: string;
  /** What remains unknown */
  gaps: string[];
  /** Overall confidence in the research (0-1) */
  confidence: number;
  /** Weakest truth level in the evidence set */
  overallTruthLevel: TruthLevel;
}

/** Raw data from any source before structuring */
export interface RawResearchData {
  /** Source identifier */
  source: string;
  /** Source type */
  sourceType: SourceType;
  /** The raw content/text */
  content: string;
  /** Confidence in the source (0-1) */
  sourceConfidence: number;
  /** Observed truth level of the source */
  truthLevel: TruthLevel;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ─── Product Intelligence ────────────────────────────────────────────────────

/**
 * ProductIntelligence — AI-powered research and evidence gathering.
 *
 * Gathers evidence about problems, audiences, competition, and demand
 * using the ZAI SDK for analysis and MemoryDV for persistence.
 * Every evidence item carries provenance, truth level, and confidence.
 */
type ZAIInstance = Awaited<ReturnType<typeof ZAI.create>>;

export class ProductIntelligence {
  private memory: MemoryManager;
  private tracer: ExecutionTracer;
  private zai: ZAIInstance | null = null;

  constructor(memory?: MemoryManager, tracer?: ExecutionTracer) {
    this.memory = memory || new MemoryManager();
    this.tracer = tracer || new ExecutionTracer();
  }

  /** Lazy-initialize the ZAI SDK client */
  private async getZAI(): Promise<ZAIInstance> {
    if (!this.zai) {
      this.zai = await ZAI.create();
    }
    return this.zai;
  }

  /**
   * researchOpportunity — Gather evidence about a problem/opportunity.
   *
   * Uses AI to analyze the domain and description, producing structured evidence
   * about the problem space, target audience, competitive landscape, and demand signals.
   *
   * AC-007: Returns UNKNOWN/REQUIERE_VALIDACION when evidence is insufficient.
   * AC-053: Stores evidence in product-isolated memory domain.
   */
  async researchOpportunity(
    domain: string,
    description: string,
    options?: { correlationId?: string }
  ): Promise<ResearchResult> {
    const executionId = await this.tracer.start("product_intelligence:research_opportunity", {
      correlationId: options?.correlationId,
      inputs: { domain, description },
    });

    try {
      const zai = await this.getZAI();

      // AI-powered research analysis
      const response = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a product research analyst. Analyze the given opportunity and provide structured evidence about:
1. The core problem and its intensity (how painful is it?)
2. Who experiences this problem (target audience)
3. What need this problem creates
4. Demand signals (search volume, willingness to pay, growth trends)
5. Existing solutions and their weaknesses
6. Competitive landscape
7. Potential differentiators

For each piece of evidence, indicate:
- Type: PROBLEM, AUDIENCE, NEED, DEMAND, BEHAVIOR, COMPETITION, EXISTING_PRODUCT, PRICING, DIFFERENTIATION, or OPPORTUNITY
- Confidence: 0.0-1.0 (how confident are you in this observation?)
- Truth level: OBSERVED, VERIFIED, ESTIMATED, INFERRED, or UNKNOWN

Format your response as structured JSON with an array of evidence items and a summary.`,
          },
          {
            role: "user",
            content: `Domain: ${domain}\nDescription: ${description}\n\nAnalyze this product opportunity and provide evidence for each dimension.`,
          },
        ],
      });

      const analysisText = response.choices[0]?.message?.content || "";

      // Structure the AI response into evidence items
      const evidence = this.parseAIResearchResponse(analysisText, domain, "opportunity_research");

      // Calculate overall confidence and truth level
      const { confidence, overallTruthLevel, gaps } = this.assessEvidenceQuality(evidence, [
        "PROBLEM", "AUDIENCE", "NEED", "DEMAND",
      ]);

      // Persist to product-isolated memory (AC-053)
      await this.persistEvidence(domain, evidence, "opportunity");

      await this.tracer.succeed(executionId, {
        evidenceCount: evidence.length,
        confidence,
        overallTruthLevel,
      });

      return {
        query: `${domain}: ${description}`,
        evidence,
        summary: this.generateSummary(evidence),
        gaps,
        confidence,
        overallTruthLevel,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.tracer.fail(executionId, { message: err.message, outputs: {} });

      // AC-007: Insufficient evidence → return UNKNOWN
      return {
        query: `${domain}: ${description}`,
        evidence: [],
        summary: `Research failed: ${err.message}`,
        gaps: ["ALL — research could not be completed"],
        confidence: 0,
        overallTruthLevel: "UNKNOWN",
      };
    }
  }

  /**
   * researchAudience — Analyze target audience for a problem.
   *
   * Produces evidence about who experiences the problem, their demographics,
   * behaviors, and where they can be reached.
   */
  async researchAudience(
    problem: string,
    options?: { correlationId?: string }
  ): Promise<ResearchResult> {
    const executionId = await this.tracer.start("product_intelligence:research_audience", {
      correlationId: options?.correlationId,
      inputs: { problem },
    });

    try {
      const zai = await this.getZAI();

      const response = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a target audience researcher. Analyze who experiences the given problem.

Provide evidence about:
1. Who they are (demographics, psychographics, technographics)
2. How many of them exist (market size)
3. Where they congregate (channels, communities, platforms)
4. How they currently solve the problem (workarounds, existing tools)
5. Their willingness to pay for a solution
6. Their decision-making process

For each evidence item, classify as: AUDIENCE, BEHAVIOR, NEED, or DEMAND.
Include confidence (0-1) and truth level (OBSERVED, VERIFIED, ESTIMATED, INFERRED, UNKNOWN).

Format as structured JSON.`,
          },
          {
            role: "user",
            content: `Problem: ${problem}\n\nAnalyze the target audience for this problem.`,
          },
        ],
      });

      const analysisText = response.choices[0]?.message?.content || "";
      const evidence = this.parseAIResearchResponse(analysisText, "audience", "audience_research");

      const { confidence, overallTruthLevel, gaps } = this.assessEvidenceQuality(evidence, [
        "AUDIENCE", "BEHAVIOR",
      ]);

      await this.persistEvidence("audience", evidence, "audience");
      await this.tracer.succeed(executionId, { evidenceCount: evidence.length, confidence });

      return {
        query: problem,
        evidence,
        summary: this.generateSummary(evidence),
        gaps,
        confidence,
        overallTruthLevel,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.tracer.fail(executionId, { message: err.message, outputs: {} });

      return {
        query: problem,
        evidence: [],
        summary: `Audience research failed: ${err.message}`,
        gaps: ["AUDIENCE_SIZE", "AUDIENCE_BEHAVIOR", "CHANNELS"],
        confidence: 0,
        overallTruthLevel: "UNKNOWN",
      };
    }
  }

  /**
   * researchCompetition — Analyze competitive landscape for a domain.
   *
   * Produces evidence about existing solutions, their strengths/weaknesses,
   * pricing, market share, and potential differentiation angles.
   */
  async researchCompetition(
    domain: string,
    options?: { correlationId?: string }
  ): Promise<ResearchResult> {
    const executionId = await this.tracer.start("product_intelligence:research_competition", {
      correlationId: options?.correlationId,
      inputs: { domain },
    });

    try {
      const zai = await this.getZAI();

      const response = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a competitive intelligence analyst. Analyze the competitive landscape for the given domain.

Provide evidence about:
1. Existing solutions and products (names, descriptions)
2. Their pricing models and price points
3. Their market positioning and target segments
4. Their strengths and weaknesses
5. Gaps they leave unaddressed
6. Potential differentiation strategies
7. Barriers to entry

For each evidence item, classify as: COMPETITION, EXISTING_PRODUCT, PRICING, or DIFFERENTIATION.
Include confidence (0-1) and truth level.

Format as structured JSON.`,
          },
          {
            role: "user",
            content: `Domain: ${domain}\n\nAnalyze the competitive landscape and identify opportunities for differentiation.`,
          },
        ],
      });

      const analysisText = response.choices[0]?.message?.content || "";
      const evidence = this.parseAIResearchResponse(analysisText, domain, "competition_research");

      const { confidence, overallTruthLevel, gaps } = this.assessEvidenceQuality(evidence, [
        "COMPETITION", "EXISTING_PRODUCT",
      ]);

      await this.persistEvidence(domain, evidence, "competition");
      await this.tracer.succeed(executionId, { evidenceCount: evidence.length, confidence });

      return {
        query: domain,
        evidence,
        summary: this.generateSummary(evidence),
        gaps,
        confidence,
        overallTruthLevel,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.tracer.fail(executionId, { message: err.message, outputs: {} });

      return {
        query: domain,
        evidence: [],
        summary: `Competition research failed: ${err.message}`,
        gaps: ["COMPETITOR_LIST", "PRICING_DATA", "DIFFERENTIATION_ANGLES"],
        confidence: 0,
        overallTruthLevel: "UNKNOWN",
      };
    }
  }

  /**
   * researchDemand — Evaluate demand signals for a problem and audience.
   *
   * Analyzes search volume trends, community discussions, purchase intent,
   * and other signals that indicate market demand.
   */
  async researchDemand(
    problem: string,
    audience: string,
    options?: { correlationId?: string }
  ): Promise<ResearchResult> {
    const executionId = await this.tracer.start("product_intelligence:research_demand", {
      correlationId: options?.correlationId,
      inputs: { problem, audience },
    });

    try {
      const zai = await this.getZAI();

      const response = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a market demand analyst. Evaluate demand signals for the given problem and audience.

Analyze:
1. Search volume and trends for relevant keywords
2. Community discussions and engagement (Reddit, forums, social media)
3. Existing spending on solutions (willingness to pay)
4. Growth or decline signals in the market
5. Adjacent markets that indicate demand
6. Seasonal or cyclical patterns
7. Urgency of the need (must-have vs nice-to-have)

For each evidence item, classify as: DEMAND, BEHAVIOR, NEED, or OPPORTUNITY.
Include confidence (0-1) and truth level.

Format as structured JSON.`,
          },
          {
            role: "user",
            content: `Problem: ${problem}\nAudience: ${audience}\n\nEvaluate demand signals for this problem-audience combination.`,
          },
        ],
      });

      const analysisText = response.choices[0]?.message?.content || "";
      const evidence = this.parseAIResearchResponse(analysisText, "demand", "demand_research");

      const { confidence, overallTruthLevel, gaps } = this.assessEvidenceQuality(evidence, [
        "DEMAND", "NEED",
      ]);

      await this.persistEvidence("demand", evidence, "demand");
      await this.tracer.succeed(executionId, { evidenceCount: evidence.length, confidence });

      return {
        query: `${problem} → ${audience}`,
        evidence,
        summary: this.generateSummary(evidence),
        gaps,
        confidence,
        overallTruthLevel,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.tracer.fail(executionId, { message: err.message, outputs: {} });

      return {
        query: `${problem} → ${audience}`,
        evidence: [],
        summary: `Demand research failed: ${err.message}`,
        gaps: ["DEMAND_VOLUME", "PURCHASE_INTENT", "GROWTH_TREND"],
        confidence: 0,
        overallTruthLevel: "UNKNOWN",
      };
    }
  }

  /**
   * structureEvidence — Organize raw data into structured evidence with provenance.
   *
   * Takes unstructured/raw data from any source and structures it into
   * ProductEvidence items with proper truth levels, confidence scores,
   * and verification status.
   *
   * AC-007: When data is insufficient, assigns UNKNOWN truth level
   * and REQUIERE_VALIDACION verification status.
   */
  structureEvidence(
    rawData: RawResearchData[],
    type: ProductEvidenceType
  ): ProductEvidence[] {
    return rawData.map((item) => {
      // Determine truth level based on source and content quality
      let truthLevel: TruthLevel = item.truthLevel;
      let verificationStatus: VerificationStatus = "UNVERIFIED";

      // Insufficient content → UNKNOWN (AC-007)
      if (!item.content || item.content.trim().length < 10) {
        truthLevel = "UNKNOWN";
        verificationStatus = "PENDING";
      }

      // Low source confidence → downgrade truth level
      if (item.sourceConfidence < 0.3) {
        truthLevel = "UNKNOWN";
        verificationStatus = "PENDING";
      } else if (item.sourceConfidence < 0.5) {
        if (TRUTH_LEVEL_ORDER[truthLevel] > TRUTH_LEVEL_ORDER["INFERRED"]) {
          truthLevel = "INFERRED";
        }
      }

      return {
        id: randomUUID(),
        type,
        content: item.content,
        source: item.source,
        sourceType: item.sourceType,
        confidence: item.sourceConfidence,
        truthLevel,
        timestamp: new Date().toISOString(),
        verificationStatus,
        metadata: item.metadata,
      };
    });
  }

  // ─── Private Helpers ───────────────────────────────────────────────────

  /**
   * Parse AI research response into structured ProductEvidence items.
   * Handles both JSON and free-text responses.
   */
  private parseAIResearchResponse(
    text: string,
    domain: string,
    researchType: string
  ): ProductEvidence[] {
    const evidence: ProductEvidence[] = [];
    const timestamp = new Date().toISOString();

    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : parsed.evidence || parsed.items || [];

      for (const item of items) {
        const type = this.normalizeEvidenceType(item.type || item.category || "OPPORTUNITY");
        const truthLevel = this.normalizeTruthLevel(item.truthLevel || item.truth_level || "ESTIMATED");
        const confidence = Math.max(0, Math.min(1, Number(item.confidence) || 0.5));

        evidence.push({
          id: randomUUID(),
          type,
          content: String(item.content || item.description || item.text || ""),
          source: `zai:${researchType}`,
          sourceType: "ai_generation",
          confidence,
          truthLevel,
          timestamp,
          verificationStatus: "UNVERIFIED",
          metadata: { domain, rawItem: item },
        });
      }

      if (evidence.length > 0) return evidence;
    } catch {
      // Not valid JSON — parse as structured text
    }

    // Fallback: parse as structured text paragraphs
    const sections = text.split(/\n\n+/).filter((s) => s.trim().length > 0);

    for (const section of sections) {
      // Try to detect evidence type from section headers
      const type = this.detectEvidenceType(section);
      const confidence = this.estimateConfidenceFromText(section);

      evidence.push({
        id: randomUUID(),
        type,
        content: section.trim(),
        source: `zai:${researchType}`,
        sourceType: "ai_generation",
        confidence,
        truthLevel: "INFERRED",
        timestamp,
        verificationStatus: "UNVERIFIED",
        metadata: { domain, researchType },
      });
    }

    return evidence;
  }

  /** Normalize evidence type strings to ProductEvidenceType */
  private normalizeEvidenceType(type: string): ProductEvidenceType {
    const upper = type.toUpperCase().replace(/[_\s]+/g, "_");
    const validTypes: ProductEvidenceType[] = [
      "PROBLEM", "AUDIENCE", "NEED", "DEMAND", "BEHAVIOR",
      "COMPETITION", "EXISTING_PRODUCT", "PRICING", "DIFFERENTIATION", "OPPORTUNITY",
    ];

    // Direct match
    if (validTypes.includes(upper as ProductEvidenceType)) {
      return upper as ProductEvidenceType;
    }

    // Partial match
    for (const valid of validTypes) {
      if (upper.includes(valid) || valid.includes(upper)) {
        return valid;
      }
    }

    // Keyword matching
    const keywords: Record<string, ProductEvidenceType> = {
      "problem": "PROBLEM",
      "pain": "PROBLEM",
      "audience": "AUDIENCE",
      "user": "AUDIENCE",
      "customer": "AUDIENCE",
      "need": "NEED",
      "demand": "DEMAND",
      "search": "DEMAND",
      "behavior": "BEHAVIOR",
      "competitor": "COMPETITION",
      "compete": "COMPETITION",
      "existing": "EXISTING_PRODUCT",
      "product": "EXISTING_PRODUCT",
      "price": "PRICING",
      "cost": "PRICING",
      "different": "DIFFERENTIATION",
      "unique": "DIFFERENTIATION",
      "opportunity": "OPPORTUNITY",
    };

    for (const [keyword, evidenceType] of Object.entries(keywords)) {
      if (upper.includes(keyword.toUpperCase())) {
        return evidenceType;
      }
    }

    return "OPPORTUNITY";
  }

  /** Normalize truth level strings */
  private normalizeTruthLevel(level: string): TruthLevel {
    const upper = level.toUpperCase();
    const validLevels: TruthLevel[] = ["OBSERVED", "VERIFIED", "ESTIMATED", "MODELED", "INFERRED", "UNKNOWN"];
    if (validLevels.includes(upper as TruthLevel)) {
      return upper as TruthLevel;
    }
    return "ESTIMATED";
  }

  /** Detect evidence type from text content */
  private detectEvidenceType(text: string): ProductEvidenceType {
    const lower = text.toLowerCase();

    if (lower.includes("problem") || lower.includes("pain point")) return "PROBLEM";
    if (lower.includes("audience") || lower.includes("target user")) return "AUDIENCE";
    if (lower.includes("need") || lower.includes("require")) return "NEED";
    if (lower.includes("demand") || lower.includes("search volume")) return "DEMAND";
    if (lower.includes("behavior") || lower.includes("habit")) return "BEHAVIOR";
    if (lower.includes("competitor") || lower.includes("competing")) return "COMPETITION";
    if (lower.includes("existing solution") || lower.includes("current tool")) return "EXISTING_PRODUCT";
    if (lower.includes("pricing") || lower.includes("price point")) return "PRICING";
    if (lower.includes("differentiat") || lower.includes("unique")) return "DIFFERENTIATION";
    if (lower.includes("opportunity") || lower.includes("gap")) return "OPPORTUNITY";

    return "OPPORTUNITY";
  }

  /** Estimate confidence from text signals */
  private estimateConfidenceFromText(text: string): number {
    const lower = text.toLowerCase();

    // High confidence signals
    if (lower.includes("confirmed") || lower.includes("verified") || lower.includes("observed")) return 0.85;
    if (lower.includes("data shows") || lower.includes("statistics") || lower.includes("measured")) return 0.8;

    // Medium confidence signals
    if (lower.includes("likely") || lower.includes("estimated") || lower.includes("approximately")) return 0.65;
    if (lower.includes("research suggests") || lower.includes("studies show")) return 0.7;

    // Low confidence signals
    if (lower.includes("might") || lower.includes("possibly") || lower.includes("uncertain")) return 0.4;
    if (lower.includes("unknown") || lower.includes("unclear") || lower.includes("no data")) return 0.2;

    // Default: moderate confidence for AI-generated analysis
    return 0.55;
  }

  /**
   * Assess the quality and completeness of an evidence set.
   *
   * AC-007: When required types are missing → gaps identified, UNKNOWN truth level.
   */
  private assessEvidenceQuality(
    evidence: ProductEvidence[],
    requiredTypes: string[]
  ): { confidence: number; overallTruthLevel: TruthLevel; gaps: string[] } {
    if (evidence.length === 0) {
      return {
        confidence: 0,
        overallTruthLevel: "UNKNOWN",
        gaps: requiredTypes.map((t) => `${t} — no evidence gathered (REQUIERE_VALIDACION)`),
      };
    }

    // Check which required types are covered
    const coveredTypes = new Set(evidence.map((e) => e.type));
    const gaps = requiredTypes
      .filter((t) => !coveredTypes.has(t as ProductEvidenceType))
      .map((t) => `${t} — missing evidence (REQUIERE_VALIDACION)`);

    // Calculate weighted average confidence
    const totalConfidence = evidence.reduce((sum, e) => sum + e.confidence, 0);
    const avgConfidence = totalConfidence / evidence.length;

    // Overall truth level is the weakest in the set
    const allTruthLevels = evidence.map((e) => e.truthLevel);
    const overallTruthLevel = weakestTruthLevel(allTruthLevels.length > 0 ? allTruthLevels : ["UNKNOWN"]);

    // Reduce confidence for missing required types
    const coverageRatio = coveredTypes.size / requiredTypes.length;
    const adjustedConfidence = avgConfidence * (0.5 + 0.5 * coverageRatio);

    return {
      confidence: Math.round(adjustedConfidence * 100) / 100,
      overallTruthLevel,
      gaps,
    };
  }

  /** Generate a human-readable summary of evidence */
  private generateSummary(evidence: ProductEvidence[]): string {
    if (evidence.length === 0) return "No evidence gathered.";

    const byType = new Map<ProductEvidenceType, ProductEvidence[]>();
    for (const e of evidence) {
      const items = byType.get(e.type) || [];
      items.push(e);
      byType.set(e.type, items);
    }

    const parts: string[] = [];
    for (const [type, items] of byType) {
      const avgConfidence = items.reduce((s, e) => s + e.confidence, 0) / items.length;
      parts.push(`${type}: ${items.length} item(s), avg confidence ${avgConfidence.toFixed(2)}`);
    }

    const avgAll = evidence.reduce((s, e) => s + e.confidence, 0) / evidence.length;
    parts.push(`\nOverall: ${evidence.length} evidence items, average confidence ${avgAll.toFixed(2)}`);

    return parts.join("\n");
  }

  /**
   * Persist evidence to product-isolated memory.
   *
   * AC-053: Uses domain-scoped memory to prevent contamination
   * between different product research contexts.
   */
  private async persistEvidence(
    domain: string,
    evidence: ProductEvidence[],
    researchType: string
  ): Promise<void> {
    for (const item of evidence) {
      await this.memory.store(
        "krea",
        `product:${domain}:${researchType}`,
        "SEMANTIC",
        {
          evidenceId: item.id,
          type: item.type,
          content: item.content,
          confidence: item.confidence,
          truthLevel: item.truthLevel,
        },
        {
          source: item.source,
          sourceType: "AGENT",
          confidence: item.confidence,
          truthLevel: item.truthLevel,
          scope: "agent",
        }
      );
    }
  }
}
