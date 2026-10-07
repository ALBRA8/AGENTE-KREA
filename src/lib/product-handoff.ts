/**
 * Product Handoff — Product Brain Module
 *
 * Provider-neutral handoff contract for software products.
 * Defines the contract between KREA (source agent) and external
 * implementation providers (Codex, Antigravity, generic, manual).
 *
 * CRITICAL RULES:
 * - Never fake a SENT status — if external provider is not available,
 *   set status READY and mark externalSend as NOT_VERIFIED
 * - Handoff must be idempotent (no duplicate sends)
 * - Handoff must be recoverable (can query by handoffId)
 * - All state transitions must be valid
 * - Evidence must be honest about what was verified
 */

import { randomUUID } from "crypto";
import type { EvidenceTag } from "@/lib/product-fit";
import type { ProductSpecification, AcceptanceCriterion } from "@/lib/product-specification";
import type { RiskFactor } from "@/lib/product-economics";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HandoffStatus =
  | "CREATED"
  | "READY"
  | "SENT"
  | "ACKNOWLEDGED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type AutonomyLevel = "SUPERVISED" | "SEMI_AUTONOMOUS" | "AUTONOMOUS";

export interface Approval {
  approver: string;
  approvedAt: Date;
  decision: "APPROVED" | "REJECTED" | "CONDITIONAL";
  conditions?: string[];
}

export interface HandoffEvidence {
  externalSend: EvidenceTag; // Was the external send verified?
  specificationQuality: EvidenceTag; // Is the spec verified?
  providerAvailability: EvidenceTag; // Is the provider available?
}

export interface HandoffContract {
  handoffId: string;
  sourceAgent: "KREA";
  targetProvider: string; // "codex" | "antigravity" | "generic" | "manual"
  objective: string;
  productId: string;
  productVersion: string;
  specification: ProductSpecification;
  constraints: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  dependencies: string[];
  evidence: HandoffEvidence;
  risk: RiskFactor[];
  autonomy: AutonomyLevel;
  approvals: Approval[];
  status: HandoffStatus;
  deliveryAttempts: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Valid State Transitions ──────────────────────────────────────────────────

/**
 * Valid state transitions for the handoff lifecycle.
 * Each entry is [fromStatus, toStatus].
 */
const VALID_TRANSITIONS: Array<[HandoffStatus, HandoffStatus]> = [
  ["CREATED", "READY"],
  ["CREATED", "CANCELLED"],
  ["READY", "SENT"],
  ["READY", "CANCELLED"],
  ["SENT", "ACKNOWLEDGED"],
  ["SENT", "FAILED"],
  ["SENT", "CANCELLED"],
  ["ACKNOWLEDGED", "COMPLETED"],
  ["ACKNOWLEDGED", "FAILED"],
  ["ACKNOWLEDGED", "CANCELLED"],
  ["FAILED", "READY"], // Retry from failure
];

function isValidTransition(from: HandoffStatus, to: HandoffStatus): boolean {
  return VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

// ─── Handoff Store (In-Memory) ────────────────────────────────────────────────

/**
 * In-memory store for handoff contracts.
 * In production, this would persist to database.
 * Supports recovery by handoffId (idempotent queries).
 */
const handoffStore = new Map<string, HandoffContract>();

/**
 * Get a handoff contract by ID.
 * Used for recovery and idempotency checks.
 */
export function getHandoff(handoffId: string): HandoffContract | undefined {
  return handoffStore.get(handoffId);
}

/**
 * List all handoff contracts, optionally filtered by status.
 */
export function listHandoffs(status?: HandoffStatus): HandoffContract[] {
  const all = Array.from(handoffStore.values());
  if (status) return all.filter((h) => h.status === status);
  return all;
}

/**
 * Clear all handoffs (for testing only).
 */
export function clearHandoffs(): void {
  handoffStore.clear();
}

// ─── External Provider Interface ──────────────────────────────────────────────

/**
 * Interface for external handoff providers.
 * Implement this to connect to real providers (Codex, Antigravity, etc.)
 */
export interface IHandoffProvider {
  readonly providerId: string;
  isAvailable(): Promise<boolean>;
  send(contract: HandoffContract): Promise<{ success: boolean; error?: string; providerRef?: string }>;
  checkStatus(providerRef: string): Promise<HandoffStatus>;
}

// Registry of available providers
const providerRegistry = new Map<string, IHandoffProvider>();

/**
 * Register an external handoff provider.
 */
export function registerHandoffProvider(provider: IHandoffProvider): void {
  providerRegistry.set(provider.providerId, provider);
}

/**
 * Check if a provider is available.
 */
export async function isProviderAvailable(providerId: string): Promise<boolean> {
  const provider = providerRegistry.get(providerId);
  if (!provider) return false;
  try {
    return await provider.isAvailable();
  } catch {
    return false;
  }
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Create a new handoff contract with status CREATED.
 *
 * @param specification - The product specification to hand off
 * @param targetProvider - Target provider ID
 * @param options - Additional options
 */
export function createHandoff(
  specification: ProductSpecification,
  targetProvider: string,
  options?: {
    objective?: string;
    constraints?: string[];
    dependencies?: string[];
    risk?: RiskFactor[];
    autonomy?: AutonomyLevel;
  }
): HandoffContract {
  const handoffId = generateHandoffId();
  const now = new Date();

  const contract: HandoffContract = {
    handoffId,
    sourceAgent: "KREA",
    targetProvider,
    objective: options?.objective || `Implement ${specification.architecture.productType} product: ${specification.productId}`,
    productId: specification.productId,
    productVersion: specification.version,
    specification,
    constraints: options?.constraints || [],
    acceptanceCriteria: [...specification.acceptanceCriteria],
    dependencies: options?.dependencies || specification.architecture.dependencies,
    evidence: {
      externalSend: "NOT_VERIFIED",
      specificationQuality: specification.evidence,
      providerAvailability: "NOT_VERIFIED",
    },
    risk: options?.risk || [],
    autonomy: options?.autonomy || "SUPERVISED",
    approvals: [],
    status: "CREATED",
    deliveryAttempts: 0,
    error: null,
    createdAt: now,
    updatedAt: now,
  };

  handoffStore.set(handoffId, contract);
  return contract;
}

/**
 * Mark a handoff as READY.
 * Validates that the contract is in CREATED status.
 * Checks provider availability and updates evidence.
 */
export async function markReady(handoffId: string): Promise<HandoffContract> {
  const contract = getHandoffOrThrow(handoffId);

  if (!isValidTransition(contract.status, "READY")) {
    throw new HandoffError(
      `Cannot transition from ${contract.status} to READY`,
      "INVALID_TRANSITION",
      handoffId
    );
  }

  // Check provider availability
  const providerAvailable = await isProviderAvailable(contract.targetProvider);

  const updated: HandoffContract = {
    ...contract,
    status: "READY",
    evidence: {
      ...contract.evidence,
      providerAvailability: providerAvailable ? "VERIFIED" : "NOT_VERIFIED",
    },
    updatedAt: new Date(),
  };

  handoffStore.set(handoffId, updated);
  return updated;
}

/**
 * Send a handoff to the external provider.
 *
 * CRITICAL: If external provider is NOT available, sets status READY
 * (not SENT) and marks externalSend as NOT_VERIFIED.
 * NEVER fakes a SENT status.
 *
 * Idempotent: If already SENT or beyond, returns existing contract.
 */
export async function sendHandoff(handoffId: string): Promise<HandoffContract> {
  const contract = getHandoffOrThrow(handoffId);

  // Idempotency: already sent or further
  if (contract.status === "SENT" || contract.status === "ACKNOWLEDGED" || contract.status === "COMPLETED") {
    return contract;
  }

  // Must be READY to send
  if (contract.status === "CREATED") {
    // Auto-transition to READY first
    await markReady(handoffId);
  }

  const currentContract = getHandoffOrThrow(handoffId);
  if (currentContract.status !== "READY") {
    throw new HandoffError(
      `Cannot send from status ${currentContract.status}`,
      "INVALID_TRANSITION",
      handoffId
    );
  }

  // Check if approval is required and not obtained
  if (currentContract.autonomy === "SUPERVISED" && !hasApproval(currentContract)) {
    throw new HandoffError(
      "Supervised handoff requires approval before sending",
      "APPROVAL_REQUIRED",
      handoffId
    );
  }

  // Attempt external send
  const provider = providerRegistry.get(currentContract.targetProvider);

  if (!provider) {
    // No provider registered — stay at READY, do NOT fake SENT
    const noProviderContract: HandoffContract = {
      ...currentContract,
      status: "READY", // Stay at READY, not SENT
      evidence: {
        ...currentContract.evidence,
        externalSend: "NOT_VERIFIED",
        providerAvailability: "NOT_VERIFIED",
      },
      error: `Provider '${currentContract.targetProvider}' is not registered. Handoff stays at READY.`,
      updatedAt: new Date(),
    };
    handoffStore.set(handoffId, noProviderContract);
    return noProviderContract;
  }

  const isAvail = await provider.isAvailable();
  if (!isAvail) {
    // Provider not available — stay at READY, do NOT fake SENT
    const unavailableContract: HandoffContract = {
      ...currentContract,
      status: "READY", // Stay at READY, not SENT
      evidence: {
        ...currentContract.evidence,
        externalSend: "NOT_VERIFIED",
        providerAvailability: "NOT_VERIFIED",
      },
      error: `Provider '${currentContract.targetProvider}' is not available. Handoff stays at READY.`,
      updatedAt: new Date(),
    };
    handoffStore.set(handoffId, unavailableContract);
    return unavailableContract;
  }

  // Provider is available — attempt real send
  try {
    const result = await provider.send(currentContract);

    if (result.success) {
      const sentContract: HandoffContract = {
        ...currentContract,
        status: "SENT",
        deliveryAttempts: currentContract.deliveryAttempts + 1,
        evidence: {
          ...currentContract.evidence,
          externalSend: "VERIFIED",
          providerAvailability: "VERIFIED",
        },
        error: null,
        updatedAt: new Date(),
      };
      handoffStore.set(handoffId, sentContract);
      return sentContract;
    } else {
      // Send failed
      return failHandoff(handoffId, result.error || "Provider send failed");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failHandoff(handoffId, message);
  }
}

/**
 * Acknowledge a handoff (provider confirms receipt).
 * Only valid from SENT status.
 */
export function acknowledgeHandoff(handoffId: string, acknowledger?: string): HandoffContract {
  const contract = getHandoffOrThrow(handoffId);

  if (!isValidTransition(contract.status, "ACKNOWLEDGED")) {
    throw new HandoffError(
      `Cannot transition from ${contract.status} to ACKNOWLEDGED`,
      "INVALID_TRANSITION",
      handoffId
    );
  }

  const updated: HandoffContract = {
    ...contract,
    status: "ACKNOWLEDGED",
    updatedAt: new Date(),
  };

  handoffStore.set(handoffId, updated);
  return updated;
}

/**
 * Complete a handoff successfully.
 * Only valid from ACKNOWLEDGED status.
 */
export function completeHandoff(handoffId: string): HandoffContract {
  const contract = getHandoffOrThrow(handoffId);

  if (!isValidTransition(contract.status, "COMPLETED")) {
    throw new HandoffError(
      `Cannot transition from ${contract.status} to COMPLETED`,
      "INVALID_TRANSITION",
      handoffId
    );
  }

  const updated: HandoffContract = {
    ...contract,
    status: "COMPLETED",
    updatedAt: new Date(),
  };

  handoffStore.set(handoffId, updated);
  return updated;
}

/**
 * Mark a handoff as FAILED.
 * Valid from SENT or ACKNOWLEDGED status.
 * Can retry by calling markReady after failure.
 */
export function failHandoff(handoffId: string, error: string): HandoffContract {
  const contract = getHandoffOrThrow(handoffId);

  if (!isValidTransition(contract.status, "FAILED")) {
    throw new HandoffError(
      `Cannot transition from ${contract.status} to FAILED`,
      "INVALID_TRANSITION",
      handoffId
    );
  }

  const updated: HandoffContract = {
    ...contract,
    status: "FAILED",
    deliveryAttempts: contract.deliveryAttempts + 1,
    error,
    updatedAt: new Date(),
  };

  handoffStore.set(handoffId, updated);
  return updated;
}

/**
 * Cancel a handoff.
 * Valid from CREATED, READY, SENT, or ACKNOWLEDGED status.
 */
export function cancelHandoff(handoffId: string, reason?: string): HandoffContract {
  const contract = getHandoffOrThrow(handoffId);

  if (!isValidTransition(contract.status, "CANCELLED")) {
    throw new HandoffError(
      `Cannot transition from ${contract.status} to CANCELLED`,
      "INVALID_TRANSITION",
      handoffId
    );
  }

  const updated: HandoffContract = {
    ...contract,
    status: "CANCELLED",
    error: reason || "Cancelled by user",
    updatedAt: new Date(),
  };

  handoffStore.set(handoffId, updated);
  return updated;
}

/**
 * Add an approval to a handoff contract.
 */
export function addApproval(
  handoffId: string,
  approver: string,
  decision: Approval["decision"],
  conditions?: string[]
): HandoffContract {
  const contract = getHandoffOrThrow(handoffId);

  const approval: Approval = {
    approver,
    approvedAt: new Date(),
    decision,
    conditions,
  };

  const updated: HandoffContract = {
    ...contract,
    approvals: [...contract.approvals, approval],
    updatedAt: new Date(),
  };

  handoffStore.set(handoffId, updated);
  return updated;
}

/**
 * Retry a failed handoff by transitioning back to READY.
 */
export async function retryHandoff(handoffId: string): Promise<HandoffContract> {
  const contract = getHandoffOrThrow(handoffId);

  if (contract.status !== "FAILED") {
    throw new HandoffError(
      `Can only retry from FAILED status, current: ${contract.status}`,
      "INVALID_TRANSITION",
      handoffId
    );
  }

  const ready: HandoffContract = {
    ...contract,
    status: "READY",
    error: null,
    updatedAt: new Date(),
  };

  handoffStore.set(handoffId, ready);
  return ready;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHandoffOrThrow(handoffId: string): HandoffContract {
  const contract = handoffStore.get(handoffId);
  if (!contract) {
    throw new HandoffError(
      `Handoff contract not found: ${handoffId}`,
      "NOT_FOUND",
      handoffId
    );
  }
  return contract;
}

function hasApproval(contract: HandoffContract): boolean {
  return contract.approvals.some((a) => a.decision === "APPROVED");
}

function generateHandoffId(): string {
  return `hoff_${randomUUID().replace(/-/g, "").substring(0, 20)}`;
}

// ─── Error Class ──────────────────────────────────────────────────────────────

export class HandoffError extends Error {
  readonly code: string;
  readonly handoffId: string;

  constructor(message: string, code: string, handoffId: string) {
    super(message);
    this.name = "HandoffError";
    this.code = code;
    this.handoffId = handoffId;
  }
}
