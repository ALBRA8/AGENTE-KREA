/**
 * Execution Tracer for AGENTE-KREA
 *
 * Every execution is fully reconstructable after the fact.
 * Tracks: tools used, skills used, inputs, outputs, errors, evidence, approvals, cost.
 * Status flow: PENDING → RUNNING → SUCCEEDED | FAILED | CANCELLED
 */

import { db } from "@/lib/db";

// ─── Type Definitions ────────────────────────────────────────────────

export type ExecutionStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export interface StartExecutionOptions {
  agentId?: string;
  userId?: string;
  inputs?: Record<string, unknown>;
  toolsUsed?: string[];
  skillsUsed?: string[];
  correlationId?: string;
}

export interface ExecutionFilters {
  agentId?: string;
  userId?: string;
  status?: ExecutionStatus;
  task?: string;
  correlationId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ExecutionTrace {
  id: string;
  agentId: string;
  userId: string | null;
  task: string;
  toolsUsed: string[] | null;
  skillsUsed: string[] | null;
  inputs: Record<string, unknown> | null;
  outputs: Record<string, unknown> | null;
  errors: string[] | null;
  evidence: Record<string, unknown> | null;
  approvals: string[] | null;
  cost: number;
  status: ExecutionStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  correlationId: string | null;
  createdAt: Date;
}

// ─── ExecutionTracer ─────────────────────────────────────────────────

export class ExecutionTracer {
  private defaultAgentId = "krea";

  /**
   * Start a new execution trace.
   * Creates a PENDING execution, then immediately transitions to RUNNING.
   */
  async start(task: string, options: StartExecutionOptions = {}): Promise<string> {
    const agentId = options.agentId || this.defaultAgentId;

    const execution = await db.execution.create({
      data: {
        agentId,
        userId: options.userId || null,
        task,
        inputs: options.inputs ? JSON.stringify(options.inputs) : null,
        toolsUsed: options.toolsUsed ? JSON.stringify(options.toolsUsed) : null,
        skillsUsed: options.skillsUsed ? JSON.stringify(options.skillsUsed) : null,
        correlationId: options.correlationId || null,
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    return execution.id;
  }

  /**
   * Add a tool that was used during the execution.
   */
  async addTool(executionId: string, toolName: string): Promise<void> {
    const execution = await db.execution.findUnique({ where: { id: executionId } });
    if (!execution) throw new Error(`Execution ${executionId} not found`);
    if (execution.status !== "RUNNING") {
      throw new Error(`Cannot modify execution in ${execution.status} status`);
    }

    const tools: string[] = execution.toolsUsed ? JSON.parse(execution.toolsUsed) : [];
    if (!tools.includes(toolName)) {
      tools.push(toolName);
    }

    await db.execution.update({
      where: { id: executionId },
      data: { toolsUsed: JSON.stringify(tools) },
    });
  }

  /**
   * Add a skill that was used during the execution.
   */
  async addSkill(executionId: string, skillName: string): Promise<void> {
    const execution = await db.execution.findUnique({ where: { id: executionId } });
    if (!execution) throw new Error(`Execution ${executionId} not found`);
    if (execution.status !== "RUNNING") {
      throw new Error(`Cannot modify execution in ${execution.status} status`);
    }

    const skills: string[] = execution.skillsUsed ? JSON.parse(execution.skillsUsed) : [];
    if (!skills.includes(skillName)) {
      skills.push(skillName);
    }

    await db.execution.update({
      where: { id: executionId },
      data: { skillsUsed: JSON.stringify(skills) },
    });
  }

  /**
   * Add an error to the execution.
   */
  async addError(executionId: string, error: string): Promise<void> {
    const execution = await db.execution.findUnique({ where: { id: executionId } });
    if (!execution) throw new Error(`Execution ${executionId} not found`);
    if (execution.status !== "RUNNING") {
      throw new Error(`Cannot modify execution in ${execution.status} status`);
    }

    const errors: string[] = execution.errors ? JSON.parse(execution.errors) : [];
    errors.push(error);

    await db.execution.update({
      where: { id: executionId },
      data: { errors: JSON.stringify(errors) },
    });
  }

  /**
   * Add approval to the execution.
   */
  async addApproval(executionId: string, approval: string): Promise<void> {
    const execution = await db.execution.findUnique({ where: { id: executionId } });
    if (!execution) throw new Error(`Execution ${executionId} not found`);
    if (execution.status !== "RUNNING") {
      throw new Error(`Cannot modify execution in ${execution.status} status`);
    }

    const approvals: string[] = execution.approvals ? JSON.parse(execution.approvals) : [];
    approvals.push(approval);

    await db.execution.update({
      where: { id: executionId },
      data: { approvals: JSON.stringify(approvals) },
    });
  }

  /**
   * Update execution cost.
   */
  async addCost(executionId: string, cost: number): Promise<void> {
    const execution = await db.execution.findUnique({ where: { id: executionId } });
    if (!execution) throw new Error(`Execution ${executionId} not found`);
    if (execution.status !== "RUNNING") {
      throw new Error(`Cannot modify execution in ${execution.status} status`);
    }

    await db.execution.update({
      where: { id: executionId },
      data: { cost: execution.cost + cost },
    });
  }

  /**
   * Add evidence to the execution.
   */
  async addEvidence(executionId: string, evidence: Record<string, unknown>): Promise<void> {
    const execution = await db.execution.findUnique({ where: { id: executionId } });
    if (!execution) throw new Error(`Execution ${executionId} not found`);
    if (execution.status !== "RUNNING") {
      throw new Error(`Cannot modify execution in ${execution.status} status`);
    }

    const current = execution.evidence ? JSON.parse(execution.evidence) : {};
    const merged = { ...current, ...evidence };

    await db.execution.update({
      where: { id: executionId },
      data: { evidence: JSON.stringify(merged) },
    });
  }

  /**
   * Mark execution as succeeded with outputs.
   */
  async succeed(
    executionId: string,
    outputs: Record<string, unknown>
  ): Promise<void> {
    const execution = await db.execution.findUnique({ where: { id: executionId } });
    if (!execution) throw new Error(`Execution ${executionId} not found`);
    if (execution.status !== "RUNNING") {
      throw new Error(`Cannot complete execution in ${execution.status} status`);
    }

    await db.execution.update({
      where: { id: executionId },
      data: {
        status: "SUCCEEDED",
        outputs: JSON.stringify(outputs),
        completedAt: new Date(),
      },
    });
  }

  /**
   * Mark execution as failed with error details.
   */
  async fail(
    executionId: string,
    errorDetails: Record<string, unknown>
  ): Promise<void> {
    const execution = await db.execution.findUnique({ where: { id: executionId } });
    if (!execution) throw new Error(`Execution ${executionId} not found`);
    if (execution.status !== "RUNNING") {
      throw new Error(`Cannot fail execution in ${execution.status} status`);
    }

    const errors: string[] = execution.errors ? JSON.parse(execution.errors) : [];
    if (errorDetails.errors && Array.isArray(errorDetails.errors)) {
      errors.push(...errorDetails.errors);
    } else if (errorDetails.message) {
      errors.push(String(errorDetails.message));
    }

    await db.execution.update({
      where: { id: executionId },
      data: {
        status: "FAILED",
        errors: JSON.stringify(errors),
        outputs: errorDetails.outputs ? JSON.stringify(errorDetails.outputs) : execution.outputs,
        completedAt: new Date(),
      },
    });
  }

  /**
   * Cancel a running execution.
   */
  async cancel(executionId: string): Promise<void> {
    const execution = await db.execution.findUnique({ where: { id: executionId } });
    if (!execution) throw new Error(`Execution ${executionId} not found`);
    if (execution.status !== "RUNNING" && execution.status !== "PENDING") {
      throw new Error(`Cannot cancel execution in ${execution.status} status`);
    }

    await db.execution.update({
      where: { id: executionId },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
      },
    });
  }

  /**
   * Get the full execution trace by ID.
   */
  async getTrace(executionId: string): Promise<ExecutionTrace | null> {
    const execution = await db.execution.findUnique({ where: { id: executionId } });
    if (!execution) return null;

    return {
      ...execution,
      inputs: execution.inputs ? JSON.parse(execution.inputs) : null,
      outputs: execution.outputs ? JSON.parse(execution.outputs) : null,
      toolsUsed: execution.toolsUsed ? JSON.parse(execution.toolsUsed) : null,
      skillsUsed: execution.skillsUsed ? JSON.parse(execution.skillsUsed) : null,
      errors: execution.errors ? JSON.parse(execution.errors) : null,
      evidence: execution.evidence ? JSON.parse(execution.evidence) : null,
      approvals: execution.approvals ? JSON.parse(execution.approvals) : null,
      status: execution.status as ExecutionStatus,
    };
  }

  /**
   * List executions with optional filters.
   */
  async list(filters: ExecutionFilters = {}): Promise<ExecutionTrace[]> {
    const where: Record<string, unknown> = {};
    if (filters.agentId) where.agentId = filters.agentId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;
    if (filters.task) where.task = { contains: filters.task };
    if (filters.correlationId) where.correlationId = filters.correlationId;

    if (filters.startDate || filters.endDate) {
      const createdAt: Record<string, Date> = {};
      if (filters.startDate) createdAt.gte = filters.startDate;
      if (filters.endDate) createdAt.lte = filters.endDate;
      where.createdAt = createdAt;
    }

    const executions = await db.execution.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    });

    return executions.map((e) => ({
      ...e,
      inputs: e.inputs ? JSON.parse(e.inputs) : null,
      outputs: e.outputs ? JSON.parse(e.outputs) : null,
      toolsUsed: e.toolsUsed ? JSON.parse(e.toolsUsed) : null,
      skillsUsed: e.skillsUsed ? JSON.parse(e.skillsUsed) : null,
      errors: e.errors ? JSON.parse(e.errors) : null,
      evidence: e.evidence ? JSON.parse(e.evidence) : null,
      approvals: e.approvals ? JSON.parse(e.approvals) : null,
      status: e.status as ExecutionStatus,
    }));
  }

  /**
   * Get execution statistics.
   */
  async getStats(agentId?: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    avgCost: number;
    avgDurationMs: number;
    successRate: number;
  }> {
    const effectiveAgentId = agentId || this.defaultAgentId;

    const executions = await db.execution.findMany({
      where: { agentId: effectiveAgentId },
    });

    const byStatus: Record<string, number> = {};
    let totalCost = 0;
    let totalDuration = 0;
    let completedCount = 0;
    let successCount = 0;

    for (const e of executions) {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      totalCost += e.cost;

      if (e.startedAt && e.completedAt) {
        totalDuration += e.completedAt.getTime() - e.startedAt.getTime();
        completedCount++;
      }

      if (e.status === "SUCCEEDED") successCount++;
    }

    return {
      total: executions.length,
      byStatus,
      avgCost: executions.length > 0 ? totalCost / executions.length : 0,
      avgDurationMs: completedCount > 0 ? totalDuration / completedCount : 0,
      successRate: executions.length > 0 ? successCount / executions.length : 0,
    };
  }
}

// Singleton instance
export const executionTracer = new ExecutionTracer();
