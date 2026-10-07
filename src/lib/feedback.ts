/**
 * Feedback & Learning System for AGENTE-KREA
 *
 * Records feedback on agent executions and extracts learning.
 * Distinguishes real success from partial success from failure.
 * Never automatically converts any result into truth — all learning must be validated.
 *
 * Feedback types: SUCCESS, PARTIAL_SUCCESS, FAILURE, TECHNICAL_ERROR,
 *   BAD_DECISION, BAD_HYPOTHESIS, BAD_TOOL, BAD_EXECUTION, UNKNOWN
 */

import { db } from "@/lib/db";
import { MemoryManager, type MemoryType, type SourceType, type TruthLevel } from "@/lib/memory";
import { SkillManager } from "@/lib/skills";

// ─── Type Definitions ────────────────────────────────────────────────

export type FeedbackType =
  | "SUCCESS"
  | "PARTIAL_SUCCESS"
  | "FAILURE"
  | "TECHNICAL_ERROR"
  | "BAD_DECISION"
  | "BAD_HYPOTHESIS"
  | "BAD_TOOL"
  | "BAD_EXECUTION"
  | "UNKNOWN";

export type ValidationStatus = "PENDING" | "VALIDATED" | "INVALIDATED";

export interface RecordFeedbackOptions {
  agentId?: string;
  userId?: string;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  feedbackText?: string;
  confidence?: number;
  evidence?: Record<string, unknown>;
}

export interface FeedbackAnalysis {
  category: FeedbackType;
  severity: "low" | "medium" | "high" | "critical";
  rootCause?: string;
  contributingFactors?: string[];
  isRecoverable: boolean;
  patterns?: string[];
  recommendations?: string[];
  estimatedConfidence: number;
}

export interface ExtractedLearning {
  domain: string;
  type: MemoryType;
  content: Record<string, unknown>;
  source: string;
  sourceType: SourceType;
  truthLevel: TruthLevel;
  confidence: number;
  needsValidation: boolean;
  affectedSkills?: string[];
  affectedMemories?: string[];
}

// ─── Feedback Category Severity ──────────────────────────────────────

const FEEDBACK_SEVERITY: Record<FeedbackType, "low" | "medium" | "high" | "critical"> = {
  SUCCESS: "low",
  PARTIAL_SUCCESS: "medium",
  FAILURE: "high",
  TECHNICAL_ERROR: "high",
  BAD_DECISION: "high",
  BAD_HYPOTHESIS: "critical",
  BAD_TOOL: "high",
  BAD_EXECUTION: "critical",
  UNKNOWN: "medium",
};

// ─── FeedbackManager ─────────────────────────────────────────────────

export class FeedbackManager {
  private defaultAgentId = "krea";
  private memoryManager = new MemoryManager();
  private skillManager = new SkillManager();

  /**
   * Record feedback on an execution.
   * Creates a Feedback entry linked to the execution (if provided).
   */
  async record(
    executionId: string | null,
    feedbackType: FeedbackType,
    feedbackText: string,
    options: RecordFeedbackOptions = {}
  ): Promise<{ id: string }> {
    const agentId = options.agentId || this.defaultAgentId;

    // Validate execution exists if provided
    if (executionId) {
      const execution = await db.execution.findUnique({ where: { id: executionId } });
      if (!execution) throw new Error(`Execution ${executionId} not found`);
    }

    const feedback = await db.feedback.create({
      data: {
        agentId,
        userId: options.userId || null,
        executionId,
        input: options.input ? JSON.stringify(options.input) : null,
        result: options.result ? JSON.stringify(options.result) : null,
        feedbackType,
        feedbackText,
        confidence: options.confidence ?? this.inferConfidence(feedbackType),
        evidence: options.evidence ? JSON.stringify(options.evidence) : null,
        validationStatus: "PENDING",
      },
    });

    // Auto-analyze for non-success feedback
    if (feedbackType !== "SUCCESS") {
      await this.analyze(feedback.id);
    }

    return { id: feedback.id };
  }

  /**
   * Automatically analyze feedback to determine root cause, severity, and patterns.
   */
  async analyze(feedbackId: string): Promise<FeedbackAnalysis> {
    const feedback = await db.feedback.findUnique({ where: { id: feedbackId } });
    if (!feedback) throw new Error(`Feedback ${feedbackId} not found`);

    const analysis: FeedbackAnalysis = {
      category: feedback.feedbackType as FeedbackType,
      severity: FEEDBACK_SEVERITY[feedback.feedbackType as FeedbackType],
      isRecoverable: true,
      estimatedConfidence: feedback.confidence,
    };

    // Analyze based on feedback type
    switch (feedback.feedbackType as FeedbackType) {
      case "SUCCESS":
        analysis.isRecoverable = true;
        analysis.recommendations = ["Record successful pattern for reuse"];
        break;

      case "PARTIAL_SUCCESS":
        analysis.isRecoverable = true;
        analysis.rootCause = this.identifyPartialSuccessCause(feedback);
        analysis.recommendations = [
          "Review which steps succeeded and which failed",
          "Consider adjusting parameters for the failing steps",
        ];
        break;

      case "FAILURE":
        analysis.isRecoverable = false;
        analysis.rootCause = this.identifyFailureRootCause(feedback);
        analysis.contributingFactors = this.identifyContributingFactors(feedback);
        analysis.recommendations = [
          "Review execution trace for error details",
          "Consider alternative approaches",
          "Check if prerequisites were met",
        ];
        break;

      case "TECHNICAL_ERROR":
        analysis.isRecoverable = true;
        analysis.rootCause = "Technical/system error";
        analysis.recommendations = [
          "Retry with backoff",
          "Check system health",
          "Verify external service availability",
        ];
        break;

      case "BAD_DECISION":
        analysis.isRecoverable = false;
        analysis.severity = "high";
        analysis.rootCause = "Agent made an incorrect decision";
        analysis.patterns = this.identifyDecisionPatterns(feedback);
        analysis.recommendations = [
          "Review decision criteria and thresholds",
          "Update decision logic based on evidence",
          "Add constraints to prevent similar decisions",
        ];
        break;

      case "BAD_HYPOTHESIS":
        analysis.isRecoverable = false;
        analysis.severity = "critical";
        analysis.rootCause = "Agent operated on an incorrect hypothesis";
        analysis.recommendations = [
          "Invalidate the hypothesis in memory",
          "Record contradictory evidence",
          "Adjust confidence for related hypotheses",
        ];
        break;

      case "BAD_TOOL":
        analysis.isRecoverable = true;
        analysis.rootCause = "Wrong tool was selected or tool malfunctioned";
        analysis.recommendations = [
          "Review tool selection criteria",
          "Consider alternative tools",
          "Report tool issue",
        ];
        break;

      case "BAD_EXECUTION":
        analysis.isRecoverable = false;
        analysis.severity = "critical";
        analysis.rootCause = "Execution was flawed in structure or sequence";
        analysis.recommendations = [
          "Review execution procedure",
          "Check step ordering and dependencies",
          "Validate execution plan before running",
        ];
        break;

      default:
        analysis.recommendations = ["Investigate further", "Gather more evidence"];
    }

    // Store analysis in the feedback record
    await db.feedback.update({
      where: { id: feedbackId },
      data: {
        analysis: JSON.stringify(analysis),
      },
    });

    return analysis;
  }

  /**
   * Extract learning from feedback.
   * CRITICAL: Never automatically convert any result into truth.
   * All learning starts with PENDING validation and ESTIMATED/INFERRED truth level.
   */
  async learn(feedbackId: string): Promise<ExtractedLearning[]> {
    const feedback = await db.feedback.findUnique({ where: { id: feedbackId } });
    if (!feedback) throw new Error(`Feedback ${feedbackId} not found`);

    // Ensure analysis exists
    if (!feedback.analysis) {
      await this.analyze(feedbackId);
    }

    const refreshedFeedback = await db.feedback.findUnique({ where: { id: feedbackId } });
    if (!refreshedFeedback) throw new Error(`Feedback ${feedbackId} not found after analysis`);

    const analysis: FeedbackAnalysis = refreshedFeedback.analysis
      ? JSON.parse(refreshedFeedback.analysis)
      : { category: refreshedFeedback.feedbackType as FeedbackType, severity: "medium", isRecoverable: true, estimatedConfidence: 0.5 };

    const learnings: ExtractedLearning[] = [];

    switch (refreshedFeedback.feedbackType as FeedbackType) {
      case "SUCCESS": {
        // Record successful pattern — but as ESTIMATED, not VERIFIED
        learnings.push({
          domain: this.inferDomain(refreshedFeedback),
          type: "PROCEDURAL",
          content: {
            pattern: "successful_execution",
            input: refreshedFeedback.input ? JSON.parse(refreshedFeedback.input) : null,
            result: refreshedFeedback.result ? JSON.parse(refreshedFeedback.result) : null,
            feedbackText: refreshedFeedback.feedbackText,
          },
          source: `feedback:${feedbackId}`,
          sourceType: "FEEDBACK",
          truthLevel: "ESTIMATED", // NOT verified — must be validated
          confidence: 0.6, // Moderate confidence from single success
          needsValidation: true,
        });
        break;
      }

      case "PARTIAL_SUCCESS": {
        // Record what worked and what didn't
        learnings.push({
          domain: this.inferDomain(refreshedFeedback),
          type: "EPISODIC",
          content: {
            pattern: "partial_success",
            whatWorked: this.extractWhatWorked(refreshedFeedback),
            whatFailed: this.extractWhatFailed(refreshedFeedback),
            feedbackText: refreshedFeedback.feedbackText,
          },
          source: `feedback:${feedbackId}`,
          sourceType: "FEEDBACK",
          truthLevel: "ESTIMATED",
          confidence: 0.4,
          needsValidation: true,
        });
        break;
      }

      case "FAILURE":
      case "BAD_EXECUTION": {
        // Record failure as a negative pattern
        learnings.push({
          domain: this.inferDomain(refreshedFeedback),
          type: "EPISODIC",
          content: {
            pattern: "failure",
            rootCause: analysis.rootCause,
            contributingFactors: analysis.contributingFactors,
            feedbackText: refreshedFeedback.feedbackText,
          },
          source: `feedback:${feedbackId}`,
          sourceType: "FEEDBACK",
          truthLevel: "OBSERVED", // Failures are observable facts
          confidence: 0.8, // High confidence in what DIDN'T work
          needsValidation: false, // Failures don't need validation — they happened
        });

        // Also record a procedural learning about what to avoid
        learnings.push({
          domain: this.inferDomain(refreshedFeedback),
          type: "PROCEDURAL",
          content: {
            pattern: "avoid",
            whatToAvoid: refreshedFeedback.input ? JSON.parse(refreshedFeedback.input) : null,
            reason: analysis.rootCause || refreshedFeedback.feedbackText,
          },
          source: `feedback:${feedbackId}`,
          sourceType: "FEEDBACK",
          truthLevel: "ESTIMATED",
          confidence: 0.5,
          needsValidation: true,
        });
        break;
      }

      case "BAD_DECISION": {
        // Record the bad decision as a factual memory
        learnings.push({
          domain: "decision",
          type: "FACTUAL",
          content: {
            pattern: "bad_decision",
            decision: refreshedFeedback.input ? JSON.parse(refreshedFeedback.input) : null,
            outcome: refreshedFeedback.result ? JSON.parse(refreshedFeedback.result) : null,
            reason: refreshedFeedback.feedbackText,
          },
          source: `feedback:${feedbackId}`,
          sourceType: "FEEDBACK",
          truthLevel: "OBSERVED",
          confidence: 0.7,
          needsValidation: true, // Decision quality needs validation
          affectedSkills: this.identifyAffectedSkills(refreshedFeedback),
        });
        break;
      }

      case "BAD_HYPOTHESIS": {
        // CRITICAL: Invalidate the hypothesis in memory
        learnings.push({
          domain: this.inferDomain(refreshedFeedback),
          type: "FACTUAL",
          content: {
            pattern: "invalidated_hypothesis",
            hypothesis: refreshedFeedback.input ? JSON.parse(refreshedFeedback.input) : null,
            contradictingEvidence: refreshedFeedback.result ? JSON.parse(refreshedFeedback.result) : null,
            reason: refreshedFeedback.feedbackText,
          },
          source: `feedback:${feedbackId}`,
          sourceType: "FEEDBACK",
          truthLevel: "OBSERVED",
          confidence: 0.9, // Very high confidence in contradiction
          needsValidation: false, // Contradictory evidence is a fact
        });
        break;
      }

      case "BAD_TOOL": {
        // Record tool failure
        learnings.push({
          domain: "tool",
          type: "FACTUAL",
          content: {
            pattern: "bad_tool",
            tool: refreshedFeedback.input ? JSON.parse(refreshedFeedback.input) : null,
            issue: refreshedFeedback.feedbackText,
            alternative: analysis.recommendations?.[0],
          },
          source: `feedback:${feedbackId}`,
          sourceType: "FEEDBACK",
          truthLevel: "ESTIMATED",
          confidence: 0.5,
          needsValidation: true,
        });
        break;
      }

      case "TECHNICAL_ERROR": {
        // Record as episodic — technical errors are transient
        learnings.push({
          domain: "system",
          type: "EPISODIC",
          content: {
            pattern: "technical_error",
            error: refreshedFeedback.feedbackText,
            recoverable: analysis.isRecoverable,
          },
          source: `feedback:${feedbackId}`,
          sourceType: "FEEDBACK",
          truthLevel: "OBSERVED",
          confidence: 0.7,
          needsValidation: false,
        });
        break;
      }

      default: {
        learnings.push({
          domain: this.inferDomain(refreshedFeedback),
          type: "EPISODIC",
          content: {
            pattern: "unknown_feedback",
            feedbackType: refreshedFeedback.feedbackType,
            feedbackText: refreshedFeedback.feedbackText,
          },
          source: `feedback:${feedbackId}`,
          sourceType: "FEEDBACK",
          truthLevel: "UNKNOWN",
          confidence: 0.3,
          needsValidation: true,
        });
      }
    }

    // Store learning in the feedback record
    await db.feedback.update({
      where: { id: feedbackId },
      data: {
        learning: JSON.stringify(learnings),
      },
    });

    return learnings;
  }

  /**
   * Apply extracted learning to the system.
   * Updates memory and/or skills based on the learning.
   * CRITICAL: Only applies VALIDATED learning, or marks them as needing validation.
   */
  async applyLearning(learning: ExtractedLearning, agentId?: string): Promise<{
    memoryId?: string;
    skillsUpdated?: string[];
    status: "applied" | "pending_validation";
  }> {
    const effectiveAgentId = agentId || this.defaultAgentId;
    const skillsUpdated: string[] = [];

    // Store in memory
    const { id: memoryId } = await this.memoryManager.store(
      effectiveAgentId,
      learning.domain,
      learning.type,
      learning.content,
      {
        source: learning.source,
        sourceType: learning.sourceType,
        truthLevel: learning.truthLevel,
        confidence: learning.confidence,
      }
    );

    // If learning is about a bad hypothesis, invalidate related memories
    if (learning.content.pattern === "invalidated_hypothesis" && learning.content.hypothesis) {
      const relatedMemories = await this.memoryManager.recall({
        domain: learning.domain,
        searchText: JSON.stringify(learning.content.hypothesis).substring(0, 50),
      });

      for (const mem of relatedMemories) {
        const m = mem as { id: string };
        try {
          await this.memoryManager.invalidate(m.id, "Invalidated by feedback: bad hypothesis");
        } catch {
          // Memory might already be invalidated
        }
      }
    }

    // If learning affects skills, update them
    if (learning.affectedSkills && learning.affectedSkills.length > 0) {
      for (const skillId of learning.affectedSkills) {
        try {
          await this.skillManager.improve(skillId, {
            success: learning.content.pattern === "successful_execution",
            partialSuccess: learning.content.pattern === "partial_success",
            actualResult: learning.feedbackText,
          });
          skillsUpdated.push(skillId);
        } catch {
          // Skill might not exist or not be improvable
        }
      }
    }

    // Determine status
    const status = learning.needsValidation ? "pending_validation" : "applied";

    return { memoryId, skillsUpdated: skillsUpdated.length > 0 ? skillsUpdated : undefined, status };
  }

  /**
   * Validate a feedback entry and its associated learning.
   * Moves validation status from PENDING to VALIDATED or INVALIDATED.
   */
  async validate(feedbackId: string, isValid: boolean, reason?: string): Promise<void> {
    const feedback = await db.feedback.findUnique({ where: { id: feedbackId } });
    if (!feedback) throw new Error(`Feedback ${feedbackId} not found`);

    const evidence = feedback.evidence ? JSON.parse(feedback.evidence) : {};
    evidence.validationReason = reason;
    evidence.validatedAt = new Date().toISOString();

    await db.feedback.update({
      where: { id: feedbackId },
      data: {
        validationStatus: isValid ? "VALIDATED" : "INVALIDATED",
        evidence: JSON.stringify(evidence),
      },
    });

    // If validated and has learning, apply it
    if (isValid && feedback.learning) {
      const learnings: ExtractedLearning[] = JSON.parse(feedback.learning);
      for (const learning of learnings) {
        await this.applyLearning(learning, feedback.agentId);
      }
    }
  }

  /**
   * Get a feedback entry by ID with parsed fields.
   */
  async get(feedbackId: string): Promise<unknown | null> {
    const feedback = await db.feedback.findUnique({ where: { id: feedbackId } });
    if (!feedback) return null;

    return {
      ...feedback,
      input: feedback.input ? JSON.parse(feedback.input) : null,
      result: feedback.result ? JSON.parse(feedback.result) : null,
      analysis: feedback.analysis ? JSON.parse(feedback.analysis) : null,
      learning: feedback.learning ? JSON.parse(feedback.learning) : null,
      evidence: feedback.evidence ? JSON.parse(feedback.evidence) : null,
    };
  }

  /**
   * List feedback entries with optional filters.
   */
  async list(filters: {
    agentId?: string;
    userId?: string;
    executionId?: string;
    feedbackType?: FeedbackType;
    validationStatus?: ValidationStatus;
    limit?: number;
  } = {}): Promise<unknown[]> {
    const where: Record<string, unknown> = {};
    if (filters.agentId) where.agentId = filters.agentId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.executionId) where.executionId = filters.executionId;
    if (filters.feedbackType) where.feedbackType = filters.feedbackType;
    if (filters.validationStatus) where.validationStatus = filters.validationStatus;

    const feedbacks = await db.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50,
    });

    return feedbacks.map((f) => ({
      ...f,
      input: f.input ? JSON.parse(f.input) : null,
      result: f.result ? JSON.parse(f.result) : null,
      analysis: f.analysis ? JSON.parse(f.analysis) : null,
      learning: f.learning ? JSON.parse(f.learning) : null,
      evidence: f.evidence ? JSON.parse(f.evidence) : null,
    }));
  }

  /**
   * Get feedback statistics.
   */
  async getStats(agentId?: string): Promise<{
    total: number;
    byType: Record<string, number>;
    byValidationStatus: Record<string, number>;
    avgConfidence: number;
    learningPending: number;
    learningApplied: number;
  }> {
    const effectiveAgentId = agentId || this.defaultAgentId;

    const feedbacks = await db.feedback.findMany({
      where: { agentId: effectiveAgentId },
    });

    const byType: Record<string, number> = {};
    const byValidationStatus: Record<string, number> = {};
    let totalConfidence = 0;
    let learningPending = 0;
    let learningApplied = 0;

    for (const f of feedbacks) {
      byType[f.feedbackType] = (byType[f.feedbackType] || 0) + 1;
      byValidationStatus[f.validationStatus] = (byValidationStatus[f.validationStatus] || 0) + 1;
      totalConfidence += f.confidence;

      if (f.validationStatus === "PENDING") learningPending++;
      if (f.validationStatus === "VALIDATED") learningApplied++;
    }

    return {
      total: feedbacks.length,
      byType,
      byValidationStatus,
      avgConfidence: feedbacks.length > 0 ? totalConfidence / feedbacks.length : 0,
      learningPending,
      learningApplied,
    };
  }

  // ─── Private Helpers ───────────────────────────────────────────────

  /**
   * Infer confidence from feedback type.
   */
  private inferConfidence(feedbackType: FeedbackType): number {
    switch (feedbackType) {
      case "SUCCESS": return 0.8;
      case "PARTIAL_SUCCESS": return 0.5;
      case "FAILURE": return 0.8; // We're confident it failed
      case "TECHNICAL_ERROR": return 0.7;
      case "BAD_DECISION": return 0.7;
      case "BAD_HYPOTHESIS": return 0.9;
      case "BAD_TOOL": return 0.6;
      case "BAD_EXECUTION": return 0.8;
      default: return 0.5;
    }
  }

  /**
   * Infer domain from feedback context.
   */
  private inferDomain(feedback: { executionId: string | null; feedbackType: string }): string {
    if (feedback.executionId) return "execution";
    switch (feedback.feedbackType) {
      case "BAD_TOOL": return "tool";
      case "BAD_DECISION": return "decision";
      case "BAD_HYPOTHESIS": return "hypothesis";
      case "TECHNICAL_ERROR": return "system";
      default: return "general";
    }
  }

  /**
   * Identify the cause of a partial success.
   */
  private identifyPartialSuccessCause(feedback: { feedbackText: string; result: string | null }): string {
    if (feedback.feedbackText) return feedback.feedbackText;
    if (feedback.result) {
      try {
        const result = JSON.parse(feedback.result);
        if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
          return `Partial success with errors: ${result.errors[0]}`;
        }
        if (result.stepsCompleted && result.stepsTotal && result.stepsCompleted < result.stepsTotal) {
          return `Only ${result.stepsCompleted}/${result.stepsTotal} steps completed`;
        }
      } catch { /* ignore */ }
    }
    return "Unknown cause of partial success";
  }

  /**
   * Identify root cause of a failure.
   */
  private identifyFailureRootCause(feedback: { feedbackText: string; result: string | null }): string {
    if (feedback.feedbackText) return feedback.feedbackText;
    if (feedback.result) {
      try {
        const result = JSON.parse(feedback.result);
        if (result.error) return String(result.error);
        if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
          return result.errors[0];
        }
      } catch { /* ignore */ }
    }
    return "Unknown root cause";
  }

  /**
   * Identify contributing factors from feedback.
   */
  private identifyContributingFactors(feedback: { result: string | null; input: string | null }): string[] {
    const factors: string[] = [];

    if (feedback.input) {
      try {
        const input = JSON.parse(feedback.input);
        if (input.tool) factors.push(`Tool: ${input.tool}`);
        if (input.skill) factors.push(`Skill: ${input.skill}`);
        if (input.params) factors.push("Custom parameters used");
      } catch { /* ignore */ }
    }

    return factors;
  }

  /**
   * Identify decision patterns from feedback.
   */
  private identifyDecisionPatterns(feedback: { feedbackText: string }): string[] {
    const patterns: string[] = [];
    const text = feedback.feedbackText.toLowerCase();

    if (text.includes("timeout") || text.includes("too slow")) patterns.push("timeout_prone");
    if (text.includes("wrong tool") || text.includes("incorrect tool")) patterns.push("tool_selection_error");
    if (text.includes("insufficient") || text.includes("not enough")) patterns.push("resource_underestimation");
    if (text.includes("oversized") || text.includes("too much")) patterns.push("resource_overestimation");
    if (text.includes("wrong order") || text.includes("sequence")) patterns.push("ordering_error");

    return patterns;
  }

  /**
   * Extract what worked from partial success feedback.
   */
  private extractWhatWorked(feedback: { result: string | null }): string | null {
    if (!feedback.result) return null;
    try {
      const result = JSON.parse(feedback.result);
      if (result.stepsCompleted) return `${result.stepsCompleted} steps completed successfully`;
      if (result.partialResult) return JSON.stringify(result.partialResult);
    } catch { /* ignore */ }
    return null;
  }

  /**
   * Extract what failed from partial success feedback.
   */
  private extractWhatFailed(feedback: { result: string | null; feedbackText: string }): string | null {
    if (feedback.feedbackText) return feedback.feedbackText;
    if (!feedback.result) return null;
    try {
      const result = JSON.parse(feedback.result);
      if (result.errors) return JSON.stringify(result.errors);
      if (result.failedSteps) return `Failed at steps: ${result.failedSteps}`;
    } catch { /* ignore */ }
    return null;
  }

  /**
   * Identify skills affected by this feedback.
   */
  private identifyAffectedSkills(feedback: { input: string | null; result: string | null }): string[] {
    const skills: string[] = [];

    if (feedback.input) {
      try {
        const input = JSON.parse(feedback.input);
        if (input.skillId) skills.push(input.skillId);
        if (input.skillName) skills.push(input.skillName);
      } catch { /* ignore */ }
    }

    if (feedback.result) {
      try {
        const result = JSON.parse(feedback.result);
        if (result.skillsUsed && Array.isArray(result.skillsUsed)) {
          skills.push(...result.skillsUsed);
        }
      } catch { /* ignore */ }
    }

    return [...new Set(skills)];
  }
}

// Singleton instance
export const feedbackManager = new FeedbackManager();
