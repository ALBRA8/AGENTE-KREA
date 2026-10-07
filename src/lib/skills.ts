/**
 * Skill System for AGENTE-KREA
 *
 * Skills know HOW to do something (vs memory which remembers something).
 * Lifecycle: PROPOSED → VALIDATING → ACTIVE → DEPRECATED → RETIRED
 * Each skill has a structured procedure, prerequisites, tools, and verification.
 */

import { db } from "@/lib/db";
import { ExecutionTracer } from "@/lib/execution";

// ─── Type Definitions ────────────────────────────────────────────────

export type SkillStatus = "PROPOSED" | "VALIDATING" | "ACTIVE" | "DEPRECATED" | "RETIRED";
export type SkillOrigin = "MANUAL" | "LEARNED" | "FEEDBACK" | "IMPORTED";

export interface ProcedureStep {
  step: number;
  action: string;
  description: string;
  tool?: string;
  params?: Record<string, unknown>;
  condition?: string; // Optional condition to execute this step
  onError?: "continue" | "abort" | "retry";
}

export interface SkillDefinition {
  agentId?: string;
  name: string;
  description: string;
  purpose: string;
  trigger?: string;
  prerequisites?: string[]; // Skill IDs or conditions
  procedure: ProcedureStep[];
  toolsRequired?: string[];
  expectedResult?: string;
  verification?: string;
  pitfalls?: string[];
  evidence?: Record<string, unknown>;
  confidence?: number;
  origin?: SkillOrigin;
}

export interface SkillExecutionResult {
  success: boolean;
  outputs: Record<string, unknown>;
  errors: string[];
  stepsCompleted: number;
  stepsTotal: number;
  executionId: string;
}

export interface SkillFeedbackInput {
  success: boolean;
  partialSuccess?: boolean;
  errors?: string[];
  actualResult?: string;
}

// ─── Valid Transitions ───────────────────────────────────────────────

const VALID_TRANSITIONS: Record<SkillStatus, SkillStatus[]> = {
  PROPOSED: ["VALIDATING"],
  VALIDATING: ["ACTIVE", "PROPOSED"],
  ACTIVE: ["DEPRECATED"],
  DEPRECATED: ["RETIRED", "ACTIVE"],
  RETIRED: [],
};

// ─── SkillManager ────────────────────────────────────────────────────

export class SkillManager {
  private defaultAgentId = "krea";

  /**
   * Register a new skill in PROPOSED status.
   */
  async register(definition: SkillDefinition): Promise<{ id: string }> {
    const agentId = definition.agentId || this.defaultAgentId;

    // Check if a skill with the same name already exists (any version)
    const existing = await db.skill.findFirst({
      where: { agentId, name: definition.name },
      orderBy: { version: "desc" },
    });

    const version = existing ? existing.version + 1 : 1;

    const skill = await db.skill.create({
      data: {
        agentId,
        name: definition.name,
        description: definition.description,
        purpose: definition.purpose,
        trigger: definition.trigger || null,
        prerequisites: definition.prerequisites ? JSON.stringify(definition.prerequisites) : null,
        procedure: JSON.stringify(definition.procedure),
        toolsRequired: definition.toolsRequired ? JSON.stringify(definition.toolsRequired) : null,
        expectedResult: definition.expectedResult || null,
        verification: definition.verification || null,
        pitfalls: definition.pitfalls ? JSON.stringify(definition.pitfalls) : null,
        evidence: definition.evidence ? JSON.stringify(definition.evidence) : null,
        confidence: definition.confidence ?? 0.5,
        successRate: 0.0,
        origin: definition.origin || "MANUAL",
        version,
        status: "PROPOSED",
      },
    });

    return { id: skill.id };
  }

  /**
   * Move a skill from PROPOSED to VALIDATING, then run verification logic.
   */
  async validate(skillId: string): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const skill = await db.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new Error(`Skill ${skillId} not found`);
    if (skill.status !== "PROPOSED") {
      throw new Error(`Skill must be in PROPOSED status to validate, current: ${skill.status}`);
    }

    const issues: string[] = [];

    // Parse and validate procedure
    let procedure: ProcedureStep[] = [];
    try {
      procedure = JSON.parse(skill.procedure);
      if (!Array.isArray(procedure) || procedure.length === 0) {
        issues.push("Procedure must be a non-empty array of steps");
      } else {
        // Check step ordering
        const stepNumbers = procedure.map((s) => s.step).sort();
        for (let i = 0; i < stepNumbers.length; i++) {
          if (stepNumbers[i] !== i + 1) {
            issues.push(`Procedure steps must be numbered sequentially starting from 1`);
            break;
          }
        }
        // Check each step has required fields
        for (const step of procedure) {
          if (!step.action) issues.push(`Step ${step.step} missing action`);
          if (!step.description) issues.push(`Step ${step.step} missing description`);
        }
      }
    } catch {
      issues.push("Procedure is not valid JSON");
    }

    // Check prerequisites exist
    if (skill.prerequisites) {
      try {
        const prereqIds: string[] = JSON.parse(skill.prerequisites);
        for (const prereqId of prereqIds) {
          const prereq = await db.skill.findUnique({ where: { id: prereqId } });
          if (!prereq || prereq.status !== "ACTIVE") {
            issues.push(`Prerequisite skill ${prereqId} is not active or doesn't exist`);
          }
        }
      } catch {
        issues.push("Prerequisites is not valid JSON");
      }
    }

    // Check tools are specified if procedure uses them
    const toolsInProcedure = procedure.filter((s) => s.tool).map((s) => s.tool!);
    if (toolsInProcedure.length > 0 && !skill.toolsRequired) {
      issues.push("Procedure uses tools but toolsRequired is not specified");
    }

    // Transition status
    await this.transitionStatus(skillId, "PROPOSED", "VALIDATING");

    if (issues.length === 0) {
      // Validation passed — update lastValidated
      await db.skill.update({
        where: { id: skillId },
        data: { lastValidated: new Date() },
      });
    } else {
      // Roll back to PROPOSED
      await this.transitionStatus(skillId, "VALIDATING", "PROPOSED");
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Activate a validated skill: VALIDATING → ACTIVE.
   */
  async activate(skillId: string): Promise<void> {
    const skill = await db.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new Error(`Skill ${skillId} not found`);

    if (skill.status !== "VALIDATING") {
      throw new Error(`Skill must be in VALIDATING status to activate, current: ${skill.status}`);
    }

    // Check prerequisites are all active
    if (skill.prerequisites) {
      try {
        const prereqIds: string[] = JSON.parse(skill.prerequisites);
        for (const prereqId of prereqIds) {
          const prereq = await db.skill.findUnique({ where: { id: prereqId } });
          if (!prereq || prereq.status !== "ACTIVE") {
            throw new Error(`Prerequisite skill ${prereqId} is not active`);
          }
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("Prerequisite")) throw e;
      }
    }

    await this.transitionStatus(skillId, "VALIDATING", "ACTIVE");
  }

  /**
   * Execute a skill's procedure with full execution tracing.
   * Returns step-by-step results.
   */
  async execute(
    skillId: string,
    params: Record<string, unknown> = {},
    userId?: string
  ): Promise<SkillExecutionResult> {
    const skill = await db.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new Error(`Skill ${skillId} not found`);
    if (skill.status !== "ACTIVE") {
      throw new Error(`Skill must be ACTIVE to execute, current: ${skill.status}`);
    }

    const procedure: ProcedureStep[] = JSON.parse(skill.procedure);
    const tracer = new ExecutionTracer();

    // Start execution trace
    const executionId = await tracer.start(`skill:${skill.name}`, {
      agentId: skill.agentId,
      userId: userId || undefined,
      inputs: params,
      skillsUsed: [skill.name],
      correlationId: `skill-${skillId}-${Date.now()}`,
    });

    await tracer.addSkill(executionId, skill.name);

    const outputs: Record<string, unknown> = {};
    const errors: string[] = [];
    let stepsCompleted = 0;

    for (const step of procedure) {
      try {
        // Execute step — resolve params with provided params
        const resolvedParams = this.resolveStepParams(step.params || {}, params, outputs);

        // Record tool usage if step uses a tool
        if (step.tool) {
          await tracer.addTool(executionId, step.tool);
        }

        // Simulate step execution (in production, this would dispatch to actual tools)
        const stepResult = await this.executeStep(step, resolvedParams);

        outputs[`step${step.step}`] = stepResult;
        stepsCompleted++;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        errors.push(`Step ${step.step}: ${errMsg}`);
        await tracer.addError(executionId, errMsg);

        if (step.onError === "abort" || !step.onError) {
          break;
        }
        // "continue" or "retry" — we continue to next step
      }
    }

    const success = errors.length === 0 && stepsCompleted === procedure.length;

    if (success) {
      await tracer.succeed(executionId, outputs);
    } else {
      await tracer.fail(executionId, { errors, outputs, stepsCompleted, stepsTotal: procedure.length });
    }

    // Update skill success rate
    await this.recordExecutionOutcome(skillId, success);

    return {
      success,
      outputs,
      errors,
      stepsCompleted,
      stepsTotal: procedure.length,
      executionId,
    };
  }

  /**
   * Deprecate an active skill: ACTIVE → DEPRECATED.
   */
  async deprecate(skillId: string, reason?: string): Promise<void> {
    await this.transitionStatus(skillId, "ACTIVE", "DEPRECATED");

    if (reason) {
      const skill = await db.skill.findUnique({ where: { id: skillId } });
      if (skill) {
        const evidence = skill.evidence ? JSON.parse(skill.evidence) : {};
        evidence.deprecationReason = reason;
        evidence.deprecatedAt = new Date().toISOString();
        await db.skill.update({
          where: { id: skillId },
          data: { evidence: JSON.stringify(evidence) },
        });
      }
    }
  }

  /**
   * Retire a deprecated skill: DEPRECATED → RETIRED.
   */
  async retire(skillId: string): Promise<void> {
    await this.transitionStatus(skillId, "DEPRECATED", "RETIRED");
  }

  /**
   * Create a new version of a skill with updated definition.
   */
  async updateVersion(skillId: string, updates: Partial<SkillDefinition>): Promise<{ id: string }> {
    const skill = await db.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new Error(`Skill ${skillId} not found`);

    // Create new version
    const newDef: SkillDefinition = {
      agentId: skill.agentId,
      name: skill.name,
      description: updates.description || skill.description,
      purpose: updates.purpose || skill.purpose,
      trigger: updates.trigger || skill.trigger || undefined,
      prerequisites: updates.prerequisites || (skill.prerequisites ? JSON.parse(skill.prerequisites) : undefined),
      procedure: updates.procedure || JSON.parse(skill.procedure),
      toolsRequired: updates.toolsRequired || (skill.toolsRequired ? JSON.parse(skill.toolsRequired) : undefined),
      expectedResult: updates.expectedResult || skill.expectedResult || undefined,
      verification: updates.verification || skill.verification || undefined,
      pitfalls: updates.pitfalls || (skill.pitfalls ? JSON.parse(skill.pitfalls) : undefined),
      evidence: updates.evidence || (skill.evidence ? JSON.parse(skill.evidence) : undefined),
      confidence: updates.confidence ?? skill.confidence,
      origin: updates.origin || "MANUAL",
    };

    const result = await this.register(newDef);
    return result;
  }

  /**
   * Roll back to a specific version of a skill.
   * Activates the target version and deprecates the current one.
   */
  async rollback(skillId: string, targetVersion: number): Promise<{ rolledBackTo: string }> {
    const currentSkill = await db.skill.findUnique({ where: { id: skillId } });
    if (!currentSkill) throw new Error(`Skill ${skillId} not found`);

    // Find the target version
    const targetSkill = await db.skill.findFirst({
      where: {
        agentId: currentSkill.agentId,
        name: currentSkill.name,
        version: targetVersion,
      },
    });

    if (!targetSkill) {
      throw new Error(`Version ${targetVersion} of skill ${currentSkill.name} not found`);
    }

    if (targetSkill.status !== "ACTIVE") {
      // Need to activate the target version
      if (targetSkill.status === "PROPOSED" || targetSkill.status === "VALIDATING") {
        // Force-activate it
        await db.skill.update({
          where: { id: targetSkill.id },
          data: { status: "ACTIVE" },
        });
      }
    }

    // Deprecate the current skill if it's active
    if (currentSkill.status === "ACTIVE") {
      await db.skill.update({
        where: { id: currentSkill.id },
        data: { status: "DEPRECATED" },
      });
    }

    return { rolledBackTo: targetSkill.id };
  }

  /**
   * Update success rate based on historical feedback.
   */
  async measure(skillId: string): Promise<{
    successRate: number;
    totalExecutions: number;
    successfulExecutions: number;
  }> {
    const skill = await db.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new Error(`Skill ${skillId} not found`);

    // Count executions that used this skill
    const executions = await db.execution.findMany({
      where: {
        agentId: skill.agentId,
        skillsUsed: { contains: skill.name },
      },
    });

    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter((e) => e.status === "SUCCEEDED").length;
    const successRate = totalExecutions > 0 ? successfulExecutions / totalExecutions : 0;

    await db.skill.update({
      where: { id: skillId },
      data: { successRate },
    });

    return { successRate, totalExecutions, successfulExecutions };
  }

  /**
   * Incorporate feedback to improve a skill.
   * May update procedure, pitfalls, or confidence based on feedback.
   */
  async improve(skillId: string, feedback: SkillFeedbackInput): Promise<void> {
    const skill = await db.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new Error(`Skill ${skillId} not found`);

    const evidence = skill.evidence ? JSON.parse(skill.evidence) : {};
    const pitfalls: string[] = skill.pitfalls ? JSON.parse(skill.pitfalls) : [];

    if (feedback.success) {
      // Boost confidence slightly
      const newConfidence = Math.min(1.0, skill.confidence + 0.02);
      evidence.lastPositiveFeedback = new Date().toISOString();

      await db.skill.update({
        where: { id: skillId },
        data: {
          confidence: newConfidence,
          evidence: JSON.stringify(evidence),
        },
      });
    } else if (feedback.partialSuccess) {
      // Slight confidence reduction, record as pitfall
      const newConfidence = Math.max(0, skill.confidence - 0.05);
      const pitfallText = feedback.actualResult
        ? `Partial success: expected "${skill.expectedResult}" but got "${feedback.actualResult}"`
        : `Partial success at ${new Date().toISOString()}`;

      if (!pitfalls.includes(pitfallText)) {
        pitfalls.push(pitfallText);
      }

      await db.skill.update({
        where: { id: skillId },
        data: {
          confidence: newConfidence,
          pitfalls: JSON.stringify(pitfalls),
          evidence: JSON.stringify(evidence),
        },
      });
    } else {
      // Failure: reduce confidence, record errors as pitfalls
      const newConfidence = Math.max(0, skill.confidence - 0.1);
      evidence.lastNegativeFeedback = new Date().toISOString();

      if (feedback.errors) {
        for (const err of feedback.errors) {
          const pitfallText = `Error: ${err}`;
          if (!pitfalls.includes(pitfallText)) {
            pitfalls.push(pitfallText);
          }
        }
      }

      // If confidence drops below threshold, suggest deprecation
      if (newConfidence < 0.2 && skill.status === "ACTIVE") {
        evidence.deprecationSuggested = true;
        evidence.deprecationReason = "Confidence dropped below 0.2 due to repeated failures";
      }

      await db.skill.update({
        where: { id: skillId },
        data: {
          confidence: newConfidence,
          pitfalls: JSON.stringify(pitfalls),
          evidence: JSON.stringify(evidence),
        },
      });
    }
  }

  /**
   * Get a skill by ID with parsed JSON fields.
   */
  async get(skillId: string): Promise<unknown | null> {
    const skill = await db.skill.findUnique({ where: { id: skillId } });
    if (!skill) return null;

    return {
      ...skill,
      procedure: JSON.parse(skill.procedure),
      prerequisites: skill.prerequisites ? JSON.parse(skill.prerequisites) : null,
      toolsRequired: skill.toolsRequired ? JSON.parse(skill.toolsRequired) : null,
      pitfalls: skill.pitfalls ? JSON.parse(skill.pitfalls) : null,
      evidence: skill.evidence ? JSON.parse(skill.evidence) : null,
    };
  }

  /**
   * List skills with optional filters.
   */
  async list(filters: {
    agentId?: string;
    status?: SkillStatus;
    name?: string;
  } = {}): Promise<unknown[]> {
    const where: Record<string, unknown> = {};
    if (filters.agentId) where.agentId = filters.agentId;
    if (filters.status) where.status = filters.status;
    if (filters.name) where.name = { contains: filters.name };

    const skills = await db.skill.findMany({
      where,
      orderBy: [{ name: "asc" }, { version: "desc" }],
    });

    return skills.map((s) => ({
      ...s,
      procedure: JSON.parse(s.procedure),
      prerequisites: s.prerequisites ? JSON.parse(s.prerequisites) : null,
      toolsRequired: s.toolsRequired ? JSON.parse(s.toolsRequired) : null,
      pitfalls: s.pitfalls ? JSON.parse(s.pitfalls) : null,
      evidence: s.evidence ? JSON.parse(s.evidence) : null,
    }));
  }

  // ─── Private Helpers ───────────────────────────────────────────────

  /**
   * Transition skill status with validation.
   */
  private async transitionStatus(
    skillId: string,
    from: SkillStatus,
    to: SkillStatus
  ): Promise<void> {
    const skill = await db.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new Error(`Skill ${skillId} not found`);
    if (skill.status !== from) {
      throw new Error(`Expected status ${from}, got ${skill.status}`);
    }
    if (!VALID_TRANSITIONS[from].includes(to)) {
      throw new Error(`Invalid transition: ${from} → ${to}`);
    }

    await db.skill.update({
      where: { id: skillId },
      data: { status: to },
    });
  }

  /**
   * Resolve step parameters by merging skill params with execution context.
   */
  private resolveStepParams(
    stepParams: Record<string, unknown>,
    execParams: Record<string, unknown>,
    outputs: Record<string, unknown>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(stepParams)) {
      if (typeof value === "string" && value.startsWith("$")) {
        // Variable reference: $paramName or $outputs.step1.field
        const ref = value.slice(1);
        if (ref.startsWith("outputs.")) {
          const path = ref.slice(8).split(".");
          let current: unknown = outputs;
          for (const p of path) {
            current = (current as Record<string, unknown>)?.[p];
          }
          resolved[key] = current;
        } else {
          resolved[key] = execParams[ref];
        }
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Execute a single procedure step.
   * In production, this would dispatch to actual tool implementations.
   * For now, returns the step description and resolved params as the result.
   */
  private async executeStep(
    step: ProcedureStep,
    resolvedParams: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Evaluate condition if present
    if (step.condition) {
      // Simple condition evaluation: "paramName === value"
      const match = step.condition.match(/^(\w+)\s*(===|!==|>|<|>=|<=)\s*(.+)$/);
      if (match) {
        const [, varName, operator, expected] = match;
        const actual = resolvedParams[varName];
        const expectedVal = expected.replace(/['"]/g, "");

        let conditionMet = false;
        switch (operator) {
          case "===": conditionMet = String(actual) === expectedVal; break;
          case "!==": conditionMet = String(actual) !== expectedVal; break;
          case ">": conditionMet = Number(actual) > Number(expectedVal); break;
          case "<": conditionMet = Number(actual) < Number(expectedVal); break;
          case ">=": conditionMet = Number(actual) >= Number(expectedVal); break;
          case "<=": conditionMet = Number(actual) <= Number(expectedVal); break;
        }

        if (!conditionMet) {
          return { skipped: true, reason: `Condition not met: ${step.condition}` };
        }
      }
    }

    // Execute the action
    return {
      action: step.action,
      tool: step.tool || null,
      params: resolvedParams,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Record the outcome of a skill execution to update success rate.
   */
  private async recordExecutionOutcome(skillId: string, success: boolean): Promise<void> {
    const skill = await db.skill.findUnique({ where: { id: skillId } });
    if (!skill) return;

    const evidence = skill.evidence ? JSON.parse(skill.evidence) : {};
    const history: Array<{ success: boolean; timestamp: string }> = evidence.executionHistory || [];

    history.push({ success, timestamp: new Date().toISOString() });

    // Keep only last 100 entries
    const trimmedHistory = history.slice(-100);
    const recentSuccesses = trimmedHistory.filter((h) => h.success).length;
    const successRate = trimmedHistory.length > 0 ? recentSuccesses / trimmedHistory.length : 0;

    evidence.executionHistory = trimmedHistory;

    await db.skill.update({
      where: { id: skillId },
      data: {
        successRate,
        evidence: JSON.stringify(evidence),
      },
    });
  }
}

// Singleton instance
export const skillManager = new SkillManager();
