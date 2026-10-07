/**
 * Evidence Contract — ADN GENERAL DEL AGENTE V1.0
 *
 * Defines the truth/provenance system for all data and decisions
 * within the agent. Every piece of data has a truth level, confidence,
 * and a provenance chain that tracks its lineage.
 *
 * This enables:
 * - Trust scoring: How much should we trust a piece of data?
 * - Data lineage: Where did this data come from?
 * - Verification: Has this data been independently verified?
 * - Audit: Can we trace every decision back to its sources?
 */

import { randomUUID } from "crypto";

// ─── Truth Levels ────────────────────────────────────────────────────────────

/**
 * Truth levels ordered by reliability (highest to lowest).
 * Each level indicates how much confidence we can place in the data.
 *
 * OBSERVED   — Directly observed/measured (e.g., API response, DB record)
 * VERIFIED   — Independently verified against a trusted source
 * ESTIMATED  — Estimated based on known parameters or historical data
 * MODELED    — Output of a model/simulation (e.g., AI generation)
 * INFERRED   — Derived by logical inference from other evidence
 * UNKNOWN    — Truth level not yet assessed
 */
export type TruthLevel = "OBSERVED" | "VERIFIED" | "ESTIMATED" | "MODELED" | "INFERRED" | "UNKNOWN";

/** Numeric ordering for truth level comparison (higher = more reliable) */
export const TRUTH_LEVEL_ORDER: Record<TruthLevel, number> = {
  OBSERVED: 5,
  VERIFIED: 4,
  ESTIMATED: 3,
  MODELED: 2,
  INFERRED: 1,
  UNKNOWN: 0,
};

/**
 * Compare two truth levels.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
export function compareTruthLevels(a: TruthLevel, b: TruthLevel): number {
  return TRUTH_LEVEL_ORDER[a] - TRUTH_LEVEL_ORDER[b];
}

/**
 * Get the weakest truth level from a set (for combining evidence).
 */
export function weakestTruthLevel(levels: TruthLevel[]): TruthLevel {
  if (levels.length === 0) return "UNKNOWN";
  let weakest: TruthLevel = levels[0];
  for (const level of levels) {
    if (TRUTH_LEVEL_ORDER[level] < TRUTH_LEVEL_ORDER[weakest]) {
      weakest = level;
    }
  }
  return weakest;
}

// ─── Verification Status ─────────────────────────────────────────────────────

/** Status of evidence verification */
export type VerificationStatus =
  | "UNVERIFIED"       // No verification attempted
  | "PENDING"          // Verification in progress
  | "VERIFIED_PASS"    // Verified and confirmed correct
  | "VERIFIED_FAIL"    // Verified and found incorrect
  | "VERIFICATION_ERROR" // Verification attempted but failed
  | "EXEMPT";          // Exempt from verification (e.g., system data)

// ─── Source Types ────────────────────────────────────────────────────────────

/** Type of evidence source */
export type SourceType =
  | "api_response"     // Direct API response
  | "db_record"        // Database record
  | "user_input"       // User-provided data
  | "ai_generation"    // AI model output
  | "computation"      // Computed/derived result
  | "external_agent"   // Data from another agent
  | "system_config"    // System configuration
  | "file_system"      // File system data
  | "manual_entry"     // Manually entered data
  | "sensor"           // Sensor/measurement data
  | "unknown";         // Unknown source

// ─── Evidence Record ─────────────────────────────────────────────────────────

/**
 * A single piece of evidence — the atomic unit of trust.
 * Every data point in the system should have an associated Evidence record.
 */
export interface Evidence {
  /** Unique evidence identifier */
  evidenceId: string;

  /** Source that produced this evidence */
  source: string;

  /** Type of source */
  sourceType: SourceType;

  /** Timestamp when evidence was created */
  timestamp: string;

  /** The fact or data this evidence supports */
  extractedFact: string;

  /** Confidence in this evidence (0-1) */
  confidence: number;

  /** Truth level classification */
  truthLevel: TruthLevel;

  /** Provenance chain (link to parent evidence) */
  provenance: ProvenanceLink[];

  /** Verification status */
  verificationStatus: VerificationStatus;

  /** When verification was last performed */
  verifiedAt?: string;

  /** Who or what performed the verification */
  verifiedBy?: string;

  /** Execution ID this evidence belongs to */
  executionId?: string;

  /** Correlation ID for linking related evidence */
  correlationId?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ─── Provenance Link ─────────────────────────────────────────────────────────

/**
 * A link in the provenance chain.
 * Tracks where a piece of evidence came from and how it was derived.
 */
export interface ProvenanceLink {
  /** Parent evidence ID (empty for root evidence) */
  parentEvidenceId: string;

  /** How the child was derived from the parent */
  derivationMethod: string;

  /** Timestamp of derivation */
  timestamp: string;

  /** Agent or process that performed the derivation */
  derivedBy: string;

  /** Confidence adjustment applied during derivation */
  confidenceDelta: number;
}

// ─── Provenance Chain ────────────────────────────────────────────────────────

/**
 * Full provenance chain for tracking data lineage.
 * Enables tracing any output back to its original sources.
 */
export class ProvenanceChain {
  private evidence: Map<string, Evidence> = new Map();

  /** Add evidence to the chain */
  addEvidence(evidence: Evidence): void {
    this.evidence.set(evidence.evidenceId, evidence);
  }

  /** Get evidence by ID */
  getEvidence(evidenceId: string): Evidence | undefined {
    return this.evidence.get(evidenceId);
  }

  /** Get all evidence in the chain */
  getAllEvidence(): Evidence[] {
    return Array.from(this.evidence.values());
  }

  /**
   * Trace the full provenance path for a piece of evidence.
   * Returns the chain from root to the specified evidence.
   */
  traceProvenance(evidenceId: string): Evidence[] {
    const result: Evidence[] = [];
    const current = this.evidence.get(evidenceId);
    if (!current) return result;

    result.unshift(current);

    // Walk up the provenance chain
    const visited = new Set<string>([evidenceId]);
    let toProcess = [...current.provenance];

    while (toProcess.length > 0) {
      const link = toProcess.shift()!;
      if (visited.has(link.parentEvidenceId)) continue;
      visited.add(link.parentEvidenceId);

      const parent = this.evidence.get(link.parentEvidenceId);
      if (parent) {
        result.unshift(parent);
        toProcess.push(...parent.provenance);
      }
    }

    return result;
  }

  /**
   * Get the root evidence (original sources) for a given evidence ID.
   */
  getRoots(evidenceId: string): Evidence[] {
    const chain = this.traceProvenance(evidenceId);
    return chain.filter((e) => e.provenance.length === 0 || e.provenance.every((p) => !this.evidence.has(p.parentEvidenceId)));
  }

  /**
   * Calculate the effective confidence for a piece of evidence,
   * considering the full provenance chain.
   */
  calculateEffectiveConfidence(evidenceId: string): number {
    const chain = this.traceProvenance(evidenceId);
    if (chain.length === 0) return 0;

    // Effective confidence is the product of all confidence values in the chain
    let effective = 1.0;
    for (const evidence of chain) {
      effective *= evidence.confidence;
    }
    return effective;
  }

  /**
   * Get the weakest truth level in the provenance chain.
   * A chain is only as strong as its weakest link.
   */
  getWeakestTruthLevel(evidenceId: string): TruthLevel {
    const chain = this.traceProvenance(evidenceId);
    if (chain.length === 0) return "UNKNOWN";
    return weakestTruthLevel(chain.map((e) => e.truthLevel));
  }

  /**
   * Check if any evidence in the chain has failed verification.
   */
  hasVerificationFailure(evidenceId: string): boolean {
    const chain = this.traceProvenance(evidenceId);
    return chain.some(
      (e) => e.verificationStatus === "VERIFIED_FAIL"
    );
  }

  /** Get the number of evidence records in the chain */
  size(): number {
    return this.evidence.size;
  }
}

// ─── Evidence Builder ────────────────────────────────────────────────────────

/**
 * Builder for creating Evidence records with a fluent API.
 */
export class EvidenceBuilder {
  private evidence: Partial<Evidence> = {};

  fromSource(source: string, sourceType: SourceType): this {
    this.evidence.source = source;
    this.evidence.sourceType = sourceType;
    return this;
  }

  withFact(fact: string): this {
    this.evidence.extractedFact = fact;
    return this;
  }

  withConfidence(confidence: number): this {
    this.evidence.confidence = Math.max(0, Math.min(1, confidence));
    return this;
  }

  withTruthLevel(level: TruthLevel): this {
    this.evidence.truthLevel = level;
    return this;
  }

  withProvenance(links: ProvenanceLink[]): this {
    this.evidence.provenance = links;
    return this;
  }

  withVerification(status: VerificationStatus, verifiedBy?: string): this {
    this.evidence.verificationStatus = status;
    this.evidence.verifiedAt = new Date().toISOString();
    this.evidence.verifiedBy = verifiedBy;
    return this;
  }

  withExecutionId(executionId: string): this {
    this.evidence.executionId = executionId;
    return this;
  }

  withCorrelationId(correlationId: string): this {
    this.evidence.correlationId = correlationId;
    return this;
  }

  withMetadata(metadata: Record<string, unknown>): this {
    this.evidence.metadata = metadata;
    return this;
  }

  build(): Evidence {
    return {
      evidenceId: randomUUID(),
      source: this.evidence.source || "unknown",
      sourceType: this.evidence.sourceType || "unknown",
      timestamp: new Date().toISOString(),
      extractedFact: this.evidence.extractedFact || "",
      confidence: this.evidence.confidence ?? 0.5,
      truthLevel: this.evidence.truthLevel || "UNKNOWN",
      provenance: this.evidence.provenance || [],
      verificationStatus: this.evidence.verificationStatus || "UNVERIFIED",
      verifiedAt: this.evidence.verifiedAt,
      verifiedBy: this.evidence.verifiedBy,
      executionId: this.evidence.executionId,
      correlationId: this.evidence.correlationId,
      metadata: this.evidence.metadata,
    };
  }
}

// ─── Evidence Store ──────────────────────────────────────────────────────────

/**
 * In-memory evidence store for the current execution context.
 * In production, this would persist to the database.
 */
export class EvidenceStore {
  private store: Map<string, Evidence> = new Map();
  private chains: Map<string, ProvenanceChain> = new Map();

  /** Store a piece of evidence */
  add(evidence: Evidence): void {
    this.store.set(evidence.evidenceId, evidence);
  }

  /** Get evidence by ID */
  get(evidenceId: string): Evidence | undefined {
    return this.store.get(evidenceId);
  }

  /** Get all evidence for an execution */
  getByExecution(executionId: string): Evidence[] {
    return Array.from(this.store.values()).filter((e) => e.executionId === executionId);
  }

  /** Get all evidence for a correlation */
  getByCorrelation(correlationId: string): Evidence[] {
    return Array.from(this.store.values()).filter((e) => e.correlationId === correlationId);
  }

  /** Get or create a provenance chain */
  getChain(chainId: string): ProvenanceChain {
    let chain = this.chains.get(chainId);
    if (!chain) {
      chain = new ProvenanceChain();
      this.chains.set(chainId, chain);
    }
    return chain;
  }

  /** Get all evidence with a specific truth level or below */
  getByMaxTruthLevel(maxLevel: TruthLevel): Evidence[] {
    return Array.from(this.store.values()).filter(
      (e) => TRUTH_LEVEL_ORDER[e.truthLevel] <= TRUTH_LEVEL_ORDER[maxLevel]
    );
  }

  /** Get unverified evidence */
  getUnverified(): Evidence[] {
    return Array.from(this.store.values()).filter(
      (e) => e.verificationStatus === "UNVERIFIED" || e.verificationStatus === "PENDING"
    );
  }

  /** Update verification status */
  verify(evidenceId: string, status: VerificationStatus, verifiedBy: string): void {
    const evidence = this.store.get(evidenceId);
    if (evidence) {
      evidence.verificationStatus = status;
      evidence.verifiedAt = new Date().toISOString();
      evidence.verifiedBy = verifiedBy;
    }
  }

  /** Total evidence count */
  size(): number {
    return this.store.size;
  }
}
