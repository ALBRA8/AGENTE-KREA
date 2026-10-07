/**
 * Autonomy Contract — ADN GENERAL DEL AGENTE V1.0
 *
 * Defines the autonomy levels and governance for what the agent can do
 * without human approval. Autonomy is not binary — it's a graduated scale
 * where each level requires more governance and oversight.
 *
 * L0 OBSERVE          — Can only observe/read, never act
 * L1 RECOMMEND        — Can suggest actions, never execute
 * L2 EXECUTE_SAFE     — Can execute safe/internal operations
 * L3 EXECUTE_EXTERNAL — Can execute external API calls (with limits)
 * L4 EXECUTE_SENSITIVE — Can execute sensitive operations (needs approval)
 * L5 SELF_IMPROVE     — Can modify its own behavior/config (highest risk)
 *
 * Real autonomy is determined by the intersection of:
 * - Capability: Does the agent have the capability to do this?
 * - Permission: Does the agent have permission to do this?
 * - Risk: What is the risk level of this action?
 * - Policy: What do the configured policies allow?
 * - Approval: Has the required approval been obtained?
 */

// ─── Autonomy Levels ─────────────────────────────────────────────────────────

/** The six autonomy levels, ordered from most restricted to least */
export type AutonomyLevel = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";

/** Numeric value for each autonomy level */
export const AUTONOMY_LEVEL_VALUE: Record<AutonomyLevel, number> = {
  L0: 0, // OBSERVE
  L1: 1, // RECOMMEND
  L2: 2, // EXECUTE_SAFE
  L3: 3, // EXECUTE_EXTERNAL
  L4: 4, // EXECUTE_SENSITIVE
  L5: 5, // SELF_IMPROVE
};

/** Human-readable description for each autonomy level */
export const AUTONOMY_LEVEL_DESCRIPTION: Record<AutonomyLevel, string> = {
  L0: "OBSERVE — Can only observe/read data, never act or modify anything",
  L1: "RECOMMEND — Can suggest actions and produce recommendations, never execute directly",
  L2: "EXECUTE_SAFE — Can execute safe, internal operations that have no external side effects",
  L3: "EXECUTE_EXTERNAL — Can execute external API calls and operations with configurable limits",
  L4: "EXECUTE_SENSITIVE — Can execute sensitive operations (credential access, data deletion) requiring approval",
  L5: "SELF_IMPROVE — Can modify its own behavior, configuration, and capabilities (highest risk)",
};

/** What each autonomy level can do */
export const AUTONOMY_LEVEL_CAPABILITIES: Record<AutonomyLevel, string[]> = {
  L0: ["read", "observe", "analyze"],
  L1: ["read", "observe", "analyze", "recommend", "suggest"],
  L2: ["read", "observe", "analyze", "recommend", "suggest", "execute_safe", "internal_ops"],
  L3: ["read", "observe", "analyze", "recommend", "suggest", "execute_safe", "internal_ops", "execute_external", "api_calls"],
  L4: ["read", "observe", "analyze", "recommend", "suggest", "execute_safe", "internal_ops", "execute_external", "api_calls", "execute_sensitive", "credential_access"],
  L5: ["read", "observe", "analyze", "recommend", "suggest", "execute_safe", "internal_ops", "execute_external", "api_calls", "execute_sensitive", "credential_access", "self_improve", "config_modify"],
};

// ─── Action Types ────────────────────────────────────────────────────────────

/** Classification of an action for autonomy evaluation */
export type ActionType =
  | "read"              // Read data (no side effects)
  | "analyze"           // Analyze data (no side effects)
  | "recommend"         // Produce a recommendation
  | "execute_safe"      // Execute a safe internal operation
  | "execute_external"  // Execute an external API call
  | "execute_sensitive" // Execute a sensitive operation
  | "credential_access" // Access credentials/secrets
  | "config_modify"     // Modify agent configuration
  | "self_improve"      // Modify agent behavior/capabilities
  | "publish"           // Publish data externally
  | "delete"            // Delete data
  | "delegate"          // Delegate to another agent
  | "unknown";          // Unknown action type

/** Minimum autonomy level required for each action type */
export const ACTION_MINIMUM_LEVEL: Record<ActionType, AutonomyLevel> = {
  read: "L0",
  analyze: "L0",
  recommend: "L1",
  execute_safe: "L2",
  execute_external: "L3",
  execute_sensitive: "L4",
  credential_access: "L4",
  config_modify: "L5",
  self_improve: "L5",
  publish: "L3",
  delete: "L4",
  delegate: "L2",
  unknown: "L5",
};

// ─── Risk Assessment ─────────────────────────────────────────────────────────

/** Risk level of an action */
export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

/** Numeric value for risk levels */
export const RISK_LEVEL_VALUE: Record<RiskLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// ─── Autonomy Limits ─────────────────────────────────────────────────────────

/** Configurable limits for an autonomy level */
export interface AutonomyLimits {
  /** Maximum number of external calls per hour */
  maxExternalCallsPerHour: number;
  /** Maximum credits that can be consumed without approval */
  maxCreditsWithoutApproval: number;
  /** Maximum data size that can be sent externally (bytes) */
  maxExternalDataSize: number;
  /** Whether sensitive operations need explicit approval */
  sensitiveRequiresApproval: boolean;
  /** Whether self-modification needs admin approval */
  selfImproveRequiresAdmin: boolean;
  /** Maximum consecutive failures before auto-degrade */
  maxConsecutiveFailures: number;
  /** Whether to auto-degrade autonomy on repeated failures */
  autoDegrade: boolean;
  /** Cooldown period after a failure before retry (ms) */
  failureCooldownMs: number;
}

/** Default limits for each autonomy level */
export const DEFAULT_AUTONOMY_LIMITS: Record<AutonomyLevel, AutonomyLimits> = {
  L0: {
    maxExternalCallsPerHour: 0,
    maxCreditsWithoutApproval: 0,
    maxExternalDataSize: 0,
    sensitiveRequiresApproval: true,
    selfImproveRequiresAdmin: true,
    maxConsecutiveFailures: 0,
    autoDegrade: false,
    failureCooldownMs: 0,
  },
  L1: {
    maxExternalCallsPerHour: 0,
    maxCreditsWithoutApproval: 0,
    maxExternalDataSize: 0,
    sensitiveRequiresApproval: true,
    selfImproveRequiresAdmin: true,
    maxConsecutiveFailures: 3,
    autoDegrade: false,
    failureCooldownMs: 5000,
  },
  L2: {
    maxExternalCallsPerHour: 0,
    maxCreditsWithoutApproval: 5,
    maxExternalDataSize: 0,
    sensitiveRequiresApproval: true,
    selfImproveRequiresAdmin: true,
    maxConsecutiveFailures: 5,
    autoDegrade: true,
    failureCooldownMs: 3000,
  },
  L3: {
    maxExternalCallsPerHour: 100,
    maxCreditsWithoutApproval: 50,
    maxExternalDataSize: 10 * 1024 * 1024, // 10MB
    sensitiveRequiresApproval: true,
    selfImproveRequiresAdmin: true,
    maxConsecutiveFailures: 5,
    autoDegrade: true,
    failureCooldownMs: 2000,
  },
  L4: {
    maxExternalCallsPerHour: 500,
    maxCreditsWithoutApproval: 200,
    maxExternalDataSize: 50 * 1024 * 1024, // 50MB
    sensitiveRequiresApproval: true,
    selfImproveRequiresAdmin: true,
    maxConsecutiveFailures: 10,
    autoDegrade: true,
    failureCooldownMs: 1000,
  },
  L5: {
    maxExternalCallsPerHour: 1000,
    maxCreditsWithoutApproval: 1000,
    maxExternalDataSize: 100 * 1024 * 1024, // 100MB
    sensitiveRequiresApproval: false,
    selfImproveRequiresAdmin: true,
    maxConsecutiveFailures: 20,
    autoDegrade: false,
    failureCooldownMs: 500,
  },
};

// ─── Autonomy Decision ───────────────────────────────────────────────────────

/** Result of an autonomy evaluation */
export interface AutonomyDecision {
  /** Whether the action is allowed */
  allowed: boolean;
  /** The evaluated autonomy level */
  evaluatedLevel: AutonomyLevel;
  /** The action type */
  actionType: ActionType;
  /** Reason for the decision */
  reason: string;
  /** Whether approval is required */
  approvalRequired: boolean;
  /** Approval level needed if required */
  approvalLevel?: "user" | "admin" | "system";
  /** The risk assessment */
  risk: RiskLevel;
  /** Whether autonomy was auto-degraded */
  autoDegraded: boolean;
  /** Timestamp */
  timestamp: string;
}

// ─── Capability Autonomy Config ──────────────────────────────────────────────

/** Per-capability autonomy configuration */
export interface CapabilityAutonomyConfig {
  /** Capability ID */
  capabilityId: string;
  /** Maximum autonomy level for this capability */
  maxLevel: AutonomyLevel;
  /** Maximum risk allowed for this capability */
  maxRisk: RiskLevel;
  /** Whether this capability requires approval regardless of level */
  requiresApproval: boolean;
  /** Approval level required */
  approvalLevel: "auto" | "user" | "admin" | "system";
  /** Daily execution limit */
  dailyLimit?: number;
  /** Hourly execution limit */
  hourlyLimit?: number;
}

// ─── Autonomy Manager ────────────────────────────────────────────────────────

/**
 * AutonomyManager — Governs what the agent can do based on the intersection
 * of capability, permission, risk, policy, and approval.
 */
export class AutonomyManager {
  /** Current effective autonomy level */
  private currentLevel: AutonomyLevel;
  /** Configured maximum autonomy level (cannot exceed this) */
  private maxLevel: AutonomyLevel;
  /** Per-capability overrides */
  private capabilityConfigs: Map<string, CapabilityAutonomyConfig> = new Map();
  /** Current limits for the active level */
  private limits: AutonomyLimits;
  /** Consecutive failure count */
  private consecutiveFailures: number = 0;
  /** External call count in current hour */
  private externalCallCount: number = 0;
  /** Current hour for rate limiting */
  private currentHour: number = new Date().getHours();
  /** History of autonomy decisions */
  private decisionHistory: AutonomyDecision[] = [];

  constructor(maxLevel: AutonomyLevel = "L3") {
    this.maxLevel = maxLevel;
    this.currentLevel = maxLevel;
    this.limits = DEFAULT_AUTONOMY_LIMITS[maxLevel];
  }

  /** Get the current effective autonomy level */
  getCurrentLevel(): AutonomyLevel {
    return this.currentLevel;
  }

  /** Get the maximum configured autonomy level */
  getMaxLevel(): AutonomyLevel {
    return this.maxLevel;
  }

  /** Get the current limits */
  getLimits(): AutonomyLimits {
    return { ...this.limits };
  }

  /**
   * Set a per-capability autonomy override.
   */
  setCapabilityConfig(config: CapabilityAutonomyConfig): void {
    this.capabilityConfigs.set(config.capabilityId, config);
  }

  /**
   * Evaluate whether an action is allowed at the current autonomy level.
   * This is the core decision function that considers all factors.
   */
  evaluate(params: {
    actionType: ActionType;
    capabilityId?: string;
    risk?: RiskLevel;
    creditCost?: number;
  }): AutonomyDecision {
    const timestamp = new Date().toISOString();

    // 1. Check if action type is allowed at current level
    const requiredLevel = ACTION_MINIMUM_LEVEL[params.actionType];
    const actionAllowed = AUTONOMY_LEVEL_VALUE[this.currentLevel] >= AUTONOMY_LEVEL_VALUE[requiredLevel];

    if (!actionAllowed) {
      return this.recordDecision({
        allowed: false,
        evaluatedLevel: this.currentLevel,
        actionType: params.actionType,
        reason: `Action ${params.actionType} requires level ${requiredLevel}, current level is ${this.currentLevel}`,
        approvalRequired: true,
        approvalLevel: "admin",
        risk: params.risk || "medium",
        autoDegraded: false,
        timestamp,
      });
    }

    // 2. Check per-capability override
    if (params.capabilityId) {
      const capConfig = this.capabilityConfigs.get(params.capabilityId);
      if (capConfig) {
        // Check capability max level
        if (AUTONOMY_LEVEL_VALUE[this.currentLevel] > AUTONOMY_LEVEL_VALUE[capConfig.maxLevel]) {
          // Use the capability's max level instead
          if (AUTONOMY_LEVEL_VALUE[capConfig.maxLevel] < AUTONOMY_LEVEL_VALUE[requiredLevel]) {
            return this.recordDecision({
              allowed: false,
              evaluatedLevel: capConfig.maxLevel,
              actionType: params.actionType,
              reason: `Capability ${params.capabilityId} is limited to ${capConfig.maxLevel}, action requires ${requiredLevel}`,
              approvalRequired: true,
              approvalLevel: capConfig.approvalLevel === "auto" ? undefined : capConfig.approvalLevel,
              risk: params.risk || "medium",
              autoDegraded: false,
              timestamp,
            });
          }
        }

        // Check capability risk limit
        if (params.risk && RISK_LEVEL_VALUE[params.risk] > RISK_LEVEL_VALUE[capConfig.maxRisk]) {
          return this.recordDecision({
            allowed: false,
            evaluatedLevel: this.currentLevel,
            actionType: params.actionType,
            reason: `Capability ${params.capabilityId} max risk is ${capConfig.maxRisk}, action risk is ${params.risk}`,
            approvalRequired: true,
            approvalLevel: "admin",
            risk: params.risk,
            autoDegraded: false,
            timestamp,
          });
        }

        // Check if capability always requires approval
        if (capConfig.requiresApproval) {
          return this.recordDecision({
            allowed: true,
            evaluatedLevel: this.currentLevel,
            actionType: params.actionType,
            reason: `Capability ${params.capabilityId} requires ${capConfig.approvalLevel} approval before execution`,
            approvalRequired: true,
            approvalLevel: capConfig.approvalLevel === "auto" ? undefined : capConfig.approvalLevel,
            risk: params.risk || "low",
            autoDegraded: false,
            timestamp,
          });
        }
      }
    }

    // 3. Check rate limits for external calls
    if (params.actionType === "execute_external" || params.actionType === "publish") {
      this.resetHourlyCounts();
      if (this.externalCallCount >= this.limits.maxExternalCallsPerHour) {
        return this.recordDecision({
          allowed: false,
          evaluatedLevel: this.currentLevel,
          actionType: params.actionType,
          reason: `External call limit reached: ${this.externalCallCount}/${this.limits.maxExternalCallsPerHour} per hour`,
          approvalRequired: true,
          approvalLevel: "admin",
          risk: params.risk || "medium",
          autoDegraded: false,
          timestamp,
        });
      }
    }

    // 4. Check credit limit
    if (params.creditCost && params.creditCost > this.limits.maxCreditsWithoutApproval) {
      return this.recordDecision({
        allowed: true,
        evaluatedLevel: this.currentLevel,
        actionType: params.actionType,
        reason: `Credit cost ${params.creditCost} exceeds auto-approval limit ${this.limits.maxCreditsWithoutApproval}`,
        approvalRequired: true,
        approvalLevel: "user",
        risk: params.risk || "medium",
        autoDegraded: false,
        timestamp,
      });
    }

    // 5. Check sensitive operation approval
    if (params.actionType === "execute_sensitive" && this.limits.sensitiveRequiresApproval) {
      return this.recordDecision({
        allowed: true,
        evaluatedLevel: this.currentLevel,
        actionType: params.actionType,
        reason: "Sensitive operation requires approval",
        approvalRequired: true,
        approvalLevel: "user",
        risk: params.risk || "high",
        autoDegraded: false,
        timestamp,
      });
    }

    // 6. Check self-improve approval
    if (params.actionType === "self_improve" && this.limits.selfImproveRequiresAdmin) {
      return this.recordDecision({
        allowed: true,
        evaluatedLevel: this.currentLevel,
        actionType: params.actionType,
        reason: "Self-improvement requires admin approval",
        approvalRequired: true,
        approvalLevel: "admin",
        risk: params.risk || "critical",
        autoDegraded: false,
        timestamp,
      });
    }

    // All checks passed — action is allowed
    return this.recordDecision({
      allowed: true,
      evaluatedLevel: this.currentLevel,
      actionType: params.actionType,
      reason: `Action ${params.actionType} allowed at level ${this.currentLevel}`,
      approvalRequired: false,
      risk: params.risk || "low",
      autoDegraded: this.currentLevel !== this.maxLevel,
      timestamp,
    });
  }

  /**
   * Record a failure and potentially auto-degrade autonomy.
   */
  recordFailure(): void {
    this.consecutiveFailures++;

    if (this.limits.autoDegrade && this.consecutiveFailures >= this.limits.maxConsecutiveFailures) {
      this.degrade();
    }
  }

  /**
   * Record a success, resetting consecutive failure count.
   */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  /**
   * Record an external call (for rate limiting).
   */
  recordExternalCall(): void {
    this.resetHourlyCounts();
    this.externalCallCount++;
  }

  /**
   * Degrade autonomy by one level.
   */
  degrade(): AutonomyLevel {
    const levels: AutonomyLevel[] = ["L0", "L1", "L2", "L3", "L4", "L5"];
    const currentIndex = levels.indexOf(this.currentLevel);

    if (currentIndex > 0) {
      this.currentLevel = levels[currentIndex - 1];
      this.limits = DEFAULT_AUTONOMY_LIMITS[this.currentLevel];
    }

    return this.currentLevel;
  }

  /**
   * Promote autonomy by one level (cannot exceed max).
   */
  promote(): AutonomyLevel {
    const levels: AutonomyLevel[] = ["L0", "L1", "L2", "L3", "L4", "L5"];
    const currentIndex = levels.indexOf(this.currentLevel);
    const maxIndex = levels.indexOf(this.maxLevel);

    if (currentIndex < maxIndex) {
      this.currentLevel = levels[currentIndex + 1];
      this.limits = DEFAULT_AUTONOMY_LIMITS[this.currentLevel];
    }

    return this.currentLevel;
  }

  /**
   * Reset autonomy to the configured maximum.
   */
  reset(): void {
    this.currentLevel = this.maxLevel;
    this.limits = DEFAULT_AUTONOMY_LIMITS[this.maxLevel];
    this.consecutiveFailures = 0;
  }

  /** Get recent decision history */
  getDecisionHistory(limit?: number): AutonomyDecision[] {
    const history = [...this.decisionHistory];
    return limit ? history.slice(-limit) : history;
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  private recordDecision(decision: AutonomyDecision): AutonomyDecision {
    this.decisionHistory.push(decision);
    // Keep only last 1000 decisions
    if (this.decisionHistory.length > 1000) {
      this.decisionHistory = this.decisionHistory.slice(-1000);
    }
    return decision;
  }

  private resetHourlyCounts(): void {
    const currentHour = new Date().getHours();
    if (currentHour !== this.currentHour) {
      this.currentHour = currentHour;
      this.externalCallCount = 0;
    }
  }
}

// ─── KREA Autonomy Configuration ────────────────────────────────────────────

/**
 * Create the autonomy manager for AGENTE-KREA with per-capability overrides.
 * KREA operates at L3 (EXECUTE_EXTERNAL) by default.
 */
export function createKreaAutonomyManager(): AutonomyManager {
  const manager = new AutonomyManager("L3");

  // Per-capability overrides
  manager.setCapabilityConfig({
    capabilityId: "image_generation",
    maxLevel: "L3",
    maxRisk: "low",
    requiresApproval: false,
    approvalLevel: "auto",
    hourlyLimit: 60,
  });

  manager.setCapabilityConfig({
    capabilityId: "voice_generation",
    maxLevel: "L3",
    maxRisk: "low",
    requiresApproval: false,
    approvalLevel: "auto",
    hourlyLimit: 30,
  });

  manager.setCapabilityConfig({
    capabilityId: "text_generation",
    maxLevel: "L3",
    maxRisk: "low",
    requiresApproval: false,
    approvalLevel: "auto",
  });

  manager.setCapabilityConfig({
    capabilityId: "ebook_generation",
    maxLevel: "L3",
    maxRisk: "low",
    requiresApproval: false,
    approvalLevel: "auto",
    hourlyLimit: 10,
  });

  manager.setCapabilityConfig({
    capabilityId: "campaign_metrics",
    maxLevel: "L2",
    maxRisk: "none",
    requiresApproval: false,
    approvalLevel: "auto",
  });

  manager.setCapabilityConfig({
    capabilityId: "credit_system",
    maxLevel: "L4",
    maxRisk: "medium",
    requiresApproval: true,
    approvalLevel: "system",
  });

  return manager;
}
