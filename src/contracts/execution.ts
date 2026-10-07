/**
 * Execution Contract — ADN GENERAL DEL AGENTE V1.0
 *
 * Defines the execution tracking system for every operation the agent performs.
 * Every execution is traceable from start to finish, with full evidence,
 * cost tracking, and approval records.
 *
 * States: PENDING → RUNNING → SUCCEEDED | FAILED | CANCELLED
 */

import { randomUUID } from "crypto";

// ─── Execution States ────────────────────────────────────────────────────────

/** State of an execution */
export type ExecutionState = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

/** Whether an execution can transition to a new state */
const VALID_TRANSITIONS: Record<ExecutionState, ExecutionState[]> = {
  PENDING: ["RUNNING", "CANCELLED"],
  RUNNING: ["SUCCEEDED", "FAILED", "CANCELLED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
};

/**
 * Check if a state transition is valid.
 */
export function isValidTransition(from: ExecutionState, to: ExecutionState): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

// ─── Execution Priority ──────────────────────────────────────────────────────

/** Priority of an execution */
export type ExecutionPriority = "critical" | "high" | "medium" | "low";

// ─── Approval Record ─────────────────────────────────────────────────────────

/** Record of an approval for an execution */
export interface ApprovalRecord {
  /** Approval ID */
  approvalId: string;
  /** Who approved (user ID or agent ID) */
  approvedBy: string;
  /** When approval was granted */
  approvedAt: string;
  /** What was approved (capability, tool, operation) */
  approvedAction: string;
  /** Approval level required */
  level: "auto" | "user" | "admin" | "system";
  /** Reason for approval requirement */
  reason: string;
  /** Expiry time for this approval */
  expiresAt?: string;
}

// ─── Execution Cost ──────────────────────────────────────────────────────────

/** Cost tracking for an execution */
export interface ExecutionCost {
  /** Credits consumed */
  credits: number;
  /** Estimated monetary cost */
  monetaryCost: number;
  /** Currency for monetary cost */
  currency: string;
  /** Token usage if applicable */
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  /** Time cost in ms */
  timeMs: number;
}

// ─── Execution Error ─────────────────────────────────────────────────────────

/** Error record for a failed execution */
export interface ExecutionError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error category */
  category: "validation" | "permission" | "provider" | "timeout" | "internal" | "external" | "unknown";
  /** Whether this error is retryable */
  retryable: boolean;
  /** Stack trace (sanitized) */
  stack?: string;
  /** Timestamp */
  timestamp: string;
}

// ─── Execution Contract ──────────────────────────────────────────────────────

/**
 * Full execution contract — the traceable record of every operation.
 */
export interface ExecutionContract {
  /** Unique execution identifier */
  executionId: string;

  /** Agent performing the execution */
  agentId: string;

  /** Task/capability being executed */
  task: string;

  /** Current state */
  state: ExecutionState;

  /** Priority */
  priority: ExecutionPriority;

  // ── Timing ────────────────────────────────────────────────────────────
  /** When execution was created */
  createdAt: string;
  /** When execution started running */
  startedAt?: string;
  /** When execution ended (succeeded, failed, or cancelled) */
  endedAt?: string;
  /** Total duration in ms */
  durationMs?: number;

  // ── Resources Used ────────────────────────────────────────────────────
  /** Tools used in this execution */
  toolsUsed: string[];
  /** Capabilities/skills used */
  skillsUsed: string[];

  // ── Data ──────────────────────────────────────────────────────────────
  /** Input data (may be redacted for sensitive operations) */
  inputs: Record<string, unknown>;
  /** Output data (may be redacted for large outputs) */
  outputs: Record<string, unknown>;
  /** Whether inputs were redacted */
  inputsRedacted: boolean;
  /** Whether outputs were redacted */
  outputsRedacted: boolean;

  // ── Errors ────────────────────────────────────────────────────────────
  /** Errors that occurred during execution */
  errors: ExecutionError[];

  // ── Evidence ──────────────────────────────────────────────────────────
  /** Evidence IDs produced during execution */
  evidenceIds: string[];

  // ── Approvals ─────────────────────────────────────────────────────────
  /** Approvals obtained for this execution */
  approvals: ApprovalRecord[];

  // ── Cost ──────────────────────────────────────────────────────────────
  /** Cost tracking */
  cost: ExecutionCost;

  // ── Context ───────────────────────────────────────────────────────────
  /** User who initiated the execution */
  initiatedBy: string;
  /** Parent execution ID if this is a sub-execution */
  parentExecutionId?: string;
  /** Correlation ID for linking related executions */
  correlationId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ─── Execution Tracer ────────────────────────────────────────────────────────

/**
 * ExecutionTracer — Creates and tracks executions through their lifecycle.
 * Provides a fluent API for building execution contracts step by step.
 */
export class ExecutionTracer {
  private executions: Map<string, ExecutionContract> = new Map();

  /**
   * Start a new execution.
   * Creates a PENDING execution contract.
   */
  start(params: {
    agentId: string;
    task: string;
    priority?: ExecutionPriority;
    initiatedBy: string;
    inputs?: Record<string, unknown>;
    parentExecutionId?: string;
    correlationId?: string;
  }): ExecutionContract {
    const execution: ExecutionContract = {
      executionId: randomUUID(),
      agentId: params.agentId,
      task: params.task,
      state: "PENDING",
      priority: params.priority || "medium",
      createdAt: new Date().toISOString(),
      toolsUsed: [],
      skillsUsed: [],
      inputs: params.inputs || {},
      outputs: {},
      inputsRedacted: false,
      outputsRedacted: false,
      errors: [],
      evidenceIds: [],
      approvals: [],
      cost: {
        credits: 0,
        monetaryCost: 0,
        currency: "USD",
        timeMs: 0,
      },
      initiatedBy: params.initiatedBy,
      parentExecutionId: params.parentExecutionId,
      correlationId: params.correlationId,
    };

    this.executions.set(execution.executionId, execution);
    return execution;
  }

  /**
   * Transition an execution to RUNNING.
   */
  run(executionId: string): ExecutionContract | null {
    const execution = this.executions.get(executionId);
    if (!execution || !isValidTransition(execution.state, "RUNNING")) return null;

    execution.state = "RUNNING";
    execution.startedAt = new Date().toISOString();
    return execution;
  }

  /**
   * Mark an execution as SUCCEEDED with outputs.
   */
  succeed(
    executionId: string,
    outputs: Record<string, unknown>,
    options?: {
      evidenceIds?: string[];
      creditsConsumed?: number;
      outputsRedacted?: boolean;
    },
  ): ExecutionContract | null {
    const execution = this.executions.get(executionId);
    if (!execution || !isValidTransition(execution.state, "SUCCEEDED")) return null;

    execution.state = "SUCCEEDED";
    execution.endedAt = new Date().toISOString();
    execution.outputs = outputs;
    execution.outputsRedacted = options?.outputsRedacted || false;
    execution.durationMs = execution.startedAt
      ? Date.now() - new Date(execution.startedAt).getTime()
      : 0;
    execution.cost.timeMs = execution.durationMs;

    if (options?.evidenceIds) {
      execution.evidenceIds.push(...options.evidenceIds);
    }
    if (options?.creditsConsumed) {
      execution.cost.credits = options.creditsConsumed;
    }

    return execution;
  }

  /**
   * Mark an execution as FAILED with error details.
   */
  fail(
    executionId: string,
    error: {
      code: string;
      message: string;
      category?: ExecutionError["category"];
      retryable?: boolean;
      stack?: string;
    },
  ): ExecutionContract | null {
    const execution = this.executions.get(executionId);
    if (!execution || !isValidTransition(execution.state, "FAILED")) return null;

    execution.state = "FAILED";
    execution.endedAt = new Date().toISOString();
    execution.durationMs = execution.startedAt
      ? Date.now() - new Date(execution.startedAt).getTime()
      : 0;
    execution.cost.timeMs = execution.durationMs;

    execution.errors.push({
      code: error.code,
      message: error.message,
      category: error.category || "unknown",
      retryable: error.retryable || false,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    return execution;
  }

  /**
   * Cancel an execution.
   */
  cancel(executionId: string, reason: string): ExecutionContract | null {
    const execution = this.executions.get(executionId);
    if (!execution || !isValidTransition(execution.state, "CANCELLED")) return null;

    execution.state = "CANCELLED";
    execution.endedAt = new Date().toISOString();
    execution.durationMs = execution.startedAt
      ? Date.now() - new Date(execution.startedAt).getTime()
      : 0;
    execution.cost.timeMs = execution.durationMs;
    execution.metadata = { ...execution.metadata, cancelReason: reason };

    return execution;
  }

  /**
   * Add a tool usage record to an execution.
   */
  addToolUsed(executionId: string, toolId: string): void {
    const execution = this.executions.get(executionId);
    if (execution && !execution.toolsUsed.includes(toolId)) {
      execution.toolsUsed.push(toolId);
    }
  }

  /**
   * Add a skill usage record to an execution.
   */
  addSkillUsed(executionId: string, skillId: string): void {
    const execution = this.executions.get(executionId);
    if (execution && !execution.skillsUsed.includes(skillId)) {
      execution.skillsUsed.push(skillId);
    }
  }

  /**
   * Add an approval to an execution.
   */
  addApproval(
    executionId: string,
    approval: Omit<ApprovalRecord, "approvalId" | "approvedAt">,
  ): void {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.approvals.push({
        ...approval,
        approvalId: randomUUID(),
        approvedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Add evidence to an execution.
   */
  addEvidence(executionId: string, evidenceId: string): void {
    const execution = this.executions.get(executionId);
    if (execution && !execution.evidenceIds.includes(evidenceId)) {
      execution.evidenceIds.push(evidenceId);
    }
  }

  /**
   * Update cost tracking for an execution.
   */
  updateCost(executionId: string, cost: Partial<ExecutionCost>): void {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.cost = { ...execution.cost, ...cost };
    }
  }

  // ── Query Methods ─────────────────────────────────────────────────────

  /** Get an execution by ID */
  get(executionId: string): ExecutionContract | undefined {
    return this.executions.get(executionId);
  }

  /** Get all executions */
  getAll(): ExecutionContract[] {
    return Array.from(this.executions.values());
  }

  /** Get executions by state */
  getByState(state: ExecutionState): ExecutionContract[] {
    return this.getAll().filter((e) => e.state === state);
  }

  /** Get executions by agent */
  getByAgent(agentId: string): ExecutionContract[] {
    return this.getAll().filter((e) => e.agentId === agentId);
  }

  /** Get executions by correlation ID */
  getByCorrelation(correlationId: string): ExecutionContract[] {
    return this.getAll().filter((e) => e.correlationId === correlationId);
  }

  /** Get child executions (sub-executions) */
  getChildren(parentExecutionId: string): ExecutionContract[] {
    return this.getAll().filter((e) => e.parentExecutionId === parentExecutionId);
  }

  /** Get currently running executions */
  getRunning(): ExecutionContract[] {
    return this.getByState("RUNNING");
  }

  /** Get failed executions */
  getFailed(): ExecutionContract[] {
    return this.getByState("FAILED");
  }

  /** Get execution statistics */
  getStats(): {
    total: number;
    byState: Record<ExecutionState, number>;
    byPriority: Record<ExecutionPriority, number>;
    totalCredits: number;
    totalDurationMs: number;
    errorRate: number;
  } {
    const all = this.getAll();
    const byState: Record<ExecutionState, number> = {
      PENDING: 0, RUNNING: 0, SUCCEEDED: 0, FAILED: 0, CANCELLED: 0,
    };
    const byPriority: Record<ExecutionPriority, number> = {
      critical: 0, high: 0, medium: 0, low: 0,
    };

    let totalCredits = 0;
    let totalDurationMs = 0;
    let failed = 0;

    for (const exec of all) {
      byState[exec.state]++;
      byPriority[exec.priority]++;
      totalCredits += exec.cost.credits;
      totalDurationMs += exec.cost.timeMs;
      if (exec.state === "FAILED") failed++;
    }

    return {
      total: all.length,
      byState,
      byPriority,
      totalCredits,
      totalDurationMs,
      errorRate: all.length > 0 ? failed / all.length : 0,
    };
  }

  /** Total execution count */
  size(): number {
    return this.executions.size;
  }
}

// ─── Scoped Execution ────────────────────────────────────────────────────────

/**
 * Utility for creating a scoped execution that automatically
 * tracks timing and transitions states.
 *
 * Usage:
 * ```
 * const result = await scopedExecution(tracer, { agentId: "krea", task: "image_gen", initiatedBy: userId }, async () => {
 *   // Do work here
 *   return { imageUrl: "..." };
 * });
 * ```
 */
export async function scopedExecution<T>(
  tracer: ExecutionTracer,
  params: {
    agentId: string;
    task: string;
    priority?: ExecutionPriority;
    initiatedBy: string;
    inputs?: Record<string, unknown>;
    correlationId?: string;
  },
  fn: (execution: ExecutionContract) => Promise<T>,
): Promise<{ result: T | null; execution: ExecutionContract }> {
  const execution = tracer.start(params);
  tracer.run(execution.executionId);

  try {
    const result = await fn(execution);
    tracer.succeed(execution.executionId, { result });
    return { result, execution: tracer.get(execution.executionId)! };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    tracer.fail(execution.executionId, {
      code: "EXECUTION_ERROR",
      message: err.message,
      category: "internal",
      retryable: false,
      stack: err.stack,
    });
    return { result: null, execution: tracer.get(execution.executionId)! };
  }
}
