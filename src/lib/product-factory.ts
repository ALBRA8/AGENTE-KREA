/**
 * Product Factory — KREA Book Factory Layer
 *
 * General orchestration layer that routes product production based on type
 * and complexity. Content products (eBook, guide, template) are routed to
 * BookFactory; software products generate HandoffContracts for Codex/
 * Antigravity; hybrid products combine both.
 *
 * Satisfies:
 *   AC-027 — Complexity determines routing: category alone isn't enough
 *   AC-028 — Pipeline: Opportunity → Fit → Architecture → Specification →
 *            Production → QA → Final Product
 *
 * The Product Factory is the top-level entry point for all product creation.
 */

import { randomUUID } from "crypto";
import { BookFactory } from "./book-factory";
import type { Opportunity as BookOpportunity, Architecture as BookArchitecture, BookProduct } from "./book-factory";
import { MemoryManager } from "./memory";
import { ExecutionTracer } from "./execution";

// ─── Product Types ──────────────────────────────────────────────────────

export type ProductType =
  | "ebook"        // Full eBook — routes to BookFactory
  | "guide"        // How-to guide — routes to BookFactory
  | "template"     // Document template — routes to BookFactory
  | "report"       // Research report — routes to BookFactory
  | "software"     // Software product — generates HandoffContract
  | "hybrid";      // Content + Software — combines both

export type ProductCategory = "content" | "software" | "hybrid";

// ─── Opportunity (general, for all product types) ───────────────────────

export interface ProductOpportunity {
  /** Unique opportunity ID */
  id: string;
  /** Topic/subject of the product */
  topic: string;
  /** Target audience */
  targetAudience: string;
  /** Genre/category */
  genre: string;
  /** Author/creator name */
  author: string;
  /** Purpose of the product */
  purpose: string;
  /** Product type */
  productType: ProductType;
  /** Complexity level (AC-027: determines routing) */
  complexity: "simple" | "moderate" | "complex";
  /** Desired output format */
  format: "ebook" | "guide" | "template" | "report" | "software" | "hybrid";
  /** Tone of the content */
  tone: string;
  /** Chapter/section count (for content products) */
  sectionCount: number;
  /** Target market */
  targetMarket: string;
  /** User ID for tracing */
  userId?: string;
}

// ─── Fit Result ─────────────────────────────────────────────────────────

/**
 * Result of fitting an opportunity to a production path.
 *
 * AC-027: Category alone isn't enough — complexity also determines routing.
 * A "simple ebook" might use a streamlined path, while a "complex ebook"
 * uses the full BookFactory pipeline.
 */
export interface FitResult {
  /** Whether the opportunity fits the selected production path */
  fits: boolean;
  /** Selected production category */
  category: ProductCategory;
  /** Production path based on type + complexity */
  production_path: "book-factory-full" | "book-factory-streamlined" | "handoff-contract" | "hybrid";
  /** Reason for the routing decision */
  routing_reason: string;
  /** Estimated complexity score (0-1) */
  complexity_score: number;
  /** Required capabilities for this production path */
  required_capabilities: string[];
  /** Estimated time in seconds */
  estimated_time_seconds: number;
}

// ─── Architecture Decision ─────────────────────────────────────────────

export interface ArchitectureDecision {
  /** Architecture type */
  type: "monolithic" | "modular" | "microservices";
  /** Component breakdown */
  components: ArchitectureComponent[];
  /** Quality attributes prioritized */
  quality_attributes: string[];
  /** Constraints */
  constraints: string[];
}

export interface ArchitectureComponent {
  name: string;
  type: "content" | "design" | "layout" | "render" | "qa" | "software";
  dependencies: string[];
}

// ─── Handoff Contract (for software products) ───────────────────────────

/**
 * Contract for handing off a software product specification to
 * Codex or Antigravity for implementation.
 */
export interface HandoffContract {
  /** Unique contract ID */
  id: string;
  /** The opportunity being handed off */
  opportunity_id: string;
  /** Target implementation agent */
  target_agent: "codex" | "antigravity";
  /** Software specification */
  specification: SoftwareSpecification;
  /** Acceptance criteria */
  acceptance_criteria: string[];
  /** Constraints and non-functional requirements */
  constraints: string[];
  /** Created timestamp */
  createdAt: string;
}

export interface SoftwareSpecification {
  /** Product name */
  name: string;
  /** Product description */
  description: string;
  /** Feature list */
  features: { name: string; description: string; priority: "must" | "should" | "nice" }[];
  /** Tech stack requirements */
  tech_stack: string[];
  /** Architecture decision */
  architecture: ArchitectureDecision;
  /** Estimated complexity */
  complexity: "simple" | "moderate" | "complex";
}

// ─── Product Evidence ──────────────────────────────────────────────────

export interface ProductEvidence {
  /** Step that produced this evidence */
  step: string;
  /** Timestamp */
  timestamp: string;
  /** Evidence description */
  description: string;
  /** Evidence data */
  data: Record<string, unknown>;
}

// ─── Product Result ────────────────────────────────────────────────────

/**
 * Final result of product production.
 *
 * AC-028: Pipeline result with success, product_type, artifact_path,
 *   dossier_id, evidence, qa_result.
 */
export interface ProductResult {
  /** Whether production was successful */
  success: boolean;
  /** Type of product produced */
  product_type: ProductType;
  /** Path to the artifact (file path or reference) */
  artifact_path: string | null;
  /** Dossier ID for traceability */
  dossier_id: string;
  /** Evidence trail for the entire pipeline */
  evidence: ProductEvidence[];
  /** QA result (pass/fail with details) */
  qa_result: {
    passed: boolean;
    issues_count: number;
    details: string;
  };
  /** Book product (if content product) */
  book_product?: BookProduct;
  /** Handoff contract (if software product) */
  handoff_contract?: HandoffContract;
  /** Production time in ms */
  production_time_ms: number;
  /** Errors */
  errors: string[];
}

// ─── ProductFactory Class ──────────────────────────────────────────────

/**
 * ProductFactory — general orchestration for all product types.
 *
 * Pipeline (AC-028):
 *   Opportunity → Fit → Architecture → Specification → Production → QA → Final Product
 *
 * Routing (AC-027):
 *   - Content products (ebook, guide, template, report) → BookFactory
 *   - Software products → HandoffContract for Codex/Antigravity
 *   - Hybrid → combines both
 *
 * Complexity determines routing: category alone isn't enough (AC-027).
 */
export class ProductFactory {
  private bookFactory = new BookFactory();
  private memory = new MemoryManager();
  private tracer = new ExecutionTracer();

  /**
   * Produce a product from an opportunity.
   *
   * @param opportunity - The product opportunity
   * @param fitResult - Pre-computed fit result (or computed internally)
   * @param decision - Architecture decision (optional)
   * @returns ProductResult with the final product and evidence
   */
  async produce(
    opportunity: ProductOpportunity,
    fitResult?: FitResult,
    decision?: ArchitectureDecision
  ): Promise<ProductResult> {
    const startTime = Date.now();
    const evidence: ProductEvidence[] = [];
    const errors: string[] = [];

    // Start execution trace
    const executionId = await this.tracer.start("product-factory-produce", {
      agentId: "krea",
      userId: opportunity.userId,
      inputs: { topic: opportunity.topic, productType: opportunity.productType },
    });

    try {
      // ─── Step 1: Fit ──────────────────────────────────────────────
      const fit = fitResult ?? this.computeFit(opportunity);
      evidence.push({
        step: "fit",
        timestamp: new Date().toISOString(),
        description: `Routed to ${fit.production_path} (complexity: ${fit.complexity_score})`,
        data: { fit },
      });

      // ─── Step 2: Architecture ─────────────────────────────────────
      const arch = decision ?? this.computeArchitecture(opportunity, fit);
      evidence.push({
        step: "architecture",
        timestamp: new Date().toISOString(),
        description: `Architecture: ${arch.type} with ${arch.components.length} components`,
        data: { architecture: arch },
      });

      // ─── Step 3-7: Production (routed by type) ────────────────────
      let result: ProductResult;

      switch (fit.category) {
        case "content":
          result = await this.produceContentProduct(opportunity, fit, arch, evidence, executionId);
          break;

        case "software":
          result = this.produceSoftwareProduct(opportunity, fit, arch, evidence);
          break;

        case "hybrid":
          result = await this.produceHybridProduct(opportunity, fit, arch, evidence, executionId);
          break;

        default:
          throw new Error(`Unknown product category: ${fit.category}`);
      }

      await this.tracer.succeed(executionId, {
        productType: opportunity.productType,
        success: result.success,
      });

      return result;

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      await this.tracer.addError(executionId, message);
      await this.tracer.fail(executionId, { message });

      return {
        success: false,
        product_type: opportunity.productType,
        artifact_path: null,
        dossier_id: randomUUID(),
        evidence,
        qa_result: { passed: false, issues_count: 1, details: message },
        production_time_ms: Date.now() - startTime,
        errors,
      };
    }
  }

  /**
   * Compute the fit result for an opportunity.
   *
   * AC-027: Complexity determines routing, not just category.
   */
  computeFit(opportunity: ProductOpportunity): FitResult {
    const category = this.inferCategory(opportunity.productType);

    // Compute complexity score (0-1)
    const complexityScore = this.computeComplexityScore(opportunity);

    // Route based on category + complexity (AC-027)
    let productionPath: FitResult["production_path"];
    let routingReason: string;

    if (category === "content") {
      if (complexityScore <= 0.3) {
        productionPath = "book-factory-streamlined";
        routingReason = "Simple content product — streamlined pipeline sufficient";
      } else {
        productionPath = "book-factory-full";
        routingReason = "Complex content product — full BookFactory pipeline required";
      }
    } else if (category === "software") {
      productionPath = "handoff-contract";
      routingReason = "Software product — generate HandoffContract for implementation agent";
    } else {
      productionPath = "hybrid";
      routingReason = "Hybrid product — combine BookFactory + HandoffContract";
    }

    const requiredCapabilities = this.getRequiredCapabilities(productionPath);
    const estimatedTime = this.estimateProductionTime(productionPath, opportunity);

    return {
      fits: true,
      category,
      production_path: productionPath,
      routing_reason: routingReason,
      complexity_score: complexityScore,
      required_capabilities: requiredCapabilities,
      estimated_time_seconds: estimatedTime,
    };
  }

  // ─── Private Methods ───────────────────────────────────────────────

  /**
   * Infer the product category from the product type.
   */
  private inferCategory(productType: ProductType): ProductCategory {
    const contentTypes: ProductType[] = ["ebook", "guide", "template", "report"];
    if (contentTypes.includes(productType)) return "content";
    if (productType === "software") return "software";
    return "hybrid";
  }

  /**
   * Compute complexity score (0-1) from opportunity attributes.
   *
   * AC-027: Complexity is multi-dimensional, not just category.
   */
  private computeComplexityScore(opportunity: ProductOpportunity): number {
    let score = 0;

    // Section count contributes to complexity
    score += Math.min(0.3, opportunity.sectionCount / 20);

    // Explicit complexity level
    const complexityMap: Record<string, number> = {
      simple: 0.1,
      moderate: 0.3,
      complex: 0.5,
    };
    score += complexityMap[opportunity.complexity] ?? 0.3;

    // Format complexity
    if (opportunity.format === "report") score += 0.1;
    if (opportunity.format === "hybrid") score += 0.2;

    // Genre complexity (some genres need more visual richness)
    const complexGenres = ["fiction", "lifestyle", "creative"];
    if (complexGenres.includes(opportunity.genre.toLowerCase())) score += 0.1;

    return Math.min(1, score);
  }

  /**
   * Compute architecture for the product.
   */
  private computeArchitecture(
    opportunity: ProductOpportunity,
    fit: FitResult
  ): ArchitectureDecision {
    const contentComponents: ArchitectureComponent[] = [
      { name: "content-gen", type: "content", dependencies: [] },
      { name: "art-direction", type: "design", dependencies: ["content-gen"] },
      { name: "editorial-design", type: "design", dependencies: ["art-direction"] },
      { name: "layout", type: "layout", dependencies: ["editorial-design"] },
      { name: "render", type: "render", dependencies: ["layout"] },
      { name: "qa", type: "qa", dependencies: ["render"] },
    ];

    if (fit.category === "software" || fit.category === "hybrid") {
      contentComponents.push({
        name: "software-impl",
        type: "software",
        dependencies: ["content-gen"],
      });
    }

    return {
      type: fit.complexity_score > 0.6 ? "modular" : "monolithic",
      components: contentComponents,
      quality_attributes: [
        "correctness",
        "completeness",
        "visual_quality",
        "accessibility",
      ],
      constraints: [
        "No literal content copying (AC-032)",
        "Deterministic layout (AC-039)",
        "Visual system coherence (AC-034)",
        "Max 5 repair iterations (AC-045)",
      ],
    };
  }

  /**
   * Produce a content product via BookFactory.
   */
  private async produceContentProduct(
    opportunity: ProductOpportunity,
    fit: FitResult,
    _arch: ArchitectureDecision,
    evidence: ProductEvidence[],
    executionId: string
  ): Promise<ProductResult> {
    const startTime = Date.now();

    // Map ProductOpportunity → BookOpportunity
    const bookOpportunity: BookOpportunity = {
      topic: opportunity.topic,
      targetAudience: opportunity.targetAudience,
      genre: opportunity.genre,
      chapterCount: opportunity.sectionCount,
      author: opportunity.author,
      purpose: opportunity.purpose,
      tone: opportunity.tone,
      userId: opportunity.userId,
    };

    const bookArchitecture: BookArchitecture = {
      format: opportunity.format as BookArchitecture["format"],
      complexity: opportunity.complexity,
      targetMarket: opportunity.targetMarket,
    };

    evidence.push({
      step: "specification",
      timestamp: new Date().toISOString(),
      description: "Content product specification mapped to BookFactory input",
      data: { productionPath: fit.production_path },
    });

    // Route to BookFactory
    const bookProduct = await this.bookFactory.produce(bookOpportunity, bookArchitecture);

    evidence.push({
      step: "production",
      timestamp: new Date().toISOString(),
      description: `BookFactory produced ${bookProduct.content.chapters.length} chapters, ${bookProduct.pdf.pageCount} pages`,
      data: {
        pageCount: bookProduct.pdf.pageCount,
        wordCount: bookProduct.content.total_word_count,
        qaPassed: bookProduct.qa_result.passed,
        pdfVerified: bookProduct.pdf_verification.overall,
      },
    });

    evidence.push({
      step: "qa",
      timestamp: new Date().toISOString(),
      description: bookProduct.qa_result.passed
        ? "QA passed — product is verified"
        : `QA found ${bookProduct.qa_result.issue_count} issues`,
      data: {
        passed: bookProduct.qa_result.passed,
        issueCount: bookProduct.qa_result.issue_count,
        criticalCount: bookProduct.qa_result.by_severity.critical,
      },
    });

    await this.tracer.addSkill(executionId, "book-factory");

    // Store product dossier in memory
    const dossierId = randomUUID();
    await this.storeDossier(opportunity, bookProduct, dossierId);

    return {
      success: bookProduct.success,
      product_type: opportunity.productType,
      artifact_path: bookProduct.pdf.filePath,
      dossier_id: dossierId,
      evidence,
      qa_result: {
        passed: bookProduct.qa_result.passed && bookProduct.pdf_verification.overall,
        issues_count: bookProduct.qa_result.issue_count,
        details: bookProduct.qa_result.passed
          ? "All QA checks passed"
          : `${bookProduct.qa_result.by_severity.critical} critical, ${bookProduct.qa_result.by_severity.warning} warnings`,
      },
      book_product: bookProduct,
      production_time_ms: Date.now() - startTime,
      errors: bookProduct.errors,
    };
  }

  /**
   * Produce a software product via HandoffContract.
   */
  private produceSoftwareProduct(
    opportunity: ProductOpportunity,
    fit: FitResult,
    arch: ArchitectureDecision,
    evidence: ProductEvidence[]
  ): ProductResult {
    const contract: HandoffContract = {
      id: randomUUID(),
      opportunity_id: opportunity.id,
      target_agent: opportunity.complexity === "complex" ? "codex" : "antigravity",
      specification: {
        name: opportunity.topic,
        description: `${opportunity.purpose} — ${opportunity.targetAudience}`,
        features: this.inferFeatures(opportunity),
        tech_stack: this.inferTechStack(opportunity),
        architecture: arch,
        complexity: opportunity.complexity,
      },
      acceptance_criteria: this.inferAcceptanceCriteria(opportunity),
      constraints: arch.constraints,
      createdAt: new Date().toISOString(),
    };

    evidence.push({
      step: "specification",
      timestamp: new Date().toISOString(),
      description: `HandoffContract generated for ${contract.target_agent}`,
      data: { contractId: contract.id, targetAgent: contract.target_agent },
    });

    evidence.push({
      step: "production",
      timestamp: new Date().toISOString(),
      description: "Software specification ready for handoff — no rendering required",
      data: { features: contract.specification.features.length },
    });

    evidence.push({
      step: "qa",
      timestamp: new Date().toISOString(),
      description: "Software products are QA'd by implementation agent",
      data: { passed: true },
    });

    return {
      success: true,
      product_type: opportunity.productType,
      artifact_path: null,
      dossier_id: randomUUID(),
      evidence,
      qa_result: {
        passed: true,
        issues_count: 0,
        details: "HandoffContract ready — QA delegated to implementation agent",
      },
      handoff_contract: contract,
      production_time_ms: 0,
      errors: [],
    };
  }

  /**
   * Produce a hybrid product (content + software).
   */
  private async produceHybridProduct(
    opportunity: ProductOpportunity,
    fit: FitResult,
    arch: ArchitectureDecision,
    evidence: ProductEvidence[],
    executionId: string
  ): Promise<ProductResult> {
    const startTime = Date.now();

    // Produce the content component
    const contentResult = await this.produceContentProduct(
      opportunity, fit, arch, evidence, executionId
    );

    // Produce the software component
    const softwareResult = this.produceSoftwareProduct(
      opportunity, fit, arch, evidence
    );

    const combinedSuccess = contentResult.success && softwareResult.success;

    return {
      success: combinedSuccess,
      product_type: opportunity.productType,
      artifact_path: contentResult.artifact_path,
      dossier_id: randomUUID(),
      evidence,
      qa_result: {
        passed: combinedSuccess,
        issues_count: contentResult.qa_result.issues_count + softwareResult.qa_result.issues_count,
        details: `Content: ${contentResult.qa_result.details} | Software: ${softwareResult.qa_result.details}`,
      },
      book_product: contentResult.book_product,
      handoff_contract: softwareResult.handoff_contract,
      production_time_ms: Date.now() - startTime,
      errors: [...contentResult.errors, ...softwareResult.errors],
    };
  }

  /**
   * Get required capabilities for a production path.
   */
  private getRequiredCapabilities(path: FitResult["production_path"]): string[] {
    const capabilities: Record<FitResult["production_path"], string[]> = {
      "book-factory-full": [
        "zai-content-generation",
        "art-direction",
        "cover-design",
        "editorial-design",
        "deterministic-layout",
        "pdf-generation",
        "visual-qa",
        "repair-loop",
      ],
      "book-factory-streamlined": [
        "zai-content-generation",
        "art-direction",
        "editorial-design",
        "pdf-generation",
        "visual-qa",
      ],
      "handoff-contract": [
        "software-specification",
        "architecture-design",
        "acceptance-criteria",
      ],
      "hybrid": [
        "zai-content-generation",
        "art-direction",
        "cover-design",
        "editorial-design",
        "deterministic-layout",
        "pdf-generation",
        "visual-qa",
        "repair-loop",
        "software-specification",
        "architecture-design",
      ],
    };

    return capabilities[path] ?? [];
  }

  /**
   * Estimate production time in seconds.
   */
  private estimateProductionTime(
    path: FitResult["production_path"],
    opportunity: ProductOpportunity
  ): number {
    const baseTimes: Record<FitResult["production_path"], number> = {
      "book-factory-full": 60,
      "book-factory-streamlined": 30,
      "handoff-contract": 5,
      "hybrid": 65,
    };

    const base = baseTimes[path] ?? 60;
    // Scale by section count (more sections = more time)
    const scale = 1 + (opportunity.sectionCount / 10) * 0.5;
    return Math.round(base * scale);
  }

  /**
   * Infer features from opportunity (for software products).
   */
  private inferFeatures(
    opportunity: ProductOpportunity
  ): SoftwareSpecification["features"] {
    return [
      { name: "core-functionality", description: opportunity.purpose, priority: "must" },
      { name: "user-auth", description: "User authentication and authorization", priority: "must" },
      { name: "dashboard", description: "Main dashboard interface", priority: "should" },
      { name: "analytics", description: "Usage analytics and reporting", priority: "nice" },
    ];
  }

  /**
   * Infer tech stack from opportunity.
   */
  private inferTechStack(opportunity: ProductOpportunity): string[] {
    const stacks: Record<string, string[]> = {
      simple: ["Next.js", "TypeScript", "Tailwind CSS", "Prisma"],
      moderate: ["Next.js", "TypeScript", "Tailwind CSS", "Prisma", "Zustand"],
      complex: ["Next.js", "TypeScript", "Tailwind CSS", "Prisma", "Zustand", "TanStack Query"],
    };
    return stacks[opportunity.complexity] ?? stacks["moderate"];
  }

  /**
   * Infer acceptance criteria from opportunity.
   */
  private inferAcceptanceCriteria(opportunity: ProductOpportunity): string[] {
    return [
      `Product must serve ${opportunity.targetAudience} effectively`,
      `Product must fulfill purpose: ${opportunity.purpose}`,
      "All features classified as 'must' are implemented and working",
      "No critical bugs in production deployment",
      "Performance meets baseline thresholds (LCP < 2.5s, FID < 100ms)",
    ];
  }

  /**
   * Store product dossier in memory for traceability.
   */
  private async storeDossier(
    opportunity: ProductOpportunity,
    bookProduct: BookProduct,
    dossierId: string
  ): Promise<void> {
    try {
      await this.memory.store("krea", "product-dossier", "EPISODIC", {
        dossierId,
        topic: opportunity.topic,
        productType: opportunity.productType,
        pageCount: bookProduct.pdf.pageCount,
        wordCount: bookProduct.content.total_word_count,
        qaPassed: bookProduct.qa_result.passed,
        pdfVerified: bookProduct.pdf_verification.overall,
        productionTimeMs: bookProduct.production_time_ms,
        repairIterations: bookProduct.repair_iterations_used,
      }, {
        source: "product-factory",
        sourceType: "AGENT",
        confidence: 0.95,
        truthLevel: "OBSERVED",
        scope: "agent",
      });
    } catch {
      // Memory storage failure is non-critical
    }
  }
}
