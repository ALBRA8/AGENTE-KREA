/**
 * Product Dossier — Product Brain Module
 *
 * Master product dossier that tracks the complete product lifecycle.
 * This is the single source of truth for a product's journey through
 * the KREA pipeline: IDEA → RESEARCH → EVALUATE → DECIDE → ARCHITECT
 * → SPECIFY → PRODUCE → QA → PUBLISH (or FAIL/ARCHIVE).
 *
 * The dossier aggregates all Product Brain module outputs:
 * - FitScore (product-fit)
 * - ProductDecision (product-decision)
 * - ProductArchitecture (product-architecture)
 * - ProductSpecification (product-specification)
 * - ProductEconomics (product-economics)
 * - HandoffContract (product-handoff)
 */

import { randomUUID } from "crypto";
import type { EvidenceTag } from "@/lib/product-fit";
import type { ProductOpportunityInput, FitScore } from "@/lib/product-fit";
import type { ProductDecision } from "@/lib/product-decision";
import type { ProductArchitecture } from "@/lib/product-architecture";
import type { ProductSpecification } from "@/lib/product-specification";
import type { ProductEconomics } from "@/lib/product-economics";
import type { HandoffContract } from "@/lib/product-handoff";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DossierStatus =
  | "IDEA"
  | "RESEARCHING"
  | "EVALUATING"
  | "DECIDING"
  | "ARCHITECTING"
  | "SPECIFYING"
  | "PRODUCING"
  | "QA"
  | "REVISION"
  | "PUBLISHED"
  | "ARCHIVED"
  | "FAILED";

export interface ArtifactRef {
  id: string;
  type: string; // "fit_score" | "decision" | "architecture" | "specification" | "economics" | "handoff"
  name: string;
  createdAt: Date;
}

export interface TimelineEntry {
  timestamp: Date;
  fromStatus: DossierStatus | null;
  toStatus: DossierStatus;
  action: string;
  details?: string;
}

export interface ProductDossierData {
  dossierId: string;
  userId: string;
  title: string;
  description: string;
  domain: string;
  status: DossierStatus;
  version: number;
  opportunity: ProductOpportunityInput | null;
  fitScore: FitScore | null;
  decision: ProductDecision | null;
  architecture: ProductArchitecture | null;
  specification: ProductSpecification | null;
  economics: ProductEconomics | null;
  handoff: HandoffContract | null;
  artifacts: ArtifactRef[];
  timeline: TimelineEntry[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Valid Status Transitions ─────────────────────────────────────────────────

/**
 * Valid transitions for the dossier lifecycle.
 * Each entry is [fromStatus, toStatus].
 */
const VALID_TRANSITIONS: Array<[DossierStatus, DossierStatus]> = [
  // Forward progression
  ["IDEA", "RESEARCHING"],
  ["IDEA", "EVALUATING"],
  ["RESEARCHING", "EVALUATING"],
  ["RESEARCHING", "IDEA"], // Back to idea if research reveals issues
  ["EVALUATING", "DECIDING"],
  ["EVALUATING", "RESEARCHING"], // Need more research
  ["DECIDING", "ARCHITECTING"],
  ["DECIDING", "ARCHIVED"], // Decision was NO_GO
  ["DECIDING", "FAILED"], // Decision process failed
  ["ARCHITECTING", "SPECIFYING"],
  ["ARCHITECTING", "DECIDING"], // Back to deciding
  ["SPECIFYING", "PRODUCING"],
  ["SPECIFYING", "ARCHITECTING"], // Need architecture changes
  ["PRODUCING", "QA"],
  ["PRODUCING", "SPECIFYING"], // Need spec changes
  ["QA", "PUBLISHED"],
  ["QA", "REVISION"], // Needs revision
  ["QA", "FAILED"], // QA failed critically
  ["REVISION", "PRODUCING"], // Re-produce after revision
  ["REVISION", "QA"], // Re-QA after revision
  ["PUBLISHED", "ARCHIVED"], // Archive after publishing
  // Any status can transition to FAILED
  ["IDEA", "FAILED"],
  ["RESEARCHING", "FAILED"],
  ["EVALUATING", "FAILED"],
  ["ARCHITECTING", "FAILED"],
  ["SPECIFYING", "FAILED"],
  ["PRODUCING", "FAILED"],
  // Any status can transition to ARCHIVED (except already terminal)
  ["IDEA", "ARCHIVED"],
  ["RESEARCHING", "ARCHIVED"],
  ["EVALUATING", "ARCHIVED"],
  ["ARCHITECTING", "ARCHIVED"],
  ["SPECIFYING", "ARCHIVED"],
  ["PRODUCING", "ARCHIVED"],
  ["REVISION", "ARCHIVED"],
];

function isValidTransition(from: DossierStatus, to: DossierStatus): boolean {
  return VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

// ─── Dossier Store (In-Memory) ────────────────────────────────────────────────

const dossierStore = new Map<string, ProductDossierData>();

/**
 * Get a dossier by ID.
 */
export function getDossier(dossierId: string): ProductDossierData | undefined {
  return dossierStore.get(dossierId);
}

/**
 * List dossiers, optionally filtered by userId and/or status.
 */
export function listDossiers(filters?: {
  userId?: string;
  status?: DossierStatus;
}): ProductDossierData[] {
  let results = Array.from(dossierStore.values());

  if (filters?.userId) {
    results = results.filter((d) => d.userId === filters.userId);
  }
  if (filters?.status) {
    results = results.filter((d) => d.status === filters.status);
  }

  return results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/**
 * Clear all dossiers (for testing only).
 */
export function clearDossiers(): void {
  dossierStore.clear();
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Create a new product dossier from an idea.
 * Starts at IDEA status.
 */
export function createDossier(params: {
  userId: string;
  title: string;
  description: string;
  domain: string;
  opportunity?: ProductOpportunityInput;
}): ProductDossierData {
  const dossierId = generateDossierId();
  const now = new Date();

  const dossier: ProductDossierData = {
    dossierId,
    userId: params.userId,
    title: params.title,
    description: params.description,
    domain: params.domain,
    status: "IDEA",
    version: 1,
    opportunity: params.opportunity || null,
    fitScore: null,
    decision: null,
    architecture: null,
    specification: null,
    economics: null,
    handoff: null,
    artifacts: [],
    timeline: [
      {
        timestamp: now,
        fromStatus: null,
        toStatus: "IDEA",
        action: "Dossier created",
        details: `Product idea: ${params.title}`,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  dossierStore.set(dossierId, dossier);
  return dossier;
}

/**
 * Transition dossier to a new status.
 * Validates the transition is allowed.
 */
export function transitionDossier(
  dossierId: string,
  toStatus: DossierStatus,
  action: string,
  details?: string
): ProductDossierData {
  const dossier = getDossierOrThrow(dossierId);

  if (!isValidTransition(dossier.status, toStatus)) {
    throw new DossierError(
      `Cannot transition from ${dossier.status} to ${toStatus}`,
      "INVALID_TRANSITION",
      dossierId
    );
  }

  const now = new Date();
  const updated: ProductDossierData = {
    ...dossier,
    status: toStatus,
    timeline: [
      ...dossier.timeline,
      {
        timestamp: now,
        fromStatus: dossier.status,
        toStatus,
        action,
        details,
      },
    ],
    updatedAt: now,
  };

  dossierStore.set(dossierId, updated);
  return updated;
}

// ─── Data Attachment Functions ────────────────────────────────────────────────

/**
 * Attach an opportunity to the dossier.
 * Typically done during RESEARCHING phase.
 */
export function attachOpportunity(
  dossierId: string,
  opportunity: ProductOpportunityInput
): ProductDossierData {
  const dossier = getDossierOrThrow(dossierId);
  const artifactId = generateArtifactId();

  const updated: ProductDossierData = {
    ...dossier,
    opportunity,
    artifacts: [
      ...dossier.artifacts,
      { id: artifactId, type: "opportunity", name: `Opportunity: ${opportunity.title}`, createdAt: new Date() },
    ],
    updatedAt: new Date(),
  };

  dossierStore.set(dossierId, updated);
  return updated;
}

/**
 * Attach a fit score to the dossier.
 * Typically done during EVALUATING phase.
 */
export function attachFitScore(
  dossierId: string,
  fitScore: FitScore
): ProductDossierData {
  const dossier = getDossierOrThrow(dossierId);
  const artifactId = generateArtifactId();

  const updated: ProductDossierData = {
    ...dossier,
    fitScore,
    artifacts: [
      ...dossier.artifacts,
      {
        id: artifactId,
        type: "fit_score",
        name: `Fit Score: ${fitScore.overall} (${fitScore.recommendation})`,
        createdAt: new Date(),
      },
    ],
    updatedAt: new Date(),
  };

  dossierStore.set(dossierId, updated);
  return updated;
}

/**
 * Attach a decision to the dossier.
 * Typically done during DECIDING phase.
 */
export function attachDecision(
  dossierId: string,
  decision: ProductDecision
): ProductDossierData {
  const dossier = getDossierOrThrow(dossierId);
  const artifactId = generateArtifactId();

  const updated: ProductDossierData = {
    ...dossier,
    decision,
    artifacts: [
      ...dossier.artifacts,
      {
        id: artifactId,
        type: "decision",
        name: `Decision: ${decision.decision}`,
        createdAt: new Date(),
      },
    ],
    updatedAt: new Date(),
  };

  dossierStore.set(dossierId, updated);
  return updated;
}

/**
 * Attach an architecture to the dossier.
 * Typically done during ARCHITECTING phase.
 */
export function attachArchitecture(
  dossierId: string,
  architecture: ProductArchitecture
): ProductDossierData {
  const dossier = getDossierOrThrow(dossierId);
  const artifactId = generateArtifactId();

  const updated: ProductDossierData = {
    ...dossier,
    architecture,
    artifacts: [
      ...dossier.artifacts,
      {
        id: artifactId,
        type: "architecture",
        name: `Architecture: ${architecture.productType}`,
        createdAt: new Date(),
      },
    ],
    updatedAt: new Date(),
  };

  dossierStore.set(dossierId, updated);
  return updated;
}

/**
 * Attach a specification to the dossier.
 * Typically done during SPECIFYING phase.
 */
export function attachSpecification(
  dossierId: string,
  specification: ProductSpecification
): ProductDossierData {
  const dossier = getDossierOrThrow(dossierId);
  const artifactId = generateArtifactId();

  const updated: ProductDossierData = {
    ...dossier,
    specification,
    artifacts: [
      ...dossier.artifacts,
      {
        id: artifactId,
        type: "specification",
        name: `Specification v${specification.version}`,
        createdAt: new Date(),
      },
    ],
    updatedAt: new Date(),
  };

  dossierStore.set(dossierId, updated);
  return updated;
}

/**
 * Attach economics to the dossier.
 * Can be done during SPECIFYING or PRODUCING phase.
 */
export function attachEconomics(
  dossierId: string,
  economics: ProductEconomics
): ProductDossierData {
  const dossier = getDossierOrThrow(dossierId);
  const artifactId = generateArtifactId();

  const updated: ProductDossierData = {
    ...dossier,
    economics,
    artifacts: [
      ...dossier.artifacts,
      {
        id: artifactId,
        type: "economics",
        name: `Economics: ${economics.estimatedCost.currency} ${economics.estimatedCost.total}`,
        createdAt: new Date(),
      },
    ],
    updatedAt: new Date(),
  };

  dossierStore.set(dossierId, updated);
  return updated;
}

/**
 * Attach a handoff contract to the dossier.
 * Typically done during PRODUCING phase for software products.
 */
export function attachHandoff(
  dossierId: string,
  handoff: HandoffContract
): ProductDossierData {
  const dossier = getDossierOrThrow(dossierId);
  const artifactId = generateArtifactId();

  const updated: ProductDossierData = {
    ...dossier,
    handoff,
    artifacts: [
      ...dossier.artifacts,
      {
        id: artifactId,
        type: "handoff",
        name: `Handoff: ${handoff.targetProvider} (${handoff.status})`,
        createdAt: new Date(),
      },
    ],
    updatedAt: new Date(),
  };

  dossierStore.set(dossierId, updated);
  return updated;
}

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Get the current lifecycle phase description.
 */
export function getLifecyclePhase(status: DossierStatus): string {
  const phases: Record<DossierStatus, string> = {
    IDEA: "Product idea identified, not yet researched",
    RESEARCHING: "Researching market, audience, and alternatives",
    EVALUATING: "Evaluating product-market fit",
    DECIDING: "Making GO/NO-GO decision",
    ARCHITECTING: "Designing product architecture",
    SPECIFYING: "Creating detailed specifications",
    PRODUCING: "Building/producing the product",
    QA: "Quality assurance and review",
    REVISION: "Revising based on QA feedback",
    PUBLISHED: "Product published and available",
    ARCHIVED: "Product archived (not active)",
    FAILED: "Product failed at some stage",
  };
  return phases[status];
}

/**
 * Get the completeness percentage of the dossier.
 * Based on how many stages have data attached.
 */
export function getDossierCompleteness(dossier: ProductDossierData): number {
  const checks = [
    dossier.opportunity !== null,
    dossier.fitScore !== null,
    dossier.decision !== null,
    dossier.architecture !== null,
    dossier.specification !== null,
    dossier.economics !== null,
  ];

  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

/**
 * Get a summary of the dossier for display.
 */
export function getDossierSummary(dossier: ProductDossierData): {
  id: string;
  title: string;
  status: DossierStatus;
  phase: string;
  completeness: number;
  decision: string | null;
  fitScore: number | null;
  artifactCount: number;
  lastUpdated: Date;
} {
  return {
    id: dossier.dossierId,
    title: dossier.title,
    status: dossier.status,
    phase: getLifecyclePhase(dossier.status),
    completeness: getDossierCompleteness(dossier),
    decision: dossier.decision?.decision || null,
    fitScore: dossier.fitScore?.overall || null,
    artifactCount: dossier.artifacts.length,
    lastUpdated: dossier.updatedAt,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDossierOrThrow(dossierId: string): ProductDossierData {
  const dossier = dossierStore.get(dossierId);
  if (!dossier) {
    throw new DossierError(
      `Dossier not found: ${dossierId}`,
      "NOT_FOUND",
      dossierId
    );
  }
  return dossier;
}

function generateDossierId(): string {
  return `doss_${randomUUID().replace(/-/g, "").substring(0, 20)}`;
}

function generateArtifactId(): string {
  return `art_${randomUUID().replace(/-/g, "").substring(0, 12)}`;
}

// ─── Error Class ──────────────────────────────────────────────────────────────

export class DossierError extends Error {
  readonly code: string;
  readonly dossierId: string;

  constructor(message: string, code: string, dossierId: string) {
    super(message);
    this.name = "DossierError";
    this.code = code;
    this.dossierId = dossierId;
  }
}
