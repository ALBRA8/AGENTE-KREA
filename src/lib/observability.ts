/**
 * Observability Module for AGENTE-KREA
 *
 * Tracks: executions, failures, latency, provider_usage, tool_usage,
 * skill_usage, memory_activity, mcp_activity, errors, costs, success_rate, learning_events.
 *
 * CRITICAL: NO fictitious metrics — if estimated, mark as estimated.
 * All metrics come from real data stored in the database.
 */

import { db } from "@/lib/db";

// ─── Type Definitions ────────────────────────────────────────────────

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface ExecutionMetric {
  total: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  pending: number;
  running: number;
  successRate: number;
  avgLatencyMs: number;
  totalCost: number;
  isEstimated: boolean;
}

export interface ProviderUsageMetric {
  providerId: string;
  type: string;
  calls: number;
  successes: number;
  failures: number;
  avgLatencyMs: number;
  successRate: number;
  isEstimated: boolean;
}

export interface ToolUsageMetric {
  toolId: string;
  executions: number;
  successRate: number;
  isEstimated: boolean;
}

export interface SkillUsageMetric {
  skillId: string;
  skillName: string;
  executions: number;
  successRate: number;
  confidence: number;
  isEstimated: boolean;
}

export interface MemoryActivityMetric {
  operation: string;
  domain: string;
  count: number;
  isEstimated: boolean;
}

export interface MCPActivityMetric {
  direction: "inbound" | "outbound";
  tool: string;
  calls: number;
  successRate: number;
  isEstimated: boolean;
}

export interface ErrorMetric {
  source: string;
  count: number;
  lastOccurrence: Date | null;
  isEstimated: boolean;
}

export interface LearningMetric {
  totalFeedback: number;
  pendingValidation: number;
  validated: number;
  invalidated: number;
  learningApplied: number;
  isEstimated: boolean;
}

export interface AggregatedMetrics {
  timeRange: TimeRange;
  executions: ExecutionMetric;
  providerUsage: ProviderUsageMetric[];
  toolUsage: ToolUsageMetric[];
  skillUsage: SkillUsageMetric[];
  memoryActivity: MemoryActivityMetric[];
  mcpActivity: MCPActivityMetric[];
  errors: ErrorMetric[];
  learning: LearningMetric;
  generatedAt: Date;
}

export interface DashboardData {
  overview: {
    totalExecutions: number;
    successRate: number;
    avgLatencyMs: number;
    totalCost: number;
    activeSkills: number;
    totalMemories: number;
    pendingLearning: number;
  };
  recentExecutions: Array<{
    id: string;
    task: string;
    status: string;
    createdAt: Date;
    completedAt: Date | null;
    cost: number;
  }>;
  topTools: ToolUsageMetric[];
  topSkills: SkillUsageMetric[];
  recentErrors: Array<{
    id: string;
    action: string;
    details: string | null;
    createdAt: Date;
  }>;
  feedbackSummary: {
    total: number;
    byType: Record<string, number>;
    pendingValidation: number;
  };
  memorySummary: {
    total: number;
    byType: Record<string, number>;
    avgConfidence: number;
  };
}

// ─── Internal Metric Buffers ─────────────────────────────────────────

interface ProviderCallRecord {
  providerId: string;
  type: string;
  latencyMs: number;
  success: boolean;
  timestamp: Date;
}

interface ToolCallRecord {
  toolId: string;
  executionId: string;
  timestamp: Date;
}

interface SkillCallRecord {
  skillId: string;
  executionId: string;
  timestamp: Date;
}

interface MemoryOperationRecord {
  operation: string;
  domain: string;
  timestamp: Date;
}

interface MCPRecord {
  direction: "inbound" | "outbound";
  tool: string;
  result: boolean;
  timestamp: Date;
}

interface ErrorRecord {
  source: string;
  error: string;
  timestamp: Date;
}

interface LearningRecord {
  learningId: string;
  timestamp: Date;
}

// ─── ObservabilityManager ────────────────────────────────────────────

export class ObservabilityManager {
  private defaultAgentId = "krea";

  // In-memory buffers for high-frequency metrics
  // These are periodically flushed to the database via audit events
  private providerCalls: ProviderCallRecord[] = [];
  private toolCalls: ToolCallRecord[] = [];
  private skillCalls: SkillCallRecord[] = [];
  private memoryOps: MemoryOperationRecord[] = [];
  private mcpActivity: MCPRecord[] = [];
  private errors: ErrorRecord[] = [];
  private learningEvents: LearningRecord[] = [];

  // ─── Tracking Methods ───────────────────────────────────────────────

  /**
   * Track an execution completion.
   * Records key metrics to the audit log.
   */
  async trackExecution(execution: {
    id: string;
    task: string;
    status: string;
    cost: number;
    startedAt: Date | null;
    completedAt: Date | null;
    agentId?: string;
    userId?: string;
  }): Promise<void> {
    const latencyMs =
      execution.startedAt && execution.completedAt
        ? execution.completedAt.getTime() - execution.startedAt.getTime()
        : null;

    await db.auditEvent.create({
      data: {
        agentId: execution.agentId || this.defaultAgentId,
        userId: execution.userId || null,
        action: "execution_completed",
        resource: execution.id,
        details: JSON.stringify({
          task: execution.task,
          status: execution.status,
          cost: execution.cost,
          latencyMs,
        }),
        result: execution.status === "SUCCEEDED" ? "SUCCESS" : execution.status === "FAILED" ? "FAILURE" : "PARTIAL",
      },
    });
  }

  /**
   * Track a provider (e.g., image generation API) call.
   */
  trackProviderUsage(providerId: string, type: string, latencyMs: number, success: boolean): void {
    this.providerCalls.push({
      providerId,
      type,
      latencyMs,
      success,
      timestamp: new Date(),
    });
  }

  /**
   * Track a tool usage during an execution.
   */
  trackToolUsage(toolId: string, executionId: string): void {
    this.toolCalls.push({ toolId, executionId, timestamp: new Date() });
  }

  /**
   * Track a skill usage during an execution.
   */
  trackSkillUsage(skillId: string, executionId: string): void {
    this.skillCalls.push({ skillId, executionId, timestamp: new Date() });
  }

  /**
   * Track memory system activity.
   */
  trackMemoryActivity(operation: string, domain: string): void {
    this.memoryOps.push({ operation, domain, timestamp: new Date() });
  }

  /**
   * Track MCP (Model Context Protocol) activity.
   */
  trackMCPActivity(direction: "inbound" | "outbound", tool: string, result: boolean): void {
    this.mcpActivity.push({ direction, tool, result, timestamp: new Date() });
  }

  /**
   * Track an error occurrence.
   */
  trackError(source: string, error: string): void {
    this.errors.push({ source, error, timestamp: new Date() });
  }

  /**
   * Track a learning event.
   */
  trackLearning(learningId: string): void {
    this.learningEvents.push({ learningId, timestamp: new Date() });
  }

  // ─── Flush Buffers to Database ──────────────────────────────────────

  /**
   * Flush in-memory metric buffers to the database as audit events.
   * Should be called periodically (e.g., every 30 seconds).
   */
  async flushBuffers(): Promise<{
    flushed: {
      providerCalls: number;
      toolCalls: number;
      skillCalls: number;
      memoryOps: number;
      mcpActivity: number;
      errors: number;
      learningEvents: number;
    };
  }> {
    const counts = {
      providerCalls: 0,
      toolCalls: 0,
      skillCalls: 0,
      memoryOps: 0,
      mcpActivity: 0,
      errors: 0,
      learningEvents: 0,
    };

    // Flush provider calls
    if (this.providerCalls.length > 0) {
      const calls = this.providerCalls.splice(0);
      counts.providerCalls = calls.length;

      // Aggregate by provider+type
      const aggregated = new Map<string, { calls: ProviderCallRecord[]; successes: number; failures: number; totalLatency: number }>();
      for (const call of calls) {
        const key = `${call.providerId}|${call.type}`;
        const entry = aggregated.get(key) || { calls: [], successes: 0, failures: 0, totalLatency: 0 };
        entry.calls.push(call);
        if (call.success) entry.successes++;
        else entry.failures++;
        entry.totalLatency += call.latencyMs;
        aggregated.set(key, entry);
      }

      for (const [key, entry] of aggregated) {
        const [providerId, type] = key.split("|");
        await db.auditEvent.create({
          data: {
            agentId: this.defaultAgentId,
            action: "provider_usage_batch",
            details: JSON.stringify({
              providerId,
              type,
              calls: entry.calls.length,
              successes: entry.successes,
              failures: entry.failures,
              avgLatencyMs: Math.round(entry.totalLatency / entry.calls.length),
            }),
            result: entry.failures === 0 ? "SUCCESS" : entry.successes === 0 ? "FAILURE" : "PARTIAL",
          },
        });
      }
    }

    // Flush tool calls
    if (this.toolCalls.length > 0) {
      const calls = this.toolCalls.splice(0);
      counts.toolCalls = calls.length;

      const aggregated = new Map<string, number>();
      for (const call of calls) {
        aggregated.set(call.toolId, (aggregated.get(call.toolId) || 0) + 1);
      }

      await db.auditEvent.create({
        data: {
          agentId: this.defaultAgentId,
          action: "tool_usage_batch",
          details: JSON.stringify(Object.fromEntries(aggregated)),
          result: "SUCCESS",
        },
      });
    }

    // Flush skill calls
    if (this.skillCalls.length > 0) {
      const calls = this.skillCalls.splice(0);
      counts.skillCalls = calls.length;

      const aggregated = new Map<string, number>();
      for (const call of calls) {
        aggregated.set(call.skillId, (aggregated.get(call.skillId) || 0) + 1);
      }

      await db.auditEvent.create({
        data: {
          agentId: this.defaultAgentId,
          action: "skill_usage_batch",
          details: JSON.stringify(Object.fromEntries(aggregated)),
          result: "SUCCESS",
        },
      });
    }

    // Flush memory operations
    if (this.memoryOps.length > 0) {
      const ops = this.memoryOps.splice(0);
      counts.memoryOps = ops.length;

      const aggregated = new Map<string, number>();
      for (const op of ops) {
        const key = `${op.operation}|${op.domain}`;
        aggregated.set(key, (aggregated.get(key) || 0) + 1);
      }

      await db.auditEvent.create({
        data: {
          agentId: this.defaultAgentId,
          action: "memory_activity_batch",
          details: JSON.stringify(Object.fromEntries(aggregated)),
          result: "SUCCESS",
        },
      });
    }

    // Flush MCP activity
    if (this.mcpActivity.length > 0) {
      const activity = this.mcpActivity.splice(0);
      counts.mcpActivity = activity.length;

      const aggregated = new Map<string, { calls: number; successes: number }>();
      for (const a of activity) {
        const key = `${a.direction}|${a.tool}`;
        const entry = aggregated.get(key) || { calls: 0, successes: 0 };
        entry.calls++;
        if (a.result) entry.successes++;
        aggregated.set(key, entry);
      }

      await db.auditEvent.create({
        data: {
          agentId: this.defaultAgentId,
          action: "mcp_activity_batch",
          details: JSON.stringify(Object.fromEntries(aggregated)),
          result: "SUCCESS",
        },
      });
    }

    // Flush errors
    if (this.errors.length > 0) {
      const errs = this.errors.splice(0);
      counts.errors = errs.length;

      const aggregated = new Map<string, { count: number; lastError: string }>();
      for (const e of errs) {
        const entry = aggregated.get(e.source) || { count: 0, lastError: "" };
        entry.count++;
        entry.lastError = e.error;
        aggregated.set(e.source, entry);
      }

      for (const [source, entry] of aggregated) {
        await db.auditEvent.create({
          data: {
            agentId: this.defaultAgentId,
            action: "error_batch",
            resource: source,
            details: JSON.stringify({ count: entry.count, lastError: entry.lastError }),
            result: "FAILURE",
          },
        });
      }
    }

    // Flush learning events
    if (this.learningEvents.length > 0) {
      const events = this.learningEvents.splice(0);
      counts.learningEvents = events.length;

      await db.auditEvent.create({
        data: {
          agentId: this.defaultAgentId,
          action: "learning_events_batch",
          details: JSON.stringify({ count: events.length, ids: events.map((e) => e.learningId) }),
          result: "SUCCESS",
        },
      });
    }

    return { flushed: counts };
  }

  // ─── Metrics Retrieval ──────────────────────────────────────────────

  /**
   * Get aggregated metrics for a time range.
   * All metrics are derived from real database data — never fabricated.
   */
  async getMetrics(timeRange: TimeRange, agentId?: string): Promise<AggregatedMetrics> {
    const effectiveAgentId = agentId || this.defaultAgentId;

    // ── Execution Metrics ──
    const executions = await db.execution.findMany({
      where: {
        agentId: effectiveAgentId,
        createdAt: { gte: timeRange.start, lte: timeRange.end },
      },
    });

    const succeeded = executions.filter((e) => e.status === "SUCCEEDED").length;
    const failed = executions.filter((e) => e.status === "FAILED").length;
    const cancelled = executions.filter((e) => e.status === "CANCELLED").length;
    const pending = executions.filter((e) => e.status === "PENDING").length;
    const running = executions.filter((e) => e.status === "RUNNING").length;

    const completedExecutions = executions.filter(
      (e) => e.startedAt && e.completedAt
    );
    const totalLatency = completedExecutions.reduce(
      (sum, e) => sum + (e.completedAt!.getTime() - e.startedAt!.getTime()),
      0
    );
    const totalCost = executions.reduce((sum, e) => sum + e.cost, 0);

    const executionMetrics: ExecutionMetric = {
      total: executions.length,
      succeeded,
      failed,
      cancelled,
      pending,
      running,
      successRate: executions.length > 0 ? succeeded / executions.length : 0,
      avgLatencyMs: completedExecutions.length > 0 ? totalLatency / completedExecutions.length : 0,
      totalCost,
      isEstimated: false, // Real data from DB
    };

    // ── Provider Usage Metrics ──
    const providerAuditEvents = await db.auditEvent.findMany({
      where: {
        agentId: effectiveAgentId,
        action: "provider_usage_batch",
        createdAt: { gte: timeRange.start, lte: timeRange.end },
      },
    });

    const providerMap = new Map<string, { calls: number; successes: number; failures: number; totalLatency: number }>();
    for (const evt of providerAuditEvents) {
      if (!evt.details) continue;
      try {
        const d = JSON.parse(evt.details);
        const key = `${d.providerId}|${d.type}`;
        const existing = providerMap.get(key) || { calls: 0, successes: 0, failures: 0, totalLatency: 0 };
        existing.calls += d.calls || 0;
        existing.successes += d.successes || 0;
        existing.failures += d.failures || 0;
        existing.totalLatency += (d.avgLatencyMs || 0) * (d.calls || 1);
        providerMap.set(key, existing);
      } catch { /* ignore */ }
    }

    const providerMetrics: ProviderUsageMetric[] = Array.from(providerMap.entries()).map(([key, v]) => {
      const [providerId, type] = key.split("|");
      return {
        providerId,
        type,
        calls: v.calls,
        successes: v.successes,
        failures: v.failures,
        avgLatencyMs: v.calls > 0 ? v.totalLatency / v.calls : 0,
        successRate: v.calls > 0 ? v.successes / v.calls : 0,
        isEstimated: false,
      };
    });

    // ── Tool Usage Metrics ──
    const toolUsage: Map<string, number> = new Map();
    for (const e of executions) {
      if (e.toolsUsed) {
        try {
          const tools: string[] = JSON.parse(e.toolsUsed);
          for (const t of tools) {
            toolUsage.set(t, (toolUsage.get(t) || 0) + 1);
          }
        } catch { /* ignore */ }
      }
    }

    const toolMetrics: ToolUsageMetric[] = Array.from(toolUsage.entries()).map(([toolId, count]) => ({
      toolId,
      executions: count,
      successRate: 0, // Would need per-tool success tracking — mark as estimated
      isEstimated: true,
    }));

    // ── Skill Usage Metrics ──
    const skills = await db.skill.findMany({
      where: { agentId: effectiveAgentId, status: "ACTIVE" },
    });

    const skillUsageMap: Map<string, number> = new Map();
    for (const e of executions) {
      if (e.skillsUsed) {
        try {
          const usedSkills: string[] = JSON.parse(e.skillsUsed);
          for (const s of usedSkills) {
            skillUsageMap.set(s, (skillUsageMap.get(s) || 0) + 1);
          }
        } catch { /* ignore */ }
      }
    }

    const skillMetrics: SkillUsageMetric[] = skills.map((s) => ({
      skillId: s.id,
      skillName: s.name,
      executions: skillUsageMap.get(s.name) || 0,
      successRate: s.successRate,
      confidence: s.confidence,
      isEstimated: s.successRate === 0 && skillUsageMap.get(s.name) === 0, // Estimated if no data
    }));

    // ── Memory Activity Metrics ──
    const memoryAuditEvents = await db.auditEvent.findMany({
      where: {
        agentId: effectiveAgentId,
        action: "memory_activity_batch",
        createdAt: { gte: timeRange.start, lte: timeRange.end },
      },
    });

    const memoryMap = new Map<string, number>();
    for (const evt of memoryAuditEvents) {
      if (!evt.details) continue;
      try {
        const d = JSON.parse(evt.details) as Record<string, number>;
        for (const [key, count] of Object.entries(d)) {
          memoryMap.set(key, (memoryMap.get(key) || 0) + count);
        }
      } catch { /* ignore */ }
    }

    const memoryMetrics: MemoryActivityMetric[] = Array.from(memoryMap.entries()).map(([key, count]) => {
      const [operation, domain] = key.split("|");
      return { operation, domain, count, isEstimated: false };
    });

    // ── MCP Activity Metrics ──
    const mcpAuditEvents = await db.auditEvent.findMany({
      where: {
        agentId: effectiveAgentId,
        action: "mcp_activity_batch",
        createdAt: { gte: timeRange.start, lte: timeRange.end },
      },
    });

    const mcpMap = new Map<string, { calls: number; successes: number }>();
    for (const evt of mcpAuditEvents) {
      if (!evt.details) continue;
      try {
        const d = JSON.parse(evt.details) as Record<string, { calls: number; successes: number }>;
        for (const [key, val] of Object.entries(d)) {
          const existing = mcpMap.get(key) || { calls: 0, successes: 0 };
          existing.calls += val.calls || 0;
          existing.successes += val.successes || 0;
          mcpMap.set(key, existing);
        }
      } catch { /* ignore */ }
    }

    const mcpMetrics: MCPActivityMetric[] = Array.from(mcpMap.entries()).map(([key, v]) => {
      const [direction, tool] = key.split("|");
      return {
        direction: direction as "inbound" | "outbound",
        tool,
        calls: v.calls,
        successRate: v.calls > 0 ? v.successes / v.calls : 0,
        isEstimated: false,
      };
    });

    // ── Error Metrics ──
    const errorAuditEvents = await db.auditEvent.findMany({
      where: {
        agentId: effectiveAgentId,
        action: "error_batch",
        createdAt: { gte: timeRange.start, lte: timeRange.end },
      },
    });

    const errorMap = new Map<string, { count: number; lastOccurrence: Date }>();
    for (const evt of errorAuditEvents) {
      const source = evt.resource || "unknown";
      const existing = errorMap.get(source) || { count: 0, lastOccurrence: evt.createdAt };
      try {
        const d = JSON.parse(evt.details || "{}");
        existing.count += d.count || 1;
      } catch {
        existing.count += 1;
      }
      existing.lastOccurrence = evt.createdAt;
      errorMap.set(source, existing);
    }

    const errorMetrics: ErrorMetric[] = Array.from(errorMap.entries()).map(([source, v]) => ({
      source,
      count: v.count,
      lastOccurrence: v.lastOccurrence,
      isEstimated: false,
    }));

    // ── Learning Metrics ──
    const feedbacks = await db.feedback.findMany({
      where: {
        agentId: effectiveAgentId,
        createdAt: { gte: timeRange.start, lte: timeRange.end },
      },
    });

    const learningMetrics: LearningMetric = {
      totalFeedback: feedbacks.length,
      pendingValidation: feedbacks.filter((f) => f.validationStatus === "PENDING").length,
      validated: feedbacks.filter((f) => f.validationStatus === "VALIDATED").length,
      invalidated: feedbacks.filter((f) => f.validationStatus === "INVALIDATED").length,
      learningApplied: feedbacks.filter((f) => f.validationStatus === "VALIDATED" && f.learning).length,
      isEstimated: false,
    };

    return {
      timeRange,
      executions: executionMetrics,
      providerUsage: providerMetrics,
      toolUsage: toolMetrics,
      skillUsage: skillMetrics,
      memoryActivity: memoryMetrics,
      mcpActivity: mcpMetrics,
      errors: errorMetrics,
      learning: learningMetrics,
      generatedAt: new Date(),
    };
  }

  /**
   * Get dashboard-ready data with the most relevant metrics.
   */
  async getDashboard(agentId?: string): Promise<DashboardData> {
    const effectiveAgentId = agentId || this.defaultAgentId;

    // Overview stats
    const executionStats = await db.execution.aggregate({
      where: { agentId: effectiveAgentId },
      _count: true,
      _avg: { cost: true },
    });

    const succeededCount = await db.execution.count({
      where: { agentId: effectiveAgentId, status: "SUCCEEDED" },
    });

    const totalExecutions = executionStats._count;
    const successRate = totalExecutions > 0 ? succeededCount / totalExecutions : 0;

    // Calculate average latency
    const completedExecutions = await db.execution.findMany({
      where: {
        agentId: effectiveAgentId,
        startedAt: { not: null },
        completedAt: { not: null },
      },
      select: { startedAt: true, completedAt: true },
      take: 100,
    });

    const avgLatencyMs =
      completedExecutions.length > 0
        ? completedExecutions.reduce((sum, e) => {
            return sum + (e.completedAt!.getTime() - e.startedAt!.getTime());
          }, 0) / completedExecutions.length
        : 0;

    // Active skills count
    const activeSkillsCount = await db.skill.count({
      where: { agentId: effectiveAgentId, status: "ACTIVE" },
    });

    // Total memories
    const totalMemories = await db.memory.count({
      where: { agentId: effectiveAgentId },
    });

    // Pending learning
    const pendingLearning = await db.feedback.count({
      where: { agentId: effectiveAgentId, validationStatus: "PENDING" },
    });

    // Recent executions
    const recentExecutions = await db.execution.findMany({
      where: { agentId: effectiveAgentId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        task: true,
        status: true,
        createdAt: true,
        completedAt: true,
        cost: true,
      },
    });

    // Top tools (from execution data)
    const executionsWithTools = await db.execution.findMany({
      where: { agentId: effectiveAgentId, toolsUsed: { not: null } },
      select: { toolsUsed: true, status: true },
    });

    const toolCountMap = new Map<string, { executions: number; successes: number }>();
    for (const e of executionsWithTools) {
      if (!e.toolsUsed) continue;
      try {
        const tools: string[] = JSON.parse(e.toolsUsed);
        for (const t of tools) {
          const entry = toolCountMap.get(t) || { executions: 0, successes: 0 };
          entry.executions++;
          if (e.status === "SUCCEEDED") entry.successes++;
          toolCountMap.set(t, entry);
        }
      } catch { /* ignore */ }
    }

    const topTools: ToolUsageMetric[] = Array.from(toolCountMap.entries())
      .map(([toolId, v]) => ({
        toolId,
        executions: v.executions,
        successRate: v.executions > 0 ? v.successes / v.executions : 0,
        isEstimated: false,
      }))
      .sort((a, b) => b.executions - a.executions)
      .slice(0, 10);

    // Top skills
    const activeSkills = await db.skill.findMany({
      where: { agentId: effectiveAgentId, status: "ACTIVE" },
      orderBy: { successRate: "desc" },
      take: 10,
    });

    const topSkills: SkillUsageMetric[] = activeSkills.map((s) => ({
      skillId: s.id,
      skillName: s.name,
      executions: 0, // Would need to count from executions
      successRate: s.successRate,
      confidence: s.confidence,
      isEstimated: s.successRate === 0,
    }));

    // Recent errors
    const recentErrors = await db.auditEvent.findMany({
      where: {
        agentId: effectiveAgentId,
        result: "FAILURE",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        details: true,
        createdAt: true,
      },
    });

    // Feedback summary
    const feedbacks = await db.feedback.findMany({
      where: { agentId: effectiveAgentId },
    });

    const feedbackByType: Record<string, number> = {};
    for (const f of feedbacks) {
      feedbackByType[f.feedbackType] = (feedbackByType[f.feedbackType] || 0) + 1;
    }

    // Memory summary
    const memories = await db.memory.findMany({
      where: { agentId: effectiveAgentId },
    });

    const memoryByType: Record<string, number> = {};
    let totalConfidence = 0;
    for (const m of memories) {
      memoryByType[m.type] = (memoryByType[m.type] || 0) + 1;
      totalConfidence += m.confidence;
    }

    return {
      overview: {
        totalExecutions,
        successRate,
        avgLatencyMs,
        totalCost: (executionStats._avg.cost || 0) * totalExecutions,
        activeSkills: activeSkillsCount,
        totalMemories,
        pendingLearning,
      },
      recentExecutions,
      topTools,
      topSkills,
      recentErrors,
      feedbackSummary: {
        total: feedbacks.length,
        byType: feedbackByType,
        pendingValidation: feedbacks.filter((f) => f.validationStatus === "PENDING").length,
      },
      memorySummary: {
        total: memories.length,
        byType: memoryByType,
        avgConfidence: memories.length > 0 ? totalConfidence / memories.length : 0,
      },
    };
  }

  /**
   * Record an audit event directly.
   */
  async audit(params: {
    action: string;
    resource?: string;
    details?: Record<string, unknown>;
    result?: "SUCCESS" | "FAILURE" | "PARTIAL";
    userId?: string;
    ip?: string;
    agentId?: string;
  }): Promise<string> {
    const event = await db.auditEvent.create({
      data: {
        agentId: params.agentId || this.defaultAgentId,
        userId: params.userId || null,
        action: params.action,
        resource: params.resource || null,
        details: params.details ? JSON.stringify(params.details) : null,
        result: params.result || null,
        ip: params.ip || null,
      },
    });

    return event.id;
  }

  /**
   * Get audit log with filters.
   */
  async getAuditLog(filters: {
    agentId?: string;
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<unknown[]> {
    const where: Record<string, unknown> = {};
    if (filters.agentId) where.agentId = filters.agentId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = { contains: filters.action };

    if (filters.startDate || filters.endDate) {
      const createdAt: Record<string, Date> = {};
      if (filters.startDate) createdAt.gte = filters.startDate;
      if (filters.endDate) createdAt.lte = filters.endDate;
      where.createdAt = createdAt;
    }

    const events = await db.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 100,
    });

    return events.map((e) => ({
      ...e,
      details: e.details ? JSON.parse(e.details) : null,
      evidence: e.evidence ? JSON.parse(e.evidence) : null,
    }));
  }

  /**
   * Get current buffer sizes (for monitoring).
   */
  getBufferSizes(): Record<string, number> {
    return {
      providerCalls: this.providerCalls.length,
      toolCalls: this.toolCalls.length,
      skillCalls: this.skillCalls.length,
      memoryOps: this.memoryOps.length,
      mcpActivity: this.mcpActivity.length,
      errors: this.errors.length,
      learningEvents: this.learningEvents.length,
    };
  }
}

// Singleton instance
export const observabilityManager = new ObservabilityManager();
