/**
 * Product Dossier Manager — KREA V2 Product Brain (DB-Backed)
 *
 * Master repository for all product knowledge and lifecycle state.
 * Tracks a product from IDEA through LAUNCHED and beyond.
 *
 * All state is persisted to the Prisma ProductDossier model as the PRIMARY store.
 * No in-memory Map — every get/update operates directly on the database.
 * On server restart, all dossiers are automatically available from DB (rehydration).
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
 */

import { db } from "@/lib/db";
import { randomUUID } from "crypto";

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

/** All valid lifecycle statuses for runtime validation */
export const ALL_STATUSES: DossierStatus[] = [
  "IDEA", "RESEARCHING", "VALIDATING", "APPROVED",
  "ARCHITECTING", "SPECIFIED", "BUILDING", "QA",
  "READY", "LAUNCHED", "ITERATING", "PAUSED",
  "KILLED", "ARCHIVED",
];

/** Valid state transitions (AC-023) — strictly enforced */
const VALID_TRANSITIONS: Record<DossierStatus, DossierStatus[]> = {
  IDEA:         ["RESEARCHING"],
  RESEARCHING:  ["VALIDATING", "IDEA"],
  VALIDATING:   ["APPROVED", "IDEA", "RESEARCHING"],
  APPROVED:     ["ARCHITECTING", "KILLED"],
  ARCHITECTING: ["SPECIFIED", "APPROVED"],
  SPECIFIED:    ["BUILDING", "APPROVED"],
  BUILDING:     ["QA", "SPECIFIED"],
  QA:           ["READY", "BUILDING"],
  READY:        ["LAUNCHED", "BUILDING"],
  LAUNCHED:     ["ITERATING", "PAUSED"],
  ITERATING:    ["LAUNCHED", "PAUSED"],
  PAUSED:       ["ITERATING", "KILLED"],
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

/** Product evidence (simplified to avoid cross-module coupling) */
export interface ProductEvidence {
  /** Evidence ID */
  id: string;
  /** What was observed */
  observation: string;
  /** Source */
  source: string;
  /** Confidence */
  confidence: number;
  /** Timestamp */
  timestamp: string;
}

/** Fit result (simplified) */
export interface FitResult {
  /** Overall score */
  score: number;
  /** Verdict */
  verdict: "GO" | "NO_GO" | "MAYBE";
  /** Reasoning */
  reasoning: string;
  /** Timestamp */
  timestamp: string;
}

/** Product decision (simplified) */
export interface ProductDecision {
  /** Decision ID */
  id: string;
  /** Decision text */
  decision: string;
  /** Rationale */
  rationale: string;
  /** Made by */
  decidedBy: string;
  /** Timestamp */
  timestamp: string;
}

/** Product architecture (simplified) */
export interface ProductArchitecture {
  /** Architecture ID */
  id: string;
  /** Description */
  description: string;
  /** Components */
  components: string[];
  /** Timestamp */
  timestamp: string;
}

/** Product specification (simplified) */
export interface ProductSpecification {
  /** Spec ID */
  id: string;
  /** Description */
  description: string;
  /** Requirements */
  requirements: string[];
  /** Timestamp */
  timestamp: string;
}

/** Software specification (simplified) */
export interface SoftwareSpecification {
  /** Spec ID */
  id: string;
  /** Description */
  description: string;
  /** Tech stack */
  techStack: string[];
  /** Timestamp */
  timestamp: string;
}

/** Handoff contract (simplified) */
export interface HandoffContract {
  /** Contract ID */
  id: string;
  /** From */
  from: string;
  /** To */
  to: string;
  /** Deliverables */
  deliverables: string[];
  /** Timestamp */
  timestamp: string;
}

/** The opportunity a dossier addresses */
export interface ProductOpportunity {
  /** Name */
  name: string;
  /** Domain */
  domain: string;
  /** Problem statement */
  problem: string;
  /** Proposed solution */
  solution: string;
  /** Target audience */
  audience: string;
  /** Product format */
  format?: string;
}

/** Complete product dossier (application-level type) */
export interface ProductDossier {
  /** Unique dossier ID */
  id: string;
  /** Product title */
  title: string;
  /** Description */
  description: string;
  /** Domain */
  domain: string;
  /** Product format */
  format?: string;
  /** Current lifecycle status */
  status: DossierStatus;
  /** Owner user ID */
  userId?: string;
  /** The opportunity this dossier addresses */
  opportunity: ProductOpportunity;
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
  /** Priority */
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/** Filter options for listing dossiers */
export interface DossierFilters {
  status?: DossierStatus;
  domain?: string;
  format?: string;
  userId?: string;
  nameContains?: string;
  createdAfter?: string;
  createdBefore?: string;
  limit?: number;
  offset?: number;
}

/** Fields that can be updated on a dossier */
export interface DossierUpdates {
  title?: string;
  description?: string;
  domain?: string;
  format?: string;
  opportunity?: ProductOpportunity;
  fitResult?: FitResult;
  decision?: ProductDecision;
  architecture?: ProductArchitecture;
  specification?: ProductSpecification;
  softwareSpecification?: SoftwareSpecification;
  economics?: EconomicsEstimate;
  productionStatus?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

// ─── JSON Field Helpers ───────────────────────────────────────────────────────

/** Safely parse a JSON field from DB, returning fallback on failure */
function parseJsonField<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Safely stringify a value for DB storage */
function stringifyField(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

// ─── DB Row ↔ Application Object Mapping ──────────────────────────────────────

/**
 * Convert a Prisma ProductDossier row to the application-level ProductDossier object.
 * All JSON fields are parsed from their string representations.
 */
function rowToDossier(row: {
  id: string;
  title: string;
  description: string;
  domain: string | null;
  status: string;
  userId: string | null;
  opportunity: string | null;
  evidence: string | null;
  fitResult: string | null;
  decision: string | null;
  architecture: string | null;
  specification: string | null;
  handoffs: string | null;
  productionData: string | null;
  qaResults: string | null;
  feedback: string | null;
  learnings: string | null;
  economics: string | null;
  version: number;
  changes: string | null;
  format: string | null;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
}): ProductDossier {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    domain: row.domain ?? "",
    format: row.format ?? undefined,
    status: row.status as DossierStatus,
    userId: row.userId ?? undefined,
    opportunity: parseJsonField<ProductOpportunity>(row.opportunity, {
      name: row.title,
      domain: row.domain ?? "",
      problem: "",
      solution: "",
      audience: "",
    }),
    evidence: parseJsonField<ProductEvidence[]>(row.evidence, []),
    fitResult: parseJsonField<FitResult | null>(row.fitResult, null),
    decision: parseJsonField<ProductDecision | null>(row.decision, null),
    architecture: parseJsonField<ProductArchitecture | null>(row.architecture, null),
    specification: parseJsonField<ProductSpecification | null>(row.specification, null),
    softwareSpecification: null, // stored within specification JSON or separately
    handoffs: parseJsonField<HandoffContract[]>(row.handoffs, []),
    productionStatus: parseJsonField<string>(row.productionData, "not_started"),
    qaResults: parseJsonField<QAResult[]>(row.qaResults, []),
    feedback: parseJsonField<ProductFeedback[]>(row.feedback, []),
    learnings: parseJsonField<ProductLearning[]>(row.learnings, []),
    economics: parseJsonField<EconomicsEstimate | null>(row.economics, null),
    version: row.version,
    changes: parseJsonField<DossierChange[]>(row.changes, []),
    priority: row.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Build the Prisma update payload from application-level updates.
 * Only non-undefined fields are included in the update.
 */
function buildUpdatePayload(
  updates: DossierUpdates,
  changes: DossierChange[],
  version: number
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    version: version + 1,
    changes: stringifyField(changes),
  };

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.domain !== undefined) payload.domain = updates.domain;
  if (updates.format !== undefined) payload.format = updates.format;
  if (updates.opportunity !== undefined) payload.opportunity = stringifyField(updates.opportunity);
  if (updates.fitResult !== undefined) payload.fitResult = stringifyField(updates.fitResult);
  if (updates.decision !== undefined) payload.decision = stringifyField(updates.decision);
  if (updates.architecture !== undefined) payload.architecture = stringifyField(updates.architecture);
  if (updates.specification !== undefined) payload.specification = stringifyField(updates.specification);
  if (updates.softwareSpecification !== undefined) payload.specification = stringifyField(updates.softwareSpecification);
  if (updates.economics !== undefined) payload.economics = stringifyField(updates.economics);
  if (updates.productionStatus !== undefined) payload.productionData = stringifyField(updates.productionStatus);
  if (updates.priority !== undefined) payload.priority = updates.priority;

  return payload;
}

// ─── Product Dossier Manager ──────────────────────────────────────────────────

/**
 * ProductDossierManager — Master product lifecycle manager (DB-backed).
 *
 * AC-023: Lifecycle transitions are validated — only valid state changes allowed.
 * AC-053: Each dossier's memory domain is `product:{id}:dossier` for isolation.
 *
 * All operations read/write directly to the Prisma ProductDossier model.
 * No in-memory state — fully durable across process restarts.
 */
export class ProductDossierManager {
  /**
   * create — Start a new product dossier.
   *
   * Creates a dossier in IDEA status with the given opportunity.
   * Persists directly to DB. Returns the created dossier.
   */
  async create(
    title: string,
    description: string,
    domain: string,
    format?: string,
    userId?: string
  ): Promise<ProductDossier> {
    const now = new Date();

    const opportunity: ProductOpportunity = {
      name: title,
      domain,
      problem: description,
      solution: "",
      audience: "",
      format,
    };

    const row = await db.productDossier.create({
      data: {
        title,
        description,
        domain,
        format: format ?? null,
        status: "IDEA",
        userId: userId ?? null,
        opportunity: stringifyField(opportunity),
        evidence: stringifyField([]),
        fitResult: null,
        decision: null,
        architecture: null,
        specification: null,
        handoffs: stringifyField([]),
        productionData: stringifyField("not_started"),
        qaResults: stringifyField([]),
        feedback: stringifyField([]),
        learnings: stringifyField([]),
        economics: null,
        version: 1,
        changes: stringifyField([]),
        priority: "MEDIUM",
        createdAt: now,
        updatedAt: now,
      },
    });

    return rowToDossier(row);
  }

  /**
   * get — Retrieve a complete dossier from DB.
   *
   * Reads directly from the database. No in-memory cache.
   */
  async get(id: string): Promise<ProductDossier | null> {
    const row = await db.productDossier.findUnique({ where: { id } });
    if (!row) return null;
    return rowToDossier(row);
  }

  /**
   * update — Update dossier fields.
   *
   * Reads from DB, records each changed field in the version history,
   * then writes the updated dossier back to DB.
   */
  async update(
    id: string,
    updates: DossierUpdates,
    changedBy: string = "krea",
    reason: string = "Update"
  ): Promise<ProductDossier | null> {
    const row = await db.productDossier.findUnique({ where: { id } });
    if (!row) return null;

    const dossier = rowToDossier(row);
    const now = new Date().toISOString();

    // Build change records for each updated field
    const newChanges: DossierChange[] = [];
    for (const [field, newValue] of Object.entries(updates)) {
      if (newValue === undefined) continue;
      const oldValue = (dossier as Record<string, unknown>)[field];
      newChanges.push({
        id: randomUUID(),
        field,
        oldValue,
        newValue,
        changedBy,
        timestamp: now,
        reason,
      });
    }

    // Merge with existing changes
    const allChanges = [...dossier.changes, ...newChanges];

    // Build and execute DB update
    const payload = buildUpdatePayload(updates, allChanges, dossier.version);
    const updatedRow = await db.productDossier.update({
      where: { id },
      data: payload,
    });

    return rowToDossier(updatedRow);
  }

  /**
   * transition — Transition dossier to a new lifecycle status.
   *
   * AC-023: Only valid transitions are allowed. Invalid transitions
   * throw an error with the list of valid next states.
   */
  async transition(
    id: string,
    newStatus: DossierStatus,
    changedBy: string = "krea",
    reason: string = ""
  ): Promise<ProductDossier | null> {
    const row = await db.productDossier.findUnique({ where: { id } });
    if (!row) return null;

    const currentStatus = row.status as DossierStatus;

    // Validate transition (AC-023)
    if (!VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
      throw new Error(
        `Invalid transition: ${currentStatus} → ${newStatus}. ` +
        `Valid transitions from ${currentStatus}: ${VALID_TRANSITIONS[currentStatus].join(", ")}`
      );
    }

    const now = new Date().toISOString();
    const existingChanges = parseJsonField<DossierChange[]>(row.changes, []);

    existingChanges.push({
      id: randomUUID(),
      field: "status",
      oldValue: currentStatus,
      newValue: newStatus,
      changedBy,
      timestamp: now,
      reason: reason || `Transition from ${currentStatus} to ${newStatus}`,
    });

    const updatedRow = await db.productDossier.update({
      where: { id },
      data: {
        status: newStatus,
        version: row.version + 1,
        changes: stringifyField(existingChanges),
      },
    });

    return rowToDossier(updatedRow);
  }

  /**
   * addEvidence — Append evidence to the dossier.
   *
   * Reads current evidence array from DB, appends new items, writes back.
   */
  async addEvidence(
    id: string,
    evidence: ProductEvidence[]
  ): Promise<ProductDossier | null> {
    const row = await db.productDossier.findUnique({ where: { id } });
    if (!row) return null;

    const existing = parseJsonField<ProductEvidence[]>(row.evidence, []);
    existing.push(...evidence);

    const existingChanges = parseJsonField<DossierChange[]>(row.changes, []);
    existingChanges.push({
      id: randomUUID(),
      field: "evidence",
      oldValue: existing.length - evidence.length,
      newValue: existing.length,
      changedBy: "krea",
      timestamp: new Date().toISOString(),
      reason: `Added ${evidence.length} evidence item(s)`,
    });

    const updatedRow = await db.productDossier.update({
      where: { id },
      data: {
        evidence: stringifyField(existing),
        version: row.version + 1,
        changes: stringifyField(existingChanges),
      },
    });

    return rowToDossier(updatedRow);
  }

  /**
   * addDecision — Record a product decision.
   *
   * Sets the decision JSON field and records the change in history.
   */
  async addDecision(
    id: string,
    decision: ProductDecision
  ): Promise<ProductDossier | null> {
    const row = await db.productDossier.findUnique({ where: { id } });
    if (!row) return null;

    const now = new Date().toISOString();
    const existingChanges = parseJsonField<DossierChange[]>(row.changes, []);

    existingChanges.push({
      id: randomUUID(),
      field: "decision",
      oldValue: null,
      newValue: decision.decision,
      changedBy: "krea",
      timestamp: now,
      reason: `Decision: ${decision.decision}`,
    });

    const updatedRow = await db.productDossier.update({
      where: { id },
      data: {
        decision: stringifyField(decision),
        version: row.version + 1,
        changes: stringifyField(existingChanges),
      },
    });

    return rowToDossier(updatedRow);
  }

  /**
   * addFeedback — Add user feedback to the dossier.
   *
   * Appends to the feedback JSON array in DB.
   */
  async addFeedback(
    id: string,
    feedback: Omit<ProductFeedback, "id" | "timestamp">
  ): Promise<ProductDossier | null> {
    const row = await db.productDossier.findUnique({ where: { id } });
    if (!row) return null;

    const existing = parseJsonField<ProductFeedback[]>(row.feedback, []);
    const now = new Date().toISOString();

    existing.push({
      ...feedback,
      id: randomUUID(),
      timestamp: now,
    });

    const existingChanges = parseJsonField<DossierChange[]>(row.changes, []);
    existingChanges.push({
      id: randomUUID(),
      field: "feedback",
      oldValue: existing.length - 1,
      newValue: existing.length,
      changedBy: feedback.source || "krea",
      timestamp: now,
      reason: `Feedback added: ${feedback.type}`,
    });

    const updatedRow = await db.productDossier.update({
      where: { id },
      data: {
        feedback: stringifyField(existing),
        version: row.version + 1,
        changes: stringifyField(existingChanges),
      },
    });

    return rowToDossier(updatedRow);
  }

  /**
   * getVersionHistory — Get all changes made to the dossier.
   *
   * Reads the changes JSON array directly from DB.
   */
  async getVersionHistory(id: string): Promise<DossierChange[]> {
    const row = await db.productDossier.findUnique({
      where: { id },
      select: { changes: true },
    });
    if (!row) return [];
    return parseJsonField<DossierChange[]>(row.changes, []);
  }

  /**
   * list — List dossiers with optional filters.
   *
   * Queries DB with Prisma where clauses. Supports status, domain,
   * format, userId, name search, date ranges, and pagination.
   */
  async list(filters: DossierFilters = {}): Promise<ProductDossier[]> {
    const where: Record<string, unknown> = {};

    if (filters.status) where.status = filters.status;
    if (filters.domain) where.domain = filters.domain;
    if (filters.format) where.format = filters.format;
    if (filters.userId) where.userId = filters.userId;
    if (filters.nameContains) {
      where.title = { contains: filters.nameContains, mode: "insensitive" };
    }
    if (filters.createdAfter || filters.createdBefore) {
      const createdAt: Record<string, Date> = {};
      if (filters.createdAfter) createdAt.gte = new Date(filters.createdAfter);
      if (filters.createdBefore) createdAt.lte = new Date(filters.createdBefore);
      where.createdAt = createdAt;
    }

    const offset = filters.offset || 0;
    const limit = filters.limit || 50;

    const rows = await db.productDossier.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: offset,
      take: limit,
    });

    return rows.map(rowToDossier);
  }

  /**
   * Get valid next statuses for a dossier.
   *
   * Reads current status from DB, returns allowed transitions.
   */
  async getValidTransitions(id: string): Promise<DossierStatus[]> {
    const row = await db.productDossier.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!row) return [];
    return VALID_TRANSITIONS[row.status as DossierStatus] || [];
  }

  /**
   * Get dossier statistics across all dossiers in DB.
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<DossierStatus, number>;
    byDomain: Record<string, number>;
  }> {
    const all = await db.productDossier.findMany({
      select: { status: true, domain: true },
    });

    const byStatus: Record<DossierStatus, number> = {
      IDEA: 0, RESEARCHING: 0, VALIDATING: 0, APPROVED: 0,
      ARCHITECTING: 0, SPECIFIED: 0, BUILDING: 0, QA: 0,
      READY: 0, LAUNCHED: 0, ITERATING: 0, PAUSED: 0,
      KILLED: 0, ARCHIVED: 0,
    };
    const byDomain: Record<string, number> = {};

    for (const d of all) {
      const status = d.status as DossierStatus;
      if (status in byStatus) byStatus[status]++;
      const domain = d.domain ?? "unknown";
      byDomain[domain] = (byDomain[domain] || 0) + 1;
    }

    return { total: all.length, byStatus, byDomain };
  }

  /**
   * Delete a dossier from DB.
   *
   * Only allowed if the dossier is in KILLED or ARCHIVED status.
   */
  async delete(id: string): Promise<boolean> {
    const row = await db.productDossier.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!row) return false;

    const status = row.status as DossierStatus;
    if (status !== "KILLED" && status !== "ARCHIVED") {
      throw new Error(
        `Cannot delete dossier in ${status} status. ` +
        `Must be KILLED or ARCHIVED.`
      );
    }

    await db.productDossier.delete({ where: { id } });
    return true;
  }

  /**
   * Get the memory domain for a product dossier.
   *
   * AC-053: Each product is stored in its own isolated memory domain
   * (`product:{id}:dossier`) to prevent cross-contamination.
   */
  static getMemoryDomain(dossierId: string): string {
    return `product:${dossierId}:dossier`;
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

/** Default manager instance for convenience */
export const dossierManager = new ProductDossierManager();
