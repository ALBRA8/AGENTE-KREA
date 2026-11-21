/**
 * Factory Contract — KREA V2.1
 *
 * Common contract that ALL factories must implement.
 * Defines the interface between the orchestrator and any factory,
 * including input specifications, output artifacts, QA requirements,
 * status lifecycle, and error tracking.
 *
 * CRITICAL: The factory contract is idempotent — if a contract is already
 * in a terminal state (PASSED, COMPLETED, CANCELLED), re-execution must
 * return the same result without side effects.
 */

import { randomUUID } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FactoryStatus =
  | "CREATED"
  | "QUEUED"
  | "RUNNING"
  | "QA"
  | "PASSED"
  | "FAILED"
  | "REPAIRING"
  | "COMPLETED"
  | "CANCELLED";

export type EvidenceTag =
  | "VERIFIED"
  | "INFERRED"
  | "ESTIMATED"
  | "NOT_VERIFIED"
  | "UNKNOWN";

export interface ArtifactSpec {
  type: string;
  format: string;
  required: boolean;
}

export interface QASpec {
  type: string;
  description: string;
  required: boolean;
}

export interface SuccessCriterion {
  id: string;
  description: string;
  measurable: boolean;
}

export interface FactoryError {
  step: string;
  message: string;
  recoverable: boolean;
  at: Date;
}

export interface FactoryContract {
  factoryId: string;
  productId: string;
  productVersion: string;
  inputBlueprint: string; // blueprint ID
  inputAssets: string[]; // asset IDs
  requiredTools: string[];
  requiredProviders: string[];
  outputArtifacts: ArtifactSpec[];
  qaRequirements: QASpec[];
  successCriteria: SuccessCriterion[];
  status: FactoryStatus;
  executionId: string | null;
  evidence: EvidenceTag;
  errors: FactoryError[];
  startedAt: Date | null;
  completedAt: Date | null;
}

// ─── Blueprint (input to contract creation) ───────────────────────────────────

export interface Blueprint {
  blueprintId: string;
  productId: string;
  productVersion: string;
  productType: string;
  inputAssets?: string[];
  requiredTools?: string[];
  requiredProviders?: string[];
  outputArtifacts?: ArtifactSpec[];
  qaRequirements?: QASpec[];
  successCriteria?: SuccessCriterion[];
}

// ─── Valid Status Transitions ─────────────────────────────────────────────────

/**
 * Valid transitions for the factory contract lifecycle.
 *
 * CREATED → QUEUED → RUNNING → QA → PASSED / FAILED
 * FAILED → REPAIRING → RUNNING (retry)
 * PASSED → COMPLETED
 * Any → CANCELLED
 */
const VALID_TRANSITIONS: Array<[FactoryStatus, FactoryStatus]> = [
  // Forward progression
  ["CREATED", "QUEUED"],
  ["QUEUED", "RUNNING"],
  ["RUNNING", "QA"],
  ["QA", "PASSED"],
  ["QA", "FAILED"],
  ["PASSED", "COMPLETED"],
  // Retry path
  ["FAILED", "REPAIRING"],
  ["REPAIRING", "RUNNING"],
  // Cancel from any state (except terminal states)
  ["CREATED", "CANCELLED"],
  ["QUEUED", "CANCELLED"],
  ["RUNNING", "CANCELLED"],
  ["QA", "CANCELLED"],
  ["FAILED", "CANCELLED"],
  ["REPAIRING", "CANCELLED"],
];

/** Terminal states — once reached, no further transitions are allowed */
const TERMINAL_STATES = new Set<FactoryStatus>([
  "COMPLETED",
  "CANCELLED",
]);

/**
 * Check if a transition from `from` to `to` is valid.
 */
export function isValidTransition(
  from: FactoryStatus,
  to: FactoryStatus
): boolean {
  // No transitions out of terminal states
  if (TERMINAL_STATES.has(from)) return false;
  return VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

// ─── Contract Store (In-Memory) ───────────────────────────────────────────────

const contractStore = new Map<string, FactoryContract>();

/**
 * Get a contract by factory ID.
 */
export function getContract(factoryId: string): FactoryContract | undefined {
  return contractStore.get(factoryId);
}

/**
 * List all contracts, optionally filtered by productId.
 */
export function listContracts(productId?: string): FactoryContract[] {
  let results = Array.from(contractStore.values());
  if (productId) {
    results = results.filter((c) => c.productId === productId);
  }
  return results.sort(
    (a, b) =>
      (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0)
  );
}

/**
 * Clear all contracts (for testing only).
 */
export function clearContracts(): void {
  contractStore.clear();
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Create a new factory contract from a blueprint.
 *
 * Initializes the contract in CREATED status with no execution ID,
 * no errors, and UNKNOWN evidence (nothing has been verified yet).
 */
export function createFactoryContract(
  factoryId: string,
  productId: string,
  blueprint: Blueprint
): FactoryContract {
  const now = new Date();

  const contract: FactoryContract = {
    factoryId,
    productId,
    productVersion: blueprint.productVersion,
    inputBlueprint: blueprint.blueprintId,
    inputAssets: blueprint.inputAssets || [],
    requiredTools: blueprint.requiredTools || [],
    requiredProviders: blueprint.requiredProviders || [],
    outputArtifacts: blueprint.outputArtifacts || [],
    qaRequirements: blueprint.qaRequirements || [],
    successCriteria: blueprint.successCriteria || [],
    status: "CREATED",
    executionId: null,
    evidence: "UNKNOWN",
    errors: [],
    startedAt: null,
    completedAt: null,
  };

  contractStore.set(factoryId, contract);
  return contract;
}

/**
 * Transition a factory contract to a new status.
 *
 * Validates the transition is allowed. Throws if invalid.
 * Sets startedAt when transitioning to RUNNING for the first time.
 * Sets completedAt when transitioning to a terminal state.
 */
export function transitionFactoryStatus(
  contract: FactoryContract,
  newStatus: FactoryStatus
): FactoryContract {
  if (!isValidTransition(contract.status, newStatus)) {
    throw new FactoryContractError(
      `Invalid transition: ${contract.status} → ${newStatus}`,
      "INVALID_TRANSITION",
      contract.factoryId
    );
  }

  const now = new Date();
  const updated: FactoryContract = {
    ...contract,
    status: newStatus,
    // Set startedAt when first entering RUNNING
    startedAt:
      contract.startedAt ?? (newStatus === "RUNNING" ? now : null),
    // Set completedAt when entering a terminal state
    completedAt: TERMINAL_STATES.has(newStatus) ? now : null,
    // Set executionId when entering RUNNING if not already set
    executionId:
      newStatus === "RUNNING" && !contract.executionId
        ? generateExecutionId()
        : contract.executionId,
  };

  contractStore.set(contract.factoryId, updated);
  return updated;
}

/**
 * Add an error to a factory contract.
 *
 * Errors are appended (never removed) for full audit trail.
 * Returns a new contract with the error added.
 */
export function addError(
  contract: FactoryContract,
  step: string,
  message: string,
  recoverable: boolean
): FactoryContract {
  const error: FactoryError = {
    step,
    message,
    recoverable,
    at: new Date(),
  };

  const updated: FactoryContract = {
    ...contract,
    errors: [...contract.errors, error],
  };

  contractStore.set(contract.factoryId, updated);
  return updated;
}

/**
 * Check if a factory contract is idempotent (already in a terminal state).
 *
 * Idempotent contracts should NOT be re-executed — they should return
 * the same result without side effects.
 */
export function isIdempotent(contract: FactoryContract): boolean {
  return TERMINAL_STATES.has(contract.status);
}

/**
 * Check if a contract has any unrecoverable errors.
 */
export function hasUnrecoverableErrors(contract: FactoryContract): boolean {
  return contract.errors.some((e) => !e.recoverable);
}

/**
 * Get the current phase description for a contract status.
 */
export function getStatusDescription(status: FactoryStatus): string {
  const descriptions: Record<FactoryStatus, string> = {
    CREATED: "Contract created, not yet queued",
    QUEUED: "Contract queued, waiting for execution",
    RUNNING: "Factory pipeline is executing",
    QA: "Quality assurance checks in progress",
    PASSED: "All QA checks passed",
    FAILED: "Execution failed with errors",
    REPAIRING: "Attempting to repair failures",
    COMPLETED: "Execution completed successfully",
    CANCELLED: "Execution was cancelled",
  };
  return descriptions[status];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateExecutionId(): string {
  return `exec_${randomUUID().replace(/-/g, "").substring(0, 20)}`;
}

// ─── Error Class ──────────────────────────────────────────────────────────────

export class FactoryContractError extends Error {
  readonly code: string;
  readonly factoryId: string;

  constructor(message: string, code: string, factoryId: string) {
    super(message);
    this.name = "FactoryContractError";
    this.code = code;
    this.factoryId = factoryId;
  }
}
