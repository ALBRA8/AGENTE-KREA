/**
 * Product Dossier Manager — KREA V2 Product Brain
 *
 * Master repository for all product knowledge and lifecycle state.
 * Tracks a product from IDEA through LAUNCHED and beyond.
 *
 * Acceptance Criteria satisfied:
 *   AC-023: Lifecycle states with validated transitions
 *   AC-053: Memory isolation — product memories don't contaminate other products
 *
 * Lifecycle states:
 *   IDEA → RESEARCHING → VALIDATING → APPROVED → ARCHITECTING → SPECIFIED →
 *   BUILDING → QA → READY → LAUNCHED → ITERATING → PAUSED → KILLED → ARCHIVED
 *
 * Each dossier is a self-contained product record with full version history.
 * Uses in-memory storage + MemoryDV persistence for durability.
 */

import { randomUUID } from "crypto";
import { MemoryManager } from "@/lib/memory";
import { ExecutionTracer } from "@/lib/execution";
import { ProductEvidence } from "./product-intelligence";
import { FitResult } from "./product-fit";
import { ProductDecision } from "./product-decision";
import { ProductArchitecture } from "./product-architecture";
import { ProductSpecification, SoftwareSpecification, HandoffContract } from "./product-specification";

// ─── Lifecycle States (AC-023) ────────────────────────────────────────────────

/** Product lifecycle states */
export type DossierStatus =
  | "IDEA"
  | "RESEARCHING"
  | "VALIDATING"
  | "APPROVED"
  | "ARCHITECTING"
  | "SPECIFIED"
  | "BUILDING"
  | "QA"
  | "READY"
  | "LAUNCHED"
  | "ITERATING"
  | "PAUSED"
  | "KILLED"
  | "ARCHIVED";

/** Valid state transitions (AC-023) */
const VALID_TRANSITIONS: Record<DossierStatus, DossierStatus[]> = {
  IDEA:         ["RESEARCHING", "KILLED", "ARCHIVED"],
  RESEARCHING:  ["VALIDATING", "IDEA", "KILLED", "ARCHIVED"],
  VALIDATING:   ["APPROVED", "IDEA", "RESEARCHING", "KILLED", "ARCHIVED"],
  APPROVED:     ["ARCHITECTING", "KILLED", "PAUSED", "ARCHIVED"],
  ARCHITECTING: ["SPECIFIED", "APPROVED", "KILLED", "PAUSED", "ARCHIVED"],
  SPECIFIED:    ["BUILDING", "ARCHITECTING", "KILLED", "PAUSED", "ARCHIVED"],
  BUILDING:     ["QA", "SPECIFIED", "KILLED", "PAUSED", "ARCHIVED"],
  QA:           ["READY", "BUILDING", "KILLED", "PAUSED", "ARCHIVED"],
  READY:        ["LAUNCHED", "QA", "KILLED", "PAUSED", "ARCHIVED"],
  LAUNCHED:     ["ITERATING", "PAUSED", "KILLED", "ARCHIVED"],
  ITERATING:    ["LAUNCHED", "PAUSED", "KILLED", "ARCHIVED"],
  PAUSED:       ["IDEA", "RESEARCHING", "VALIDATING", "APPROVED", "ARCHITECTING", "SPECIFIED", "BUILDING", "QA", "READY", "LAUNCHED", "ITERATING", "KILLED", "ARCHIVED"],
  KILLED:       ["ARCHIVED"],
  ARCHIVED:     [],
};

// ─── Dossier Types ────────────────────────────────────────────────────────────

/** A change record in the dossier history */
export interface DossierChange {
  /** Change ID */
  id: string;
  /** What changed */
  field: string;
  /** Previous value */
  oldValue: unknown;
  /** New value */
  newValue: unknown;
  /** Who made the change */
  changedBy: string;
  /** When */
  timestamp: string;
  /** Reason for the change */
  reason: string;
}

/** QA result */
export interface QAResult {
  /** Test/audit ID */
  id: string;
  /** What was tested */
  what: string;
  /** Result */
  result: "PASS" | "FAIL" | "PARTIAL";
  /** Details */
  details: string;
  /** Timestamp */
  timestamp: string;
}

/** User feedback */
export interface ProductFeedback {
  /** Feedback ID */
  id: string;
  /** Feedback content */
  content: string;
  /** Source (user ID, channel, etc.) */
  source: string;
  /** Type */
  type: "praise" | "complaint" | "suggestion" | "bug_report" | "feature_request";
  /** Severity (for complaints/bugs) */
  severity?: "low" | "medium" | "high" | "critical";
  /** Timestamp */
  timestamp: string;
}

/** Learning from the product */
export interface ProductLearning {
  /** Learning ID */
  id: string;
  /** What was learned */
  lesson: string;
  /** Context */
  context: string;
  /** Category */
  category: "market" | "user" | "technical" | "process" | "economic";
  /** Confidence in this learning */
  confidence: number;
  /** Timestamp */
  timestamp: string;
}

/** Economics estimate */
export interface EconomicsEstimate {
  /** Estimated cost to produce */
  estimated_cost: number;
  /** Ongoing production cost per month */
  production_cost: number;
  /** Tools and services cost per month */
  tools_cost: number;
  /** Provider/API cost per month */
  provider_cost: number;
  /** Suggested price */
  suggested_price: number;
  /** Profit margin (0-1) */
  margin: number;
  /** Currency */
  currency: string;
}

/** Complete product dossier */
export interface ProductDossier {
  /** Unique dossier ID */
  id: string;
  /** Product name */
  name: string;
  /** Domain */
  domain: string;
  /** Current lifecycle status */
  status: DossierStatus;
  /** The opportunity this dossier addresses */
  opportunity: {
    name: string;
    domain: string;
    problem: string;
    solution: string;
    audience: string;
    format?: string;
  };
  /** Gathered evidence */
  evidence: ProductEvidence[];
  /** Fit evaluation result */
  fitResult: FitResult | null;
  /** Product decision */
  decision: ProductDecision | null;
  /** Product architecture */
  architecture: ProductArchitecture | null;
  /** Product specification */
  specification: ProductSpecification | null;
  /** Software specification */
  softwareSpecification: SoftwareSpecification | null;
  /** Handoff contracts */
  handoffs: HandoffContract[];
  /** Production status */
  productionStatus: string;
  /** QA results */
  qaResults: QAResult[];
  /** User feedback */
  feedback: ProductFeedback[];
  /** Learnings */
  learnings: ProductLearning[];
  /** Economics */
  economics: EconomicsEstimate | null;
  /** Version number */
  version: number;
  /** Change history */
  changes: DossierChange[];
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/** Filter options for listing dossiers */
export interface DossierFilters {
  status?: DossierStatus;
  domain?: string;
  nameContains?: string;
  createdAfter?: string;
  createdBefore?: string;
  limit?: number;
  offset?: number;
}

// ─── Product Dossier Manager ──────────────────────────────────────────────────

/**
 * ProductDossierManager — Master product lifecycle manager.
 *
 * AC-023: Lifecycle transitions are validated — only valid state changes allowed.
 * AC-053: Each dossier is stored in its own memory domain for isolation.
 */
export class ProductDossierManager {
  private dossiers: Map<string, ProductDossier> = new Map();
  private memory: MemoryManager;
  private tracer: ExecutionTracer;

  constructor(memory?: MemoryManager, tracer?: ExecutionTracer) {
    this.memory = memory || new MemoryManager();
    this.tracer = tracer || new ExecutionTracer();
  }

  /**
   * create — Start a new product dossier.
   *
   * Creates a dossier in IDEA status with the given opportunity.
   * AC-053: Stores in product-isolated memory domain.
   */
  async create(opportunity: {
    name: string;
    domain: string;
    problem: string;
    solution: string;
    audience: string;
    format?: string;
  }): Promise<string> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const dossier: ProductDossier = {
      id,
      name: opportunity.name,
      domain: opportunity.domain,
      status: "IDEA",
      opportunity,
      evidence: [],
      fitResult: null,
      decision: null,
      architecture: null,
      specification: null,
      softwareSpecification: null,
      handoffs: [],
      productionStatus: "not_started",
      qaResults: [],
      feedback: [],
      learnings: [],
      economics: null,
      version: 1,
      changes: [],
      createdAt: now,
      updatedAt: now,
    };

    this.dossiers.set(id, dossier);

    // Persist to product-isolated memory (AC-053)
    await this.persistDossier(dossier);

    return id;
  }

  /**
   * get — Retrieve a complete dossier.
   */
  async get(dossierId: string): Promise<ProductDossier | null> {
    return this.dossiers.get(dossierId) || null;
  }

  /**
   * update — Update dossier fields.
   *
   * Records the change in the version history.
   */
  async update(
    dossierId: string,
    updates: Partial<{
      name: string;
      domain: string;
      opportunity: ProductDossier["opportunity"];
      fitResult: FitResult;
      decision: ProductDecision;
      architecture: ProductArchitecture;
      specification: ProductSpecification;
      softwareSpecification: SoftwareSpecification;
      economics: EconomicsEstimate;
      productionStatus: string;
    }>,
    changedBy: string = "krea",
    reason: string = "Update"
  ): Promise<ProductDossier | null> {
    const dossier = this.dossiers.get(dossierId);
    if (!dossier) return null;

    const now = new Date().toISOString();

    // Record changes
    for (const [field, newValue] of Object.entries(updates)) {
      const oldValue = (dossier as Record<string, unknown>)[field];
      dossier.changes.push({
        id: randomUUID(),
        field,
        oldValue,
        newValue,
        changedBy,
        timestamp: now,
        reason,
      });
    }

    // Apply updates
    Object.assign(dossier, updates);
    dossier.version++;
    dossier.updatedAt = now;

    this.dossiers.set(dossierId, dossier);
    await this.persistDossier(dossier);

    return dossier;
  }

  /**
   * transition — Transition dossier to a new lifecycle status.
   *
   * AC-023: Only valid transitions are allowed. Invalid transitions
   * throw an error with the list of valid next states.
   */
  async transition(
    dossierId: string,
    newStatus: DossierStatus,
    changedBy: string = "krea",
    reason: string = ""
  ): Promise<ProductDossier | null> {
    const dossier = this.dossiers.get(dossierId);
    if (!dossier) return null;

    const currentStatus = dossier.status;

    // Validate transition (AC-023)
    if (!VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
      throw new Error(
        `Invalid transition: ${currentStatus} → ${newStatus}. ` +
        `Valid transitions from ${currentStatus}: ${VALID_TRANSITIONS[currentStatus].join(", ")}`
      );
    }

    const now = new Date().toISOString();

    dossier.changes.push({
      id: randomUUID(),
      field: "status",
      oldValue: currentStatus,
      newValue: newStatus,
      changedBy,
      timestamp: now,
      reason: reason || `Transition from ${currentStatus} to ${newStatus}`,
    });

    dossier.status = newStatus;
    dossier.version++;
    dossier.updatedAt = now;

    this.dossiers.set(dossierId, dossier);
    await this.persistDossier(dossier);

    return dossier;
  }

  /**
   * addEvidence — Add evidence to the dossier.
   */
  async addEvidence(
    dossierId: string,
    evidence: ProductEvidence[]
  ): Promise<ProductDossier | null> {
    const dossier = this.dossiers.get(dossierId);
    if (!dossier) return null;

    dossier.evidence.push(...evidence);
    dossier.version++;
    dossier.updatedAt = new Date().toISOString();

    this.dossiers.set(dossierId, dossier);
    await this.persistDossier(dossier);

    return dossier;
  }

  /**
   * addDecision — Record a product decision.
   */
  async addDecision(
    dossierId: string,
    decision: ProductDecision
  ): Promise<ProductDossier | null> {
    const dossier = this.dossiers.get(dossierId);
    if (!dossier) return null;

    dossier.decision = decision;
    dossier.changes.push({
      id: randomUUID(),
      field: "decision",
      oldValue: null,
      newValue: decision.decision,
      changedBy: "krea",
      timestamp: new Date().toISOString(),
      reason: `Decision: ${decision.decision}`,
    });
    dossier.version++;
    dossier.updatedAt = new Date().toISOString();

    this.dossiers.set(dossierId, dossier);
    await this.persistDossier(dossier);

    return dossier;
  }

  /**
   * addFeedback — Add user feedback to the dossier.
   */
  async addFeedback(
    dossierId: string,
    feedback: Omit<ProductFeedback, "id" | "timestamp">
  ): Promise<ProductDossier | null> {
    const dossier = this.dossiers.get(dossierId);
    if (!dossier) return null;

    dossier.feedback.push({
      ...feedback,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    });
    dossier.version++;
    dossier.updatedAt = new Date().toISOString();

    this.dossiers.set(dossierId, dossier);
    await this.persistDossier(dossier);

    return dossier;
  }

  /**
   * getVersionHistory — Get all changes made to the dossier.
   */
  getVersionHistory(dossierId: string): DossierChange[] {
    const dossier = this.dossiers.get(dossierId);
    if (!dossier) return [];
    return [...dossier.changes];
  }

  /**
   * list — List dossiers with optional filters.
   */
  list(filters: DossierFilters = {}): ProductDossier[] {
    let results = Array.from(this.dossiers.values());

    if (filters.status) {
      results = results.filter((d) => d.status === filters.status);
    }
    if (filters.domain) {
      results = results.filter((d) => d.domain === filters.domain);
    }
    if (filters.nameContains) {
      const search = filters.nameContains.toLowerCase();
      results = results.filter((d) => d.name.toLowerCase().includes(search));
    }
    if (filters.createdAfter) {
      results = results.filter((d) => d.createdAt >= filters.createdAfter!);
    }
    if (filters.createdBefore) {
      results = results.filter((d) => d.createdAt <= filters.createdBefore!);
    }

    // Sort by most recently updated
    results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get valid next statuses for a dossier.
   */
  getValidTransitions(dossierId: string): DossierStatus[] {
    const dossier = this.dossiers.get(dossierId);
    if (!dossier) return [];
    return VALID_TRANSITIONS[dossier.status];
  }

  /**
   * Get dossier statistics.
   */
  getStats(): {
    total: number;
    byStatus: Record<DossierStatus, number>;
    byDomain: Record<string, number>;
  } {
    const all = Array.from(this.dossiers.values());
    const byStatus: Record<DossierStatus, number> = {
      IDEA: 0, RESEARCHING: 0, VALIDATING: 0, APPROVED: 0,
      ARCHITECTING: 0, SPECIFIED: 0, BUILDING: 0, QA: 0,
      READY: 0, LAUNCHED: 0, ITERATING: 0, PAUSED: 0,
      KILLED: 0, ARCHIVED: 0,
    };
    const byDomain: Record<string, number> = {};

    for (const d of all) {
      byStatus[d.status]++;
      byDomain[d.domain] = (byDomain[d.domain] || 0) + 1;
    }

    return { total: all.length, byStatus, byDomain };
  }

  // ─── Persistence ───────────────────────────────────────────────────────

  /**
   * Persist dossier to MemoryDV.
   *
   * AC-053: Each product is stored in its own isolated memory domain
   * (`product:{id}:dossier`) to prevent cross-contamination.
   */
  private async persistDossier(dossier: ProductDossier): Promise<void> {
    await this.memory.store(
      "krea",
      `product:${dossier.id}:dossier`,
      "FACTUAL",
      {
        id: dossier.id,
        name: dossier.name,
        status: dossier.status,
        version: dossier.version,
        domain: dossier.domain,
        // Store a summary to avoid oversized memory entries
        evidenceCount: dossier.evidence.length,
        hasFitResult: !!dossier.fitResult,
        hasDecision: !!dossier.decision,
        hasArchitecture: !!dossier.architecture,
        hasSpecification: !!dossier.specification,
        handoffCount: dossier.handoffs.length,
        feedbackCount: dossier.feedback.length,
        learningCount: dossier.learnings.length,
      },
      {
        source: "product_dossier_manager",
        sourceType: "SYSTEM",
        confidence: 1.0,
        truthLevel: "OBSERVED",
        scope: "agent",
      }
    );
  }
}
