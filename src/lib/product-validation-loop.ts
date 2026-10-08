/**
 * Product Validation Loop — KREA V2.1
 *
 * Implements the iterative validation cycle:
 *   Product → Validation → Feedback → Analysis → Revision → Version → QA → New Product
 *
 * Each iteration:
 *   1. Receives QA report and feedback items
 *   2. Validates the product (identifies issues)
 *   3. Analyzes feedback (patterns, priorities)
 *   4. Creates a revision plan (concrete changes)
 *   5. Determines version bump (major/minor/patch)
 *   6. If no critical issues and positive feedback → loop COMPLETED
 *
 * Integrates with:
 *   - commercial-feedback: receives and classifies feedback
 *   - memory (MemoryDV): stores patterns learned
 *   - execution: traces each iteration
 *   - product-dossier: updates status through the loop
 */

import type { EvidenceTag } from "@/lib/product-fit";
import { MemoryManager } from "@/lib/memory";
import { ExecutionTracer } from "@/lib/execution";
import {
  submitFeedback as submitCommercialFeedback,
  analyzeFeedback as analyzeCommercialFeedback,
  getFeedbackSummary,
  getFeedbackByProduct,
  type CommercialFeedbackType,
  type CommercialFeedbackCategory,
} from "@/lib/commercial-feedback";

// ─── Type Definitions ────────────────────────────────────────────────

export interface ValidationLoop {
  loopId: string;
  productId: string;
  currentVersion: string;
  iterations: ValidationIteration[];
  status: "RUNNING" | "COMPLETED" | "ABORTED";
  startedAt: Date;
  completedAt: Date | null;
}

export interface ValidationIteration {
  iterationId: string;
  version: string;
  validation: ValidationResult;
  feedback: FeedbackSummary;
  analysis: AnalysisResult;
  revision: RevisionPlan | null;
  newVersion: string | null;
  qaPassed: boolean;
  completedAt: Date | null;
}

export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  score: number; // 0-1
}

export interface ValidationIssue {
  category: string;
  severity: "CRITICAL" | "MAJOR" | "MINOR";
  description: string;
  suggestedFix: string;
}

export interface FeedbackSummary {
  positive: number;
  negative: number;
  objections: string[];
  featureRequests: string[];
  contentGaps: string[];
}

export interface AnalysisResult {
  patterns: string[];
  priorities: string[];
  recommendedActions: string[];
  evidence: EvidenceTag;
}

export interface RevisionPlan {
  changes: RevisionChange[];
  newVersionType: "major" | "minor" | "patch";
  rationale: string;
}

export interface RevisionChange {
  section: string;
  type: "add" | "modify" | "remove" | "restructure";
  description: string;
  priority: "MUST" | "SHOULD" | "NICE_TO_HAVE";
}

// ─── QA Report Input ──────────────────────────────────────────────────

export interface QAReportInput {
  passed: boolean;
  issues: Array<{
    category: string;
    severity: "CRITICAL" | "MAJOR" | "MINOR";
    description: string;
    suggestedFix?: string;
  }>;
  score?: number;
}

export interface FeedbackItemInput {
  type: CommercialFeedbackType;
  category: CommercialFeedbackCategory;
  content: string;
  source: string;
}

// ─── In-Memory Store ──────────────────────────────────────────────────

const loopStore = new Map<string, ValidationLoop>();

// ─── Dependencies ─────────────────────────────────────────────────────

const memoryManager = new MemoryManager();
const executionTracer = new ExecutionTracer();

// ─── Core Functions ───────────────────────────────────────────────────

/**
 * Start a new validation loop for a product.
 * Creates the loop in RUNNING status with zero iterations.
 */
export function startValidationLoop(
  productId: string,
  version: string
): ValidationLoop {
  const loopId = crypto.randomUUID();

  const loop: ValidationLoop = {
    loopId,
    productId,
    currentVersion: version,
    iterations: [],
    status: "RUNNING",
    startedAt: new Date(),
    completedAt: null,
  };

  loopStore.set(loopId, loop);
  return loop;
}

/**
 * Run a single iteration of the validation loop.
 *
 * Steps:
 *   1. Submit and analyze commercial feedback
 *   2. Validate based on QA report
 *   3. Analyze patterns and priorities
 *   4. Create revision plan if needed
 *   5. Determine new version
 *   6. Check if loop should complete
 *
 * Also traces the iteration via execution module
 * and stores learned patterns in memory.
 */
export async function runValidationIteration(
  loopId: string,
  qaReport: QAReportInput,
  feedbackItems: FeedbackItemInput[]
): Promise<ValidationIteration> {
  const loop = loopStore.get(loopId);
  if (!loop) {
    throw new Error(`Validation loop not found: ${loopId}`);
  }
  if (loop.status !== "RUNNING") {
    throw new Error(`Validation loop is ${loop.status}, not RUNNING`);
  }

  // Start execution trace
  const executionId = await executionTracer.start(
    `Validation iteration for product ${loop.productId} v${loop.currentVersion}`,
    {
      agentId: "krea",
      inputs: { loopId, version: loop.currentVersion },
      toolsUsed: ["validation-loop", "commercial-feedback", "memory"],
    }
  );

  try {
    // Step 1: Submit and analyze commercial feedback
    const feedbackSummary = await processFeedback(
      loop.productId,
      loop.currentVersion,
      feedbackItems
    );

    // Step 2: Validate based on QA report
    const validation = validateFromQAReport(qaReport);

    // Step 3: Analyze patterns and priorities
    const analysis = analyzeResults(validation, feedbackSummary);

    // Step 4: Create revision plan if needed
    const revision = validation.passed && feedbackSummary.negative <= feedbackSummary.positive
      ? null
      : generateRevisionPlan(analysis, validation);

    // Step 5: Determine new version
    const newVersion = revision
      ? bumpVersion(loop.currentVersion, revision.newVersionType)
      : null;

    // Step 6: Check if QA passed
    const qaPassed = validation.passed && !hasCriticalIssues(validation);

    // Build the iteration
    const iteration: ValidationIteration = {
      iterationId: crypto.randomUUID(),
      version: loop.currentVersion,
      validation,
      feedback: feedbackSummary,
      analysis,
      revision,
      newVersion,
      qaPassed,
      completedAt: new Date(),
    };

    // Update the loop
    loop.iterations.push(iteration);

    // Check if loop should complete
    if (qaPassed && feedbackSummary.negative <= feedbackSummary.positive) {
      loop.status = "COMPLETED";
      loop.completedAt = new Date();
    } else if (newVersion) {
      loop.currentVersion = newVersion;
    }

    // Store learned patterns in memory
    await storeLearnedPatterns(loop.productId, analysis);

    // Complete execution trace
    await executionTracer.succeed(executionId, {
      iterationId: iteration.iterationId,
      qaPassed,
      newVersion,
      loopStatus: loop.status,
    });

    return iteration;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await executionTracer.addError(executionId, errorMsg);
    await executionTracer.fail(executionId, { message: errorMsg });
    throw error;
  }
}

/**
 * Generate a revision plan from analysis results and current validation state.
 * Maps analysis priorities to concrete changes and determines version bump type.
 */
export function generateRevisionPlan(
  analysis: AnalysisResult,
  validation: ValidationResult
): RevisionPlan {
  const changes: RevisionChange[] = [];

  // Map priorities to revision changes
  for (const priority of analysis.priorities) {
    const change = mapPriorityToChange(priority, validation);
    if (change) {
      changes.push(change);
    }
  }

  // Add changes for each critical/major issue
  for (const issue of validation.issues) {
    if (issue.severity === "CRITICAL" || issue.severity === "MAJOR") {
      changes.push({
        section: issue.category,
        type: "modify",
        description: `Fix: ${issue.description}. Suggested: ${issue.suggestedFix}`,
        priority: issue.severity === "CRITICAL" ? "MUST" : "SHOULD",
      });
    }
  }

  // Determine version bump type
  const hasCritical = validation.issues.some((i) => i.severity === "CRITICAL");
  const hasMajor = validation.issues.some((i) => i.severity === "MAJOR");
  const newVersionType: "major" | "minor" | "patch" = hasCritical
    ? "major"
    : hasMajor
      ? "minor"
      : "patch";

  // Build rationale
  const criticalCount = validation.issues.filter((i) => i.severity === "CRITICAL").length;
  const majorCount = validation.issues.filter((i) => i.severity === "MAJOR").length;
  const minorCount = validation.issues.filter((i) => i.severity === "MINOR").length;

  const rationale = [
    criticalCount > 0 ? `${criticalCount} critical issue(s)` : null,
    majorCount > 0 ? `${majorCount} major issue(s)` : null,
    minorCount > 0 ? `${minorCount} minor issue(s)` : null,
    changes.length > 0 ? `${changes.length} planned change(s)` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    changes,
    newVersionType,
    rationale: rationale || "Minor improvements based on feedback",
  };
}

/**
 * Get a validation loop by ID.
 */
export function getValidationLoop(loopId: string): ValidationLoop | null {
  return loopStore.get(loopId) || null;
}

/**
 * Get iteration history for a product across all loops.
 */
export function getIterationHistory(productId: string): ValidationIteration[] {
  const allIterations: ValidationIteration[] = [];

  for (const loop of loopStore.values()) {
    if (loop.productId === productId) {
      allIterations.push(...loop.iterations);
    }
  }

  return allIterations.sort(
    (a, b) => (a.completedAt?.getTime() || 0) - (b.completedAt?.getTime() || 0)
  );
}

/**
 * Abort a running validation loop.
 */
export function abortValidationLoop(loopId: string): ValidationLoop {
  const loop = loopStore.get(loopId);
  if (!loop) {
    throw new Error(`Validation loop not found: ${loopId}`);
  }
  if (loop.status !== "RUNNING") {
    throw new Error(`Cannot abort loop in ${loop.status} status`);
  }

  loop.status = "ABORTED";
  loop.completedAt = new Date();
  return loop;
}

/**
 * List all validation loops, optionally filtered by product.
 */
export function listValidationLoops(productId?: string): ValidationLoop[] {
  let results = Array.from(loopStore.values());
  if (productId) {
    results = results.filter((l) => l.productId === productId);
  }
  return results.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

/**
 * Clear all loops (for testing only).
 */
export function clearValidationLoops(): void {
  loopStore.clear();
}

// ─── Private Helpers ──────────────────────────────────────────────────

/**
 * Process feedback items: submit each one and analyze it,
 * then compile a summary.
 */
async function processFeedback(
  productId: string,
  version: string,
  items: FeedbackItemInput[]
): Promise<FeedbackSummary> {
  // Submit and analyze each feedback item
  for (const item of items) {
    const submitted = submitCommercialFeedback(
      productId,
      version,
      item.type,
      item.category,
      item.content,
      item.source
    );
    analyzeCommercialFeedback(submitted.feedbackId);
  }

  // Get the commercial feedback summary
  const summary = getFeedbackSummary(productId);

  // Map to our FeedbackSummary type
  return {
    positive: summary.positive,
    negative: summary.negative,
    objections: summary.topObjections,
    featureRequests: extractFeatureRequests(productId),
    contentGaps: extractContentGaps(productId),
  };
}

/**
 * Extract feature requests from feedback for a product.
 */
function extractFeatureRequests(productId: string): string[] {
  const allFeedback = getFeedbackByProduct(productId);
  return allFeedback
    .filter((f) => f.feedbackType === "FEATURE_REQUEST" && f.analyzed)
    .map((f) => f.content);
}

/**
 * Extract content gaps from feedback for a product.
 */
function extractContentGaps(productId: string): string[] {
  const allFeedback = getFeedbackByProduct(productId);
  return allFeedback
    .filter((f) => f.feedbackType === "CONTENT_GAP" && f.analyzed)
    .map((f) => f.content);
}

/**
 * Validate based on QA report input.
 * Converts the QA report to a ValidationResult.
 */
function validateFromQAReport(qaReport: QAReportInput): ValidationResult {
  const issues: ValidationIssue[] = qaReport.issues.map((issue) => ({
    category: issue.category,
    severity: issue.severity,
    description: issue.description,
    suggestedFix: issue.suggestedFix || "Review and address the issue",
  }));

  const score = qaReport.score ?? (qaReport.passed ? 0.8 : 0.4);

  return {
    passed: qaReport.passed && !issues.some((i) => i.severity === "CRITICAL"),
    issues,
    score,
  };
}

/**
 * Analyze validation results and feedback to find patterns and priorities.
 */
function analyzeResults(
  validation: ValidationResult,
  feedback: FeedbackSummary
): AnalysisResult {
  const patterns: string[] = [];
  const priorities: string[] = [];
  const recommendedActions: string[] = [];

  // Analyze validation issues
  const criticalIssues = validation.issues.filter((i) => i.severity === "CRITICAL");
  const majorIssues = validation.issues.filter((i) => i.severity === "MAJOR");

  if (criticalIssues.length > 0) {
    patterns.push(`${criticalIssues.length} critical issue(s) found`);
    priorities.push("Fix all critical issues before any other changes");
    recommendedActions.push("Address critical issues immediately");
  }

  if (majorIssues.length > 0) {
    patterns.push(`${majorIssues.length} major issue(s) found`);
    priorities.push("Resolve major issues in next revision");
  }

  // Category-based patterns
  const categories = new Map<string, number>();
  for (const issue of validation.issues) {
    categories.set(issue.category, (categories.get(issue.category) || 0) + 1);
  }
  for (const [category, count] of categories) {
    if (count >= 2) {
      patterns.push(`Recurring issues in '${category}' (${count} occurrences)`);
    }
  }

  // Analyze feedback patterns
  if (feedback.negative > feedback.positive) {
    patterns.push("Negative feedback exceeds positive");
    priorities.push("Investigate root causes of dissatisfaction");
    recommendedActions.push("Focus on fixing reported issues before adding features");
  }

  if (feedback.objections.length > 0) {
    patterns.push(`${feedback.objections.length} objection(s) raised`);
    priorities.push("Address key objections in positioning or product");
  }

  if (feedback.contentGaps.length > 0) {
    patterns.push(`${feedback.contentGaps.length} content gap(s) identified`);
    priorities.push("Fill identified content gaps");
    recommendedActions.push("Add missing content in next revision");
  }

  if (feedback.featureRequests.length > 0) {
    patterns.push(`${feedback.featureRequests.length} feature request(s) received`);
    recommendedActions.push("Evaluate feature requests for roadmap inclusion");
  }

  // If everything is good
  if (validation.passed && feedback.positive >= feedback.negative) {
    patterns.push("Product passing validation with positive feedback");
    recommendedActions.push("Consider product ready for publication");
  }

  return {
    patterns,
    priorities,
    recommendedActions,
    evidence: "INFERRED", // Analysis is based on heuristics + LLM content
  };
}

/**
 * Map a priority string to a concrete revision change.
 */
function mapPriorityToChange(
  priority: string,
  validation: ValidationResult
): RevisionChange | null {
  // Match priorities to specific changes
  if (priority.includes("critical")) {
    return {
      section: "all",
      type: "modify",
      description: priority,
      priority: "MUST",
    };
  }

  if (priority.includes("content gap")) {
    return {
      section: "content",
      type: "add",
      description: priority,
      priority: "MUST",
    };
  }

  if (priority.includes("objection")) {
    return {
      section: "positioning",
      type: "modify",
      description: priority,
      priority: "SHOULD",
    };
  }

  if (priority.includes("major")) {
    return {
      section: "quality",
      type: "modify",
      description: priority,
      priority: "SHOULD",
    };
  }

  if (priority.includes("feature")) {
    return {
      section: "features",
      type: "add",
      description: priority,
      priority: "NICE_TO_HAVE",
    };
  }

  // Default: no specific change mapped
  return null;
}

/**
 * Check if there are any critical issues.
 */
function hasCriticalIssues(validation: ValidationResult): boolean {
  return validation.issues.some((i) => i.severity === "CRITICAL");
}

/**
 * Bump a semver version string.
 */
function bumpVersion(
  current: string,
  type: "major" | "minor" | "patch"
): string {
  const parts = current.split(".").map(Number);
  const [major = 0, minor = 0, patch = 0] = parts;

  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

/**
 * Store learned patterns in memory for future reference.
 */
async function storeLearnedPatterns(
  productId: string,
  analysis: AnalysisResult
): Promise<void> {
  if (analysis.patterns.length === 0) return;

  try {
    await memoryManager.store(
      "krea",
      `validation:${productId}`,
      "EPISODIC",
      {
        patterns: analysis.patterns,
        priorities: analysis.priorities,
        recommendedActions: analysis.recommendedActions,
      },
      {
        source: "validation-loop",
        sourceType: "SYSTEM",
        truthLevel: "ESTIMATED",
        confidence: 0.6,
        relevance: 0.7,
      }
    );
  } catch {
    // Memory store failure should not break the validation loop
    // Silently continue
  }
}
